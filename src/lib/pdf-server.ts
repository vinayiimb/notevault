import path from "path";
import { readBytesFromUrl } from "@/lib/storage";

// Server-only helper: extracts selectable text from a PDF using pdf.js's
// legacy (Node-compatible) build. Only handles PDFs with a real text layer
// — scanned/handwritten PDFs need the Restore tool's OCR path. `fileUrl` is
// whatever Resource.fileUrl holds — a local "/uploads/..." path or a Vercel
// Blob https URL — readBytesFromUrl handles both.
export async function extractPdfTextFromUrl(fileUrl: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(
    process.cwd(),
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"
  );

  const data = await readBytesFromUrl(fileUrl);
  const pdf = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl: path.join(process.cwd(), "node_modules/pdfjs-dist/standard_fonts") + "/",
  }).promise;

  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    text += pageText + "\n\n";
  }

  return text.replace(/[ \t]+/g, " ").trim();
}
