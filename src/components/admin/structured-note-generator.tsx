"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileArrowUp, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { generateStructuredNoteAction } from "@/lib/actions";
import { detectSourceKind } from "@/lib/source-kind";
import { ocrImageFile } from "@/lib/note-ocr-client";

// Uploads a PDF/DOCX/PPTX/Markdown/JPG/PNG source and runs it through the
// chunked AI pipeline (src/lib/ai.ts's generateStructuredNote) to produce a
// structured note — the AI-authored counterpart to NotesEditor's manual
// markdown path above it on the subject page. Images are OCR'd right here
// in the browser (src/lib/note-ocr-client.ts) before the file is even
// submitted, since that's the one format the server action can't extract
// itself (see note-ingestion.ts's module comment for why).
export function StructuredNoteGenerator({ subjectId, hasStructuredNote }: { subjectId: string; hasStructuredNote: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [chapter, setChapter] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<"idle" | "ocr" | "generating">("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState<string | null>(null);

  async function submit() {
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    setError(null);
    setSuccessTitle(null);

    try {
      const kind = detectSourceKind(file.name, file.type);
      let extractedText = "";
      if (kind === "image") {
        setStage("ocr");
        extractedText = await ocrImageFile(file, setOcrProgress);
      }

      setStage("generating");
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      if (chapter.trim()) formData.set("chapter", chapter.trim());
      formData.set("file", file);
      if (extractedText) formData.set("extractedText", extractedText);

      const result = await generateStructuredNoteAction(formData);
      setSuccessTitle(result.title);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a note from that file.");
    } finally {
      setStage("idle");
      setOcrProgress(0);
    }
  }

  const busy = stage !== "idle";

  return (
    <div className="rounded-xl border border-dashed border-border bg-surface-muted p-4">
      <p className="text-sm font-medium">Generate a structured note from a source file</p>
      <p className="mt-1 text-xs text-muted">
        PDF, DOCX, PPTX, Markdown/text, or JPG/PNG. This runs the AI pipeline and produces a themed,
        fixed-layout note (see Note Designer for how it&apos;s styled) — separate from the plain markdown
        editor above.
        {hasStructuredNote && " Generating again replaces the current structured note for this subject."}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.pptx,.md,.markdown,.txt,.jpg,.jpeg,.png,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,image/jpeg,image/png,text/plain,text/markdown"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={busy}
          className="text-sm"
        />
        <input
          type="text"
          value={chapter}
          onChange={(e) => setChapter(e.target.value)}
          placeholder="Chapter (optional)"
          disabled={busy}
          className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy || !file}
          className="flex min-h-9 items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
        >
          {stage === "ocr" ? (
            <>
              <FileArrowUp size={15} weight="bold" /> Reading image ({ocrProgress}%)…
            </>
          ) : stage === "generating" ? (
            <>
              <Sparkle size={15} weight="bold" /> Generating…
            </>
          ) : (
            <>
              <Sparkle size={15} weight="bold" /> Generate note
            </>
          )}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {successTitle && !error && (
        <p className="mt-2 text-sm text-success">
          Generated &quot;{successTitle}&quot; — refresh the public subject page to see it.
        </p>
      )}
    </div>
  );
}
