"use client";

import { useState } from "react";
import { X, CheckCircle, PaperPlaneTilt, BookOpen } from "@phosphor-icons/react";

interface RequestNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RequestNotesModal({ isOpen, onClose }: RequestNotesModalProps) {
  const [course, setCourse] = useState("");
  const [semester, setSemester] = useState("");
  const [subject, setSubject] = useState("");
  const [topics, setTopics] = useState("");
  const [contact, setContact] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject.trim()) return;

    setIsSubmitting(true);
    try {
      const requests = JSON.parse(localStorage.getItem("notevault_requested_notes") || "[]");
      requests.push({
        course,
        semester,
        subject,
        topics,
        contact,
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("notevault_requested_notes", JSON.stringify(requests));
    } catch {
      // ignore storage errors
    }

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 450);
  }

  function handleReset() {
    setCourse("");
    setSemester("");
    setSubject("");
    setTopics("");
    setContact("");
    setSubmitted(false);
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-border/80 bg-surface p-6 shadow-2xl transition-all sm:p-8 z-10">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 inline-flex size-9 items-center justify-center rounded-full bg-surface-muted text-muted hover:bg-surface-muted/80 hover:text-foreground transition"
          aria-label="Close dialog"
        >
          <X size={18} weight="bold" />
        </button>

        {submitted ? (
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle size={40} weight="fill" />
            </div>
            <h3 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Request Received! 🎀
            </h3>
            <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
              Thank you! We create and prioritize free notes based on student demand for{" "}
              <strong className="text-foreground">{subject}</strong>.
              {contact && " We will notify you once notes are published."}
            </p>
            <div className="pt-4 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center justify-center rounded-2xl bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground shadow-md transition hover:bg-brand-hover"
              >
                Done
              </button>
              <a
                href="https://drive.google.com/drive/folders/1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-border bg-surface-muted px-6 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-muted/80"
              >
                <BookOpen size={16} />
                <span>Browse Existing Free Notes</span>
              </a>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="flex size-10 items-center justify-center rounded-xl bg-pink-500/15 text-pink-500 font-bold">
                🎀
              </span>
              <div>
                <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Request Free Subject Notes
                </h3>
                <p className="text-xs sm:text-sm text-muted">
                  Tell us what you need — we prepare notes based on student demand!
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">
                    Degree / Course <span className="text-pink-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={course}
                    onChange={(e) => setCourse(e.target.value)}
                    placeholder="e.g. B.A. (Hons) Economics, B.Com"
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground">Semester</label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand cursor-pointer"
                  >
                    <option value="">Select Semester (I to VIII)</option>
                    <option value="Sem 1">Semester 1</option>
                    <option value="Sem 2">Semester 2</option>
                    <option value="Sem 3">Semester 3</option>
                    <option value="Sem 4">Semester 4</option>
                    <option value="Sem 5">Semester 5</option>
                    <option value="Sem 6">Semester 6</option>
                    <option value="Sem 7">Semester 7</option>
                    <option value="Sem 8">Semester 8</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Subject / Paper Name <span className="text-pink-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Introductory Microeconomics, Financial Accounting"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Specific Units or Chapters Needed (Optional)
                </label>
                <textarea
                  rows={2}
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  placeholder="e.g. Unit 2 & 3 summary, formula sheet, important PYQ solutions..."
                  className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  Email or WhatsApp <span className="text-xs text-muted font-normal">(Optional, to notify you when ready)</span>
                </label>
                <input
                  type="text"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="e.g. yourname@gmail.com or 9876543210"
                  className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none transition focus:border-brand"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting || !subject.trim()}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-sm font-bold text-brand-foreground shadow-md transition hover:bg-brand-hover disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Submitting demand...</span>
                  ) : (
                    <>
                      <PaperPlaneTilt size={18} weight="bold" />
                      <span>Submit Notes Demand →</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
