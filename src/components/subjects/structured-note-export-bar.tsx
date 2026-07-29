"use client";

import { useState } from "react";
import Link from "next/link";
import { DownloadSimple, SpeakerHigh, SpeakerX, Sparkle } from "@phosphor-icons/react/dist/ssr";
import type { StructuredNote } from "@/lib/note-schema";
import type { ThemeValues } from "@/lib/note-theme";

// Flattens a structured note into one plain-text block, in the same fixed
// order it renders in — used by both the "Play audio" button and the
// Exam Kit hand-off (sessionStorage, consumed by ExamKitClient) so neither
// duplicates note-schema knowledge of the section order.
function flattenNote(note: StructuredNote): string {
  const parts = [
    note.metadata.title,
    note.summary,
    ...note.keyFacts,
    ...note.sections.flatMap((s) => [s.heading, s.content]),
    ...note.definitions.map((d) => `${d.term}: ${d.definition}`),
    ...note.examples.map((e) => `${e.prompt} ${e.solution}`),
    note.takeaway,
  ];
  return parts.filter(Boolean).join("\n\n");
}

function buildPdf(note: StructuredNote) {
  return import("jspdf").then(({ jsPDF }) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 56;
    const contentW = pageW - margin * 2;
    let y = margin;

    function ensureSpace(lineHeight: number) {
      if (y + lineHeight > pageH - margin) {
        doc.addPage();
        y = margin;
      }
    }
    function heading(text: string, size: number) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(size);
      for (const line of doc.splitTextToSize(text, contentW)) {
        ensureSpace(size + 6);
        doc.text(line, margin, y);
        y += size + 6;
      }
      y += 4;
    }
    function body(text: string) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      for (const line of doc.splitTextToSize(text, contentW)) {
        ensureSpace(14);
        doc.text(line, margin, y);
        y += 14;
      }
      y += 4;
    }

    heading(note.metadata.title, 16);
    body(note.summary);

    if (note.keyFacts.length > 0) {
      heading("Key facts", 12);
      for (const fact of note.keyFacts) body(`•  ${fact}`);
    }

    for (const section of note.sections) {
      heading(section.heading, 13);
      body(section.content);
      if (section.callout && section.callout.type !== "none") body(`${section.callout.type.toUpperCase()}: ${section.callout.text}`);
    }

    if (note.definitions.length > 0) {
      heading("Definitions", 12);
      for (const d of note.definitions) body(`${d.term} — ${d.definition}`);
    }
    if (note.formulas.length > 0) {
      heading("Formulas", 12);
      for (const f of note.formulas) body(`${f.name}: ${f.expression}${f.description ? ` (${f.description})` : ""}`);
    }
    if (note.examples.length > 0) {
      heading("Examples", 12);
      for (const ex of note.examples) body(`${ex.title ? `${ex.title}: ` : ""}${ex.prompt}\n${ex.solution}`);
    }
    if (note.commonMistakes.length > 0) {
      heading("Common mistakes", 12);
      for (const m of note.commonMistakes) body(`•  ${m}`);
    }

    heading("Takeaway", 12);
    body(note.takeaway);

    if (note.sources.length > 0) {
      heading("Sources", 12);
      for (const s of note.sources) body(s);
    }

    doc.save(`${note.metadata.title.replace(/[^\w.-]+/g, "_") || "notes"}.pdf`);
  });
}

export function StructuredNoteExportBar({ note, theme }: { note: StructuredNote; theme: ThemeValues }) {
  const [downloading, setDownloading] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  async function download() {
    setDownloading(true);
    try {
      await buildPdf(note);
    } finally {
      setDownloading(false);
    }
  }

  function toggleAudio() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    // No TTS vendor is wired up (that's a billing/vendor decision for later)
    // — this uses the browser's own built-in speech synthesis, which needs
    // no API key and works today.
    const utterance = new SpeechSynthesisUtterance(flattenNote(note));
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }

  function goToExamKit() {
    sessionStorage.setItem(
      "notevault-exam-kit-prefill",
      JSON.stringify({ subject: note.metadata.subject, notes: flattenNote(note).slice(0, 15000) }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href="/tools/exam-kit"
        onClick={goToExamKit}
        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition hover:opacity-90"
        style={{ borderColor: theme.colors.border, color: theme.colors.primaryAccent }}
      >
        <Sparkle size={16} weight="bold" />
        Practice with Exam Kit
      </Link>
      <button
        type="button"
        onClick={toggleAudio}
        className="flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-muted"
        style={{ borderColor: theme.colors.border }}
      >
        {speaking ? <SpeakerX size={16} weight="bold" /> : <SpeakerHigh size={16} weight="bold" />}
        {speaking ? "Stop" : "Play audio"}
      </button>
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className="flex items-center gap-1.5 rounded-lg border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-50"
        style={{ borderColor: theme.colors.border }}
      >
        <DownloadSimple size={16} weight="bold" />
        {downloading ? "Preparing..." : "Download PDF"}
      </button>
    </div>
  );
}
