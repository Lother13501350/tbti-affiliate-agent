// 極簡 CSV 解析（零相依）。支援：引號包覆、""跳脫、欄內逗號/換行、CRLF、UTF-8 BOM。
// 第一列為表頭（去前後空白）；回傳以表頭為鍵的物件陣列。空白列略過。
// 給人工下載的 Klook/KKday/Trip 報表用；Excel 請先另存為 CSV(UTF-8)。

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const text = input.replace(/^﻿/, ""); // 去 BOM
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // 忽略；\r\n 由 \n 收尾
    } else {
      field += c;
    }
  }
  if (inQuotes) throw new Error("CSV has an unclosed quoted field");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  const out: CsvRow[] = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0].trim() === "") continue; // 空白列
    const obj: CsvRow = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    out.push(obj);
  }
  return out;
}

/** 從一列中，依「候選欄名（不分大小寫/空白）」取第一個有值的欄。找不到回 "". */
export function pick(row: CsvRow, candidates: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "");
  const map = new Map<string, string>();
  for (const [k, v] of Object.entries(row)) map.set(norm(k), v);
  for (const cand of candidates) {
    const v = map.get(norm(cand));
    if (v != null && v !== "") return v;
  }
  return "";
}
