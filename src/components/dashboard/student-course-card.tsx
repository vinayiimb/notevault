"use client";

import { useState } from "react";
import { ArrowRight, BookOpen, GraduationCap, Swap, X } from "@phosphor-icons/react";
import type { StudentCoursePref } from "@/lib/dashboard-store";

interface ProgramOption {
  id: string;
  name: string;
  slug: string;
  terms: { id: string; name: string; subjectsCount?: number }[];
}

interface CourseCardProps {
  pref: StudentCoursePref | null;
  programs: ProgramOption[];
  subjectCount: number;
  onSelectCourseTerm: (programId: string, termId: string) => void;
}

export function StudentCourseCard({
  pref,
  programs,
  subjectCount,
  onSelectCourseTerm,
}: CourseCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(pref?.programId || "");
  const [selectedTermId, setSelectedTermId] = useState(pref?.termId || "");

  const activeProgram = programs.find((p) => p.id === (selectedProgramId || pref?.programId));

  const handleSaveChange = () => {
    if (selectedProgramId && selectedTermId) {
      onSelectCourseTerm(selectedProgramId, selectedTermId);
      setModalOpen(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-brand-soft/30 p-6 shadow-sm transition-all hover:shadow-md sm:p-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Course Information */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
            <GraduationCap size={16} weight="bold" />
            <span>University of Delhi</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl font-display">
              {pref?.programName || "B.Com (Hons) — DU Official Syllabus"}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm font-semibold text-muted">
              <span className="rounded-lg bg-surface-muted px-2.5 py-1 text-foreground">
                {pref?.termName || "Semester 5"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 text-foreground">
                <BookOpen size={16} weight="bold" className="text-brand" />
                {subjectCount} Subjects Available
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:border-brand hover:text-brand transition-colors"
          >
            <Swap size={18} weight="bold" />
            <span>Change Course / Semester</span>
          </button>

          <a
            href="#subjects"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover transition-transform active:scale-95 shadow-sm"
          >
            <span>View Subjects</span>
            <ArrowRight size={16} weight="bold" />
          </a>
        </div>
      </div>

      {/* Change Course / Semester Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="text-lg font-bold font-display">Select Course & Semester</h3>
                <p className="text-xs text-muted">Personalize your dashboard content</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X size={18} weight="bold" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Degree / Course</label>
                <select
                  value={selectedProgramId}
                  onChange={(e) => {
                    setSelectedProgramId(e.target.value);
                    setSelectedTermId("");
                  }}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none"
                >
                  <option value="">Select course...</option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Semester / Year</label>
                <select
                  value={selectedTermId}
                  onChange={(e) => setSelectedTermId(e.target.value)}
                  disabled={!activeProgram}
                  className="w-full h-11 rounded-xl border border-border bg-background px-3 text-sm font-medium focus:border-brand focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select semester...</option>
                  {activeProgram?.terms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!selectedProgramId || !selectedTermId}
                onClick={handleSaveChange}
                className="rounded-xl bg-brand px-5 py-2.5 text-xs font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-40"
              >
                Apply Selection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
