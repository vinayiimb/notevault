// Client-only: reads a PDF's text layer page by page and falls back to
// tesseract OCR for scanned pages (text layer under 40 chars). Shared by
// Admin → OCR upload and Admin → PYQ Analyser.
export async function readPdfWithOcr(
  file: File,
  onProgress?: (label: string, percent: number) => void,
): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const numPages = pdf.numPages;

  let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
  let ocrFailed = false;
  let fullText = "";

  try {
    for (let i = 1; i <= numPages; i++) {
      onProgress?.(`Reading page ${i} of ${numPages}...`, Math.round(((i - 1) / numPages) * 95));

      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      if (pageText.length < 40) {
        if (!worker && !ocrFailed) {
          onProgress?.("Loading OCR engine...", Math.round(((i - 1) / numPages) * 95));
          try {
            const Tesseract = await import("tesseract.js");
            worker = await Tesseract.createWorker("eng");
          } catch {
            ocrFailed = true;
          }
        }
        if (worker) {
          const viewport = page.getViewport({ scale: 2.5 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
          const { data } = await worker.recognize(canvas);
          pageText = data.text.trim();
        }
      }
      fullText += pageText + "\n\n";
    }
  } finally {
    if (worker) await worker.terminate();
  }

  onProgress?.("Done", 100);
  return fullText.replace(/\n{3,}/g, "\n\n").trim();
}
