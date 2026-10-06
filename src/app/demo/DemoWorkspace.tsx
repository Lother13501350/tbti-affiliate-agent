"use client";
import { useEffect, useState } from "react";
import type { Workspace } from "@/lib/demo/workspace";
import { SAMPLE_CSV, UPDATE_CSV } from "@/lib/demo/fixtures";
export function DemoWorkspace() {
  const [state, setState] = useState<Workspace | null>(null),
    [csv, setCsv] = useState(SAMPLE_CSV),
    [platform, setPlatform] = useState("kkday"),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [error, setError] = useState("");
  async function load() {
    try {
      const r = await fetch("/api/demo", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setState(j.state);
      setError("");
    } catch {
      setError("Could not load the workspace. Retry in a moment.");
    }
  }
  useEffect(() => {
    let active = true;
    fetch("/api/demo", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        return j;
      })
      .then((j) => {
        if (active) setState(j.state);
      })
      .catch(() => {
        if (active)
          setError("Could not load the workspace. Retry in a moment.");
      });
    return () => {
      active = false;
    };
  }, []);
  async function command(body: object) {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setState(j.state);
      setNote(j.note ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No changes applied. Retry.");
    } finally {
      setBusy(false);
    }
  }
  const readOnly = state?.role === "viewer",
    disabled = busy || !state;
  const money = (n: number | null | undefined) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(n ?? 0);
  const commission =
    state?.orders
      .filter((o) => ["confirmed", "completed"].includes(o.status))
      .reduce((n, o) => n + (o.commissionAmount ?? 0), 0) ?? 0;
  return (
    <main className="demo-workspace" lang="en">
      <div className="demo-shell">
        <header className="demo-header">
          <div>
            <h1>Affiliate workspace</h1>
            <p>
              Import orders. Inspect duplicates. Review AI suggestions before
              they change a product.
            </p>
          </div>
          <a href="https://github.com/Lother13501350/tbti-affiliate-agent">
            View source
          </a>
        </header>
        <div className="demo-toolbar">
          <p>
            Fictional data · Your own resettable workspace · Fixed AI
            suggestions
          </p>
          <div>
            <label htmlFor="demo-role">Demo role</label>
            <select
              id="demo-role"
              value={state?.role ?? "reviewer"}
              disabled={disabled}
              onChange={(e) =>
                void command({ action: "role", role: e.target.value })
              }
            >
              <option value="reviewer">Reviewer</option>
              <option value="viewer">Viewer</option>
            </select>
            <button
              disabled={disabled}
              onClick={() => void command({ action: "reset" })}
            >
              Reset workspace
            </button>
          </div>
        </div>
        <div className="demo-feedback" aria-live="polite" aria-atomic="true">
          {busy ? (
            <p>Applying your action…</p>
          ) : error ? (
            <p className="demo-error" role="alert">
              {error}{" "}
              {!state && (
                <button onClick={() => void load()}>Retry loading</button>
              )}
            </p>
          ) : note ? (
            <p>{note}</p>
          ) : (
            <p>
              Start with the sample report, then import it again to check
              deduplication.
            </p>
          )}
        </div>
        <div className="demo-columns">
          <section className="demo-orders" aria-labelledby="orders-title">
            <h2 id="orders-title">Order imports</h2>
            <p className="demo-description">
              The sample contains four rows, including one duplicate order. A
              status update changes existing orders without adding them again.
            </p>
            <div className="demo-report-tools">
              <button disabled={busy} onClick={() => setCsv(SAMPLE_CSV)}>
                Load initial report
              </button>
              <button disabled={busy} onClick={() => setCsv(UPDATE_CSV)}>
                Load status update
              </button>
              <div className="demo-platform-control">
                <label htmlFor="platform">Platform</label>
                <select
                  id="platform"
                  value={platform}
                  disabled={busy}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  <option value="kkday">KKday</option>
                  <option value="klook">Klook</option>
                  <option value="trip">Trip.com</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <label className="demo-label" htmlFor="report">
              Sample CSV · TWD · up to eight rows
            </label>
            <textarea
              id="report"
              value={csv}
              maxLength={5000}
              onChange={(e) => setCsv(e.target.value)}
              spellCheck={false}
              disabled={busy}
            />
            <div className="demo-import-actions">
              <button
                className="demo-primary"
                disabled={disabled || readOnly}
                onClick={() =>
                  void command({ action: "import", csv, platform })
                }
              >
                Import report
              </button>
              {readOnly && (
                <>
                  <span>Viewer has read-only access.</span>
                  <button
                    onClick={() =>
                      void command({ action: "import", csv, platform })
                    }
                    disabled={disabled}
                  >
                    Check permission
                  </button>
                </>
              )}
            </div>
            <div className="demo-table-scroll">
              <table>
                <caption>
                  Imported orders · {state?.orders.length ?? 0} unique records
                </caption>
                <thead>
                  <tr>
                    <th>Order / platform</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Commission</th>
                    <th>Attribution</th>
                  </tr>
                </thead>
                <tbody>
                  {state?.orders.map((o) => (
                    <tr key={o.platform + o.externalOrderId}>
                      <th scope="row">
                        {o.externalOrderId}
                        <small>{o.platform}</small>
                      </th>
                      <td>
                        <span className={`demo-status ${o.status}`}>
                          {o.status}
                        </span>
                      </td>
                      <td>{money(o.orderAmount)}</td>
                      <td>{money(o.commissionAmount)}</td>
                      <td>{o.attributed ? "Tracked" : "Unattributed"}</td>
                    </tr>
                  ))}
                  {!state?.orders.length && (
                    <tr>
                      <td colSpan={5} className="demo-empty">
                        {state
                          ? "Import the sample report to populate this table."
                          : "Loading your sample workspace…"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="demo-total">
              Eligible sample commission <strong>{money(commission)}</strong>
              <span>
                Confirmed and completed orders only; no real earnings.
              </span>
            </p>
          </section>
          <section className="demo-proposals" aria-labelledby="proposals-title">
            <h2 id="proposals-title">AI review queue</h2>
            <p className="demo-description">
              Suggestions begin pending. Approval applies only the allowed
              action; rejection leaves the product unchanged.
            </p>
            {state?.proposals.map((p) => (
              <article className="demo-proposal" key={p.id}>
                <div className="demo-proposal-heading">
                  <h3>
                    {p.kind === "boost"
                      ? "Increase food-walk exposure"
                      : p.kind === "pause"
                        ? "Pause the city tour"
                        : "Review a railway-pass alternative"}
                  </h3>
                  <span className={`demo-status ${p.status}`}>{p.status}</span>
                </div>
                <p>{p.rationale}</p>
                <p className="demo-evidence">{p.evidence}</p>
                {p.status === "pending" ? (
                  <div className="demo-decision">
                    <button
                      className="demo-primary"
                      disabled={disabled || readOnly}
                      onClick={() =>
                        void command({
                          action: "decide",
                          id: p.id,
                          decision: "approved",
                        })
                      }
                    >
                      {p.kind === "replace"
                        ? "Acknowledge alternative"
                        : `Approve ${p.kind}`}
                    </button>
                    <button
                      disabled={disabled || readOnly}
                      onClick={() =>
                        void command({
                          action: "decide",
                          id: p.id,
                          decision: "rejected",
                        })
                      }
                    >
                      {p.kind === "replace"
                        ? "Reject alternative"
                        : `Reject ${p.kind}`}
                    </button>
                  </div>
                ) : (
                  <p className="demo-outcome">
                    {p.status === "applied"
                      ? "Approved action applied."
                      : p.status === "rejected"
                        ? "Rejected. Product unchanged."
                        : "Acknowledged. No automatic replacement."}
                  </p>
                )}
              </article>
            ))}
          </section>
        </div>
        <section className="demo-products" aria-labelledby="products-title">
          <h2 id="products-title">Product curation</h2>
          <p className="demo-description">
            Check the effect of a reviewed suggestion here. Boosts stop at 100;
            advisory replacements keep the product intact.
          </p>
          <div className="demo-table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Sample product</th>
                  <th>Status</th>
                  <th>Recommendation score</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {state?.products.map((p) => (
                  <tr key={p.id}>
                    <th scope="row">{p.name}</th>
                    <td>{p.status}</td>
                    <td>{p.recommendScore} / 100</td>
                    <td>{p.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="demo-activity" aria-labelledby="activity-title">
          <h2 id="activity-title">Recent actions</h2>
          {state?.events.length ? (
            <ol>
              {state.events.map((event, i) => (
                <li key={i}>{event}</li>
              ))}
            </ol>
          ) : (
            <p>Import a report or decide a suggestion to record an action.</p>
          )}
        </section>
        <footer className="demo-footer">
          <p>
            Demo sessions last one hour. Reset returns to the original samples.
          </p>
          <a href="https://github.com/Lother13501350/tbti-affiliate-agent#verification">
            Read the test and storage boundaries
          </a>
        </footer>
      </div>
    </main>
  );
}
