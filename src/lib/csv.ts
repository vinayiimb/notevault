// Minimal, dependency-free CSV parser — handles quoted fields (with
// embedded commas/quotes/newlines) and auto-detects the delimiter (comma,
// semicolon, or tab — Excel exports in some locales use semicolons).
// Returns one object per data row, keyed by the (trimmed, lowercased)
// header from the first row.
export function parseCsv(text: string): Record<string, string>[] {
  // Strip a UTF-8 BOM, which Excel prepends and would otherwise end up
  // glued onto the first header name (e.g. "﻿title" != "title").
  const cleaned = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const firstLine = cleaned.split(/\r?\n/, 1)[0] ?? "";
  const candidates: [string, number][] = [",", ";", "\t"].map((d) => [
    d,
    firstLine.split(d).length,
  ]);
  const delimiter = candidates.reduce((a, b) => (b[1] > a[1] ? b : a))[0];

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (inQuotes) {
      if (c === '"') {
        if (cleaned[i + 1] === '"') {
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
    } else if (c === delimiter) {
      pushField();
    } else if (c === "\n") {
      pushRow();
    } else if (c === "\r") {
      // skip — a following \n (if any) closes the row
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();

  const nonEmptyRows = rows.filter((r) => r.some((cell) => cell.trim() !== ""));
  if (nonEmptyRows.length === 0) return [];

  const header = nonEmptyRows[0].map((h) => h.trim().toLowerCase());
  return nonEmptyRows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    header.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").trim();
    });
    return obj;
  });
}
