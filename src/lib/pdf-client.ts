// Client-only helper: extracts selectable text from a PDF using pdf.js.
// Only handles PDFs with real text layers (typed documents, not scans) —
// for scanned/handwritten PDFs, point the user at the Restore tool first.
export async function extractPdfText(file: File): Promise<string> {
  throw new Error("PDF extraction is disabled for Cloudflare Workers.");
}
