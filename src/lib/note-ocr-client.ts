// Client-only: extracts text from an uploaded JPG/PNG via tesseract.js
// running in the browser, mirroring the exact worker lifecycle already used
// for scanned-PDF OCR in src/components/restore/admin-restore-client.tsx.
// Kept client-side (not a server action) so tesseract's worker/WASM/
// language-data never has to be bundled into a Vercel serverless function —
// the same reason the existing restore tool does it this way. Only ever
// call this from a "use client" component.
export async function ocrImageFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const worker = await Tesseract.createWorker("eng", 1, {
    logger: onProgress
      ? (m) => {
          if (m.status === "recognizing text") onProgress(Math.round(m.progress * 100));
        }
      : undefined,
  });
  try {
    const { data } = await worker.recognize(file);
    return data.text.trim();
  } finally {
    await worker.terminate();
  }
}
