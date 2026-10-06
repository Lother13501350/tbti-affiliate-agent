import { PERSONA_CODES } from "./personas";
import { BOOST_INCREMENT, SCORE_MAX } from "./workflows";

// Both the Neon adapter and PostgreSQL integration suite execute these functions.
// A function call is one transaction: errors roll back mutations and audit rows.
export const ORDER_IMPORT_SQL = `
CREATE OR REPLACE FUNCTION affiliate_import_orders(
  p_platform text, p_orders jsonb, p_hash text, p_batch text, p_source text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  o jsonb; v_product text; v_inserted boolean; v_rows int;
  n_insert int := 0; n_update int := 0; n_duplicate int := 0; n_attributed int := 0;
BEGIN
  IF p_platform NOT IN ('kkday','klook','trip','other') THEN RAISE EXCEPTION 'unsupported platform'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_platform || ':' || COALESCE(p_hash,p_batch),0));
  IF p_hash IS NOT NULL AND EXISTS (
    SELECT 1 FROM affiliate_import_batches WHERE kind='orders' AND platform=p_platform AND content_hash=p_hash AND errors=0
  ) THEN
    RETURN jsonb_build_object('batchId',NULL,'total',jsonb_array_length(p_orders),'inserted',0,'updated',0,'duplicates',0,'errors',0,'attributed',0,'unattributed',0,'skippedDuplicateFile',true);
  END IF;
  FOR o IN SELECT value FROM jsonb_array_elements(p_orders) LOOP
    IF COALESCE(o->>'externalOrderId','')='' THEN RAISE EXCEPTION 'missing order ID'; END IF;
    SELECT id INTO v_product FROM affiliate_products WHERE platform=p_platform AND external_product_id=o->>'productExternalId' LIMIT 1;
    IF (o->>'attributed')::boolean THEN n_attributed := n_attributed+1; END IF;
    INSERT INTO affiliate_orders AS old (
      platform,external_order_id,ordered_at,completed_at,cancelled_at,status,product_id,product_external_id,
      product_type,sub_id,campaign,persona_code,placement,attributed,order_amount,currency,commission_amount,commission_currency,import_batch_id
    ) VALUES (
      p_platform,o->>'externalOrderId',(o->>'orderedAt')::timestamptz,(o->>'completedAt')::timestamptz,(o->>'cancelledAt')::timestamptz,
      o->>'status',v_product,o->>'productExternalId',o->>'productType',o->>'subId',o->>'campaign',o->>'personaCode',o->>'placement',
      (o->>'attributed')::boolean,(o->>'orderAmount')::numeric,o->>'currency',(o->>'commissionAmount')::numeric,o->>'commissionCurrency',p_batch
    ) ON CONFLICT (platform,external_order_id) DO UPDATE SET
      status=EXCLUDED.status,completed_at=EXCLUDED.completed_at,cancelled_at=EXCLUDED.cancelled_at,
      order_amount=EXCLUDED.order_amount,commission_amount=EXCLUDED.commission_amount,commission_currency=EXCLUDED.commission_currency,
      product_id=COALESCE(EXCLUDED.product_id,old.product_id),persona_code=COALESCE(EXCLUDED.persona_code,old.persona_code),
      placement=COALESCE(EXCLUDED.placement,old.placement),sub_id=COALESCE(EXCLUDED.sub_id,old.sub_id),
      attributed=old.attributed OR EXCLUDED.attributed,updated_at=now()
    WHERE ROW(old.status,old.completed_at,old.cancelled_at,old.order_amount,old.commission_amount,old.commission_currency,old.product_id,old.persona_code,old.placement,old.sub_id,old.attributed)
      IS DISTINCT FROM ROW(EXCLUDED.status,EXCLUDED.completed_at,EXCLUDED.cancelled_at,EXCLUDED.order_amount,EXCLUDED.commission_amount,EXCLUDED.commission_currency,COALESCE(EXCLUDED.product_id,old.product_id),COALESCE(EXCLUDED.persona_code,old.persona_code),COALESCE(EXCLUDED.placement,old.placement),COALESCE(EXCLUDED.sub_id,old.sub_id),old.attributed OR EXCLUDED.attributed)
    RETURNING (xmax=0) INTO v_inserted;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows=0 THEN n_duplicate:=n_duplicate+1;
    ELSIF v_inserted THEN n_insert:=n_insert+1;
    ELSE n_update:=n_update+1; END IF;
  END LOOP;
  INSERT INTO affiliate_import_batches(id,kind,platform,source,row_count,inserted,updated,duplicates,errors,content_hash)
    VALUES(p_batch,'orders',p_platform,p_source,jsonb_array_length(p_orders),n_insert,n_update,n_duplicate,0,p_hash);
  RETURN jsonb_build_object('batchId',p_batch,'total',jsonb_array_length(p_orders),'inserted',n_insert,'updated',n_update,'duplicates',n_duplicate,'errors',0,'attributed',n_attributed,'unattributed',jsonb_array_length(p_orders)-n_attributed,'skippedDuplicateFile',false);
END $$`;

