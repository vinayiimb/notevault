"use client";

import { useMemo, useRef, useState } from "react";
import { FileArrowUp, FilePdf } from "@phosphor-icons/react/dist/ssr";
import { uploadResourceAction } from "@/lib/actions";
import type { AcademicProgram as Program } from "@/lib/academic-types";

type Stage = "upload" | "processing" | "editor";
type Block = { type: "h" | "p"; text: string };

function detectStructure(text: string): Block[] {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  function flush() {
    if (para.length) {
      blocks.push({ type: "p", text: para.join(" ").replace(/\s+/g, " ").trim() });
      para = [];
    }
  }

  for (const raw of lines) {
    const line = raw.trim();
    if (line === "") {
      flush();
      continue;
    }
    const bare = line.replace(/^#{1,3}\s+/, "");
    const wordCount = bare.split(/\s+/).length;
    const isMarked = /^#{1,3}\s+/.test(line);
    const isAllCaps = /[A-Z]/.test(bare) && bare === bare.toUpperCase() && wordCount <= 10;
    const isShortTitle =
      wordCount <= 8 && /^[A-Z]/.test(bare) && !/[.?!]$/.test(bare) && bare.length < 70;

    if (isMarked || isAllCaps) {
      flush();
      blocks.push({ type: "h", text: bare });
    } else if (isShortTitle && para.length === 0 && blocks.length < 60) {
      flush();
      blocks.push({ type: "h", text: bare });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

function paginate(blocks: Block[], charsPerPage: number): Block[][] {
  const pages: Block[][] = [];
  let current: Block[] = [];
  let count = 0;
  for (const b of blocks) {
    const cost = b.text.length + (b.type === "h" ? 40 : 0);
    if (count + cost > charsPerPage && current.length) {
      pages.push(current);
      current = [];
      count = 0;
    }
    current.push(b);
    count += cost;
  }
  if (current.length) pages.push(current);
  return pages.length ? pages : [[]];
}

async function buildPdfBlob(docTitle: string, rawText: string): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const blocks = detectStructure(rawText);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 60;
  const contentW = pageW - margin * 2;
  let y = margin;
  let pageNum = 1;

  function footer() {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(150);
    doc.text(String(pageNum), pageW / 2, pageH - 30, { align: "center" });
  }
  function newPage() {
    doc.addPage();
    pageNum++;
    y = margin;
  }
  function ensureSpace(h: number) {
    if (y + h > pageH - margin - 20) {
      footer();
      newPage();
    }
  }

  doc.setFont("times", "bold");
  doc.setFontSize(19);
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(docTitle, contentW);
  titleLines.forEach((l: string) => {
    doc.text(l, pageW / 2, y, { align: "center" });
    y += 24;
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  doc.text("RESTORED DOCUMENT", pageW / 2, y + 4, { align: "center" });
  y += 34;
  doc.setDrawColor(210, 205, 190);
  doc.line(margin, y, pageW - margin, y);
  y += 26;

  for (const b of blocks) {
    if (b.type === "h") {
      ensureSpace(30);
      doc.setFont("times", "bold");
      doc.setFontSize(13.5);
      doc.setTextColor(30, 30, 30);
      const lines = doc.splitTextToSize(b.text, contentW);
      lines.forEach((l: string) => {
        ensureSpace(18);
        doc.text(l, margin, y);
        y += 18;
      });
      y += 6;
    } else {
      doc.setFont("times", "normal");
      doc.setFontSize(11.5);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(b.text, contentW);
      lines.forEach((l: string) => {
        ensureSpace(16);
        doc.text(l, margin, y);
        y += 16;
      });
      y += 10;
    }
  }
  footer();

  return doc.output("blob");
}

export function AdminRestoreClient({ programs }: { programs: Program[] }) {
  const [stage, setStage] = useState<Stage>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [rawText, setRawText] = useState("");
  const [docTitle, setDocTitle] = useState("Untitled document");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [resourceType, setResourceType] = useState<"NOTES" | "PYQ">("PYQ");
  const [resourceYear, setResourceYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: boolean; text: string } | null>(null);

  const selectedProgram = useMemo(() => programs.find((p) => p.id === programId), [programs, programId]);
  const selectedTerm = useMemo(
    () => selectedProgram?.terms.find((t) => t.id === termId),
    [selectedProgram, termId]
  );

  async function handleFile(file: File) {
    setError(null);
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFileName(file.name);
    const title = file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled document";
    setDocTitle(title);
    setStage("processing");
    setProgress(0);
    setSaveResult(null);

    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const buffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
      const numPages = pdf.numPages;

      let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | null = null;
      let ocrFailed = false;

      let fullText = "";
      for (let i = 1; i <= numPages; i++) {
        setStageLabel(`Reading page ${i} of ${numPages}...`);
        setProgress(Math.round(((i - 1) / numPages) * 95));

        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const nativeText = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();

        let pageText = nativeText;
        if (nativeText.length < 40) {
          if (!worker && !ocrFailed) {
            setStageLabel("Loading OCR engine...");
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
            const ctx = canvas.getContext("2d")!;
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
            const { data } = await worker.recognize(canvas);
            pageText = data.text.trim();
          }
        }
        fullText += pageText + "\n\n";
      }

      if (worker) await worker.terminate();

      setProgress(100);
      setRawText(fullText.replace(/\n{3,}/g, "\n\n").trim());
      setTimeout(() => setStage("editor"), 300);
    } catch (err) {
      setStage("upload");
      setError(`Something went wrong reading that PDF: ${err instanceof Error ? err.message : err}`);
    }
  }

  async function downloadPdf() {
    const blob = await buildPdfBlob(docTitle, rawText);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (docTitle || "restored").replace(/[^\w-]+/g, "_").toLowerCase() + "_restored.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function saveToSubject() {
    if (!subjectId) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const blob = await buildPdfBlob(docTitle, rawText);
      const file = new File([blob], `${docTitle.replace(/[^\w.\- ]+/g, "").trim() || "restored"}.pdf`, {
        type: "application/pdf",
      });
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      formData.set("type", resourceType);
      formData.set("title", docTitle);
      if (resourceType === "PYQ" && resourceYear) formData.set("year", resourceYear);
      formData.set("file", file);

      await uploadResourceAction(formData);
      setSaveResult({ ok: true, text: "Saved to the subject's resources." });
    } catch (err) {
      setSaveResult({
        ok: false,
        text: `Could not save: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setSaving(false);
    }
  }

  if (stage === "upload") {
    return (
      <div className="flex max-w-2xl flex-col gap-4">
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30">
            {error}
          </div>
        )}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-16 text-center transition ${
            dragOver ? "border-accent bg-accent-soft" : "border-border bg-surface hover:border-accent/60"
          }`}
        >
          <FileArrowUp size={32} weight="bold" className="text-muted" />
          <p className="font-medium">Drop a PDF here, or click to browse</p>
          <p className="text-sm text-muted">Old scans, handwritten notes, faded photocopies — all fine.</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
    );
  }

  if (stage === "processing") {
    return (
      <div className="max-w-2xl rounded-xl border border-border bg-surface p-8">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <FilePdf size={28} weight="bold" className="text-accent" />
          <p className="font-medium">{fileName}</p>
        </div>
        <p className="mt-4 flex justify-between text-sm text-muted">
          <span>{stageLabel}</span>
          <span className="font-mono">{progress}%</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
    );
  }

  const blocks = detectStructure(rawText);
  const pages = paginate(blocks, 1500);
  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setStage("upload");
          setRawText("");
          setSaveResult(null);
        }}
        className="text-sm text-muted hover:text-foreground"
      >
        &larr; Start over with another file
      </button>

      <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Extracted text</h2>
            <span className="text-xs text-muted">{wordCount.toLocaleString()} words</span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            spellCheck={false}
            className="h-[360px] w-full resize-y bg-transparent p-4 text-sm leading-relaxed focus:outline-none"
          />
          <p className="px-4 pb-4 text-xs text-muted">
            Edit freely to fix OCR mistakes. Put a line in ALL CAPS or start it with{" "}
            <code className="rounded bg-surface-muted px-1">##</code> to make it a heading.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Paper preview</h2>
            <span className="text-xs text-muted">
              {pages.length} page{pages.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-4">
            {pages.map((pageBlocks, idx) => (
              <div key={idx} className="mb-4 rounded-lg bg-white p-8 text-[#232323] shadow-sm last:mb-0">
                {idx === 0 && (
                  <>
                    <p className="text-center text-lg font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                      {docTitle}
                    </p>
                    <p className="mb-6 text-center text-[10px] uppercase tracking-wide text-gray-400">
                      Restored document
                    </p>
                  </>
                )}
                {pageBlocks.map((b, i) =>
                  b.type === "h" ? (
                    <h3 key={i} className="mb-2 mt-5 text-sm font-semibold" style={{ fontFamily: "Georgia, serif" }}>
                      {b.text}
                    </h3>
                  ) : (
                    <p key={i} className="mb-3 text-justify text-xs leading-relaxed" style={{ fontFamily: "Georgia, serif" }}>
                      {b.text}
                    </p>
                  )
                )}
                <p className="mt-6 text-center text-[10px] text-gray-400">{idx + 1}</p>
              </div>
            ))}
          </div>
          <div className="flex justify-end border-t border-border p-4">
            <button
              type="button"
              onClick={downloadPdf}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
            >
              Download PDF
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Save to a subject</h2>
        <p className="mt-1 text-sm text-muted">
          Pick where this paper belongs, then save it as a real resource students can find.
        </p>

        <div className="mt-4 flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Title</label>
          <input
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Program</label>
            <select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setTermId("");
                setSubjectId("");
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="">Select program</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Semester</label>
            <select
              value={termId}
              onChange={(e) => {
                setTermId(e.target.value);
                setSubjectId("");
              }}
              disabled={!selectedProgram}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
            >
              <option value="">Select semester</option>
              {selectedProgram?.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!selectedTerm}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
            >
              <option value="">Select subject</option>
              {selectedTerm?.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Type</label>
            <select
              value={resourceType}
              onChange={(e) => setResourceType(e.target.value as "NOTES" | "PYQ")}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              <option value="PYQ">PYQ</option>
              <option value="NOTES">Notes</option>
            </select>
          </div>
          {resourceType === "PYQ" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Year</label>
              <input
                value={resourceYear}
                onChange={(e) => setResourceYear(e.target.value)}
                type="number"
                placeholder="2024"
                className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
          )}
          <button
            type="button"
            onClick={saveToSubject}
            disabled={!subjectId || saving || !docTitle.trim()}
            className="ml-auto rounded-lg bg-accent px-5 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save to NoteVault"}
          </button>
        </div>

        {saveResult && (
          <p className={`mt-3 text-sm ${saveResult.ok ? "text-green-600" : "text-red-500"}`}>
            {saveResult.text}
          </p>
        )}
      </div>
    </div>
  );
}
