// Reads either a .csv or an .xlsx/.xls admin upload into the same row-object
// shape parseCsv already produces (trimmed values, keyed by trimmed
// lowercased header) so downstream import logic never needs to know which
// format the admin used.
import { parseCsv } from "@/lib/csv";

export async function parseSpreadsheetRows(file: File): Promise<Record<string, string>[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) return [];
    const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    return rows.map((row) => {
      const obj: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        obj[key.trim().toLowerCase()] = String(value ?? "").trim();
      }
      return obj;
    });
  }

  const text = await file.text();
  return parseCsv(text);
}