export const PROPOSAL_DECISION_SQL = `
CREATE OR REPLACE FUNCTION affiliate_decide_proposal(p_id text,p_decision text)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p affiliate_proposals%ROWTYPE; before_product jsonb; after_product jsonb; effect text; final_status text;
BEGIN
  IF p_decision NOT IN ('approved','rejected') THEN RAISE EXCEPTION 'invalid decision'; END IF;
  SELECT * INTO p FROM affiliate_proposals WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('proposal',NULL); END IF;
  IF p.status <> 'pending' THEN RETURN jsonb_build_object('proposal',row_to_json(p),'effect','already decided'); END IF;
  IF p_decision='rejected' THEN
    final_status:='rejected'; effect:='rejected without changes';
  ELSIF p.kind IN ('replace','add_gap') THEN
    final_status:='approved'; effect:='advisory only';
  ELSIF p.kind IN ('pause','boost','retag') THEN
    SELECT to_jsonb(t) INTO before_product FROM affiliate_products t WHERE id=p.product_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'target product unavailable'; END IF;
    IF p.kind='pause' THEN
      UPDATE affiliate_products SET status='paused',updated_at=now() WHERE id=p.product_id RETURNING to_jsonb(affiliate_products.*) INTO after_product;
      effect:='product paused';
    ELSIF p.kind='boost' THEN
      UPDATE affiliate_products SET recommend_score=LEAST(${SCORE_MAX},COALESCE(recommend_score,50)+${BOOST_INCREMENT}),updated_at=now() WHERE id=p.product_id RETURNING to_jsonb(affiliate_products.*) INTO after_product;
      effect:='Recommendation score: ' || (after_product->>'recommend_score') || ' / ${SCORE_MAX}';
    ELSE
      UPDATE affiliate_products SET
        personas=CASE WHEN jsonb_typeof(p.payload->'personas')='array' THEN COALESCE((SELECT jsonb_agg(code) FROM (SELECT DISTINCT upper(trim(value)) code FROM jsonb_array_elements_text(p.payload->'personas') WHERE upper(trim(value)) IN (${PERSONA_CODES.map((c) => "'" + c + "'").join(",")})) valid),'[]'::jsonb) ELSE personas END,category=COALESCE(p.payload->>'category',category),updated_at=now()
        WHERE id=p.product_id RETURNING to_jsonb(affiliate_products.*) INTO after_product;
      effect:='tags updated';
    END IF;
    final_status:='applied';
  ELSE RAISE EXCEPTION 'unsupported proposal kind'; END IF;
  UPDATE affiliate_proposals SET status=final_status,decided_at=now() WHERE id=p_id RETURNING * INTO p;
  INSERT INTO affiliate_audit_log(entity_type,entity_id,action,actor,before_json,after_json,reason,approved)
    VALUES('system',p_id,'proposal_' || p.kind || '_' || final_status,'admin',before_product,
      jsonb_build_object('proposal',row_to_json(p),'product',after_product,'effect',effect),p.payload->>'rationale',p_decision='approved');
  RETURN jsonb_build_object('proposal',row_to_json(p),'effect',effect);
END $$`;
