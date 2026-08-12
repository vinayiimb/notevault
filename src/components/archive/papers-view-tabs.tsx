"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SquaresFour, FilePdf } from "@phosphor-icons/react";
import { DuPypBrowser } from "@/components/pyp/du-pyp-browser";
import { PaperBrowser } from "@/components/archive/paper-browser";

interface Props {
  programmes: string[];
  groupedProgrammes: Record<string, string[]>;
  totalCount: number;
}

export function PapersViewTabs({ programmes, groupedProgrammes, totalCount }: Props) {
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const requestedCourse = searchParams.get("course");

  const [viewMode, setViewMode] = useState<"grid" | "reader">(
    requestedView === "reader" || requestedCourse ? "reader" : "grid"
  );

  useEffect(() => {
    if (requestedView === "reader" || requestedCourse) {
      setViewMode("reader");
    }
  }, [requestedView, requestedCourse]);

  return (
    <div className="space-y-6">
      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === "grid"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <SquaresFour size={18} />
            <span>118 Programmes Matrix</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("reader")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
              viewMode === "reader"
                ? "bg-accent text-white shadow-sm"
                : "bg-surface text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <FilePdf size={18} />
            <span>Interactive PDF Viewer</span>
          </button>
        </div>

        <span className="hidden sm:inline-block text-xs text-muted">
          Showing <strong>{totalCount.toLocaleString()}</strong> papers & syllabus files
        </span>
      </div>

      {/* Main View Area */}
      {viewMode === "grid" ? (
        <DuPypBrowser
          programmes={programmes}
          groupedProgrammes={groupedProgrammes}
          totalCount={totalCount}
        />
      ) : (
        <div className="rounded-2xl border border-border bg-surface/50 p-2 sm:p-4 shadow-sm">
          <PaperBrowser />
        </div>
      )}
    </div>
  );
}
