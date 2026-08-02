import JSZip from "jszip";
import { extractPdfTextFromUrl } from "@/lib/pdf-server";
import { putBytes } from "@/lib/storage";
import { detectSourceKind, type SourceKind } from "@/lib/source-kind";

export { detectSourceKind, type SourceKind };

// Turns an uploaded source file into plain text for the AI generation
// pipeline (src/lib/ai.ts's generateStructuredNote). PDF reuses the
// existing pdf.js extractor; DOCX/PPTX are new, server-side, dependency-
// light extractors (mammoth for docx; a small custom unzip+regex reader for
// pptx, since no small well-maintained pptx-text package exists the way
// mammoth covers docx — jszip is already a dependency elsewhere in this
// repo, e.g. src/components/bulk-upload). JPG/PNG images are deliberately
// NOT handled here: OCR runs client-side via tesseract.js (mirroring the
// existing pattern in src/components/restore/admin-restore-client.tsx,
// which avoids bundling tesseract's worker/WASM/language-data into a
// server function) — the extracted text is submitted alongside the upload
// instead of re-extracted server-side.

export async function extractDocxText(bytes: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer: bytes });
  return result.value.trim();
}

// A .pptx is a zip of XML slide parts (ppt/slides/slide1.xml, slide2.xml, ...).
// Each run of visible text sits in a <a:t>...</a:t> element — pulling those
// out with a small regex per slide, in slide order, is enough to get a
// clean read-through of the deck without a heavier XML-parsing dependency.
export async function extractPptxText(bytes: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(bytes);
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  const slideTexts: string[] = [];
  for (const name of slideFiles) {
    const xml = await zip.files[name].async("text");
    const runs = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    if (runs.length > 0) slideTexts.push(runs.join(" "));
  }
  return slideTexts.map((text, i) => `Slide ${i + 1}: ${text}`).join("\n\n").trim();
}

/** Extracts plain text from an already-uploaded file's storage URL, for the
 * kinds this module handles server-side (pdf/docx/pptx/text). Images go
 * through the client-side OCR path instead — see the module comment. */
export async function extractSourceTextFromUpload(
  fileUrl: string,
  bytes: Buffer,
  kind: Exclude<SourceKind, "image" | "unsupported">,
): Promise<string> {
  if (kind === "pdf") return extractPdfTextFromUrl(fileUrl);
  if (kind === "docx") return extractDocxText(bytes);
  if (kind === "pptx") return extractPptxText(bytes);
  return bytes.toString("utf-8").trim();
}

/** Stores the original source file (whatever format) so it stays available
 * for re-generation/audit later — mirrors saveUploadedFile's key shape. */
export async function saveSourceFile(file: File, subdir: "note-sources") {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const fileName = `${crypto.randomUUID()}-${safeName}`;
  const fileUrl = await putBytes(`uploads/${subdir}/${fileName}`, bytes);
  return { fileUrl, fileName: file.name, bytes };
}
