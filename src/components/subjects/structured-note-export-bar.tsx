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
  return Promise.resolve().then(() => {
    alert("PDF generation is currently disabled on Cloudflare Workers.");
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
