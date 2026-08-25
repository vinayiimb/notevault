import path from "path";
import { readBytesFromUrl } from "@/lib/storage";

// Server-only helper: extracts selectable text from a PDF using pdf.js's
// legacy (Node-compatible) build. Only handles PDFs with a real text layer
// — scanned/handwritten PDFs need the Restore tool's OCR path. `fileUrl` is
// whatever Resource.fileUrl holds — a local "/uploads/..." path or a Vercel
// Blob https URL — readBytesFromUrl handles both.
export async function extractPdfTextFromUrl(fileUrl: string): Promise<string> {
  throw new Error("PDF extraction disabled for Cloudflare Workers due to size limits");
}
