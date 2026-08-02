"use client";

import { useState, useMemo } from "react";
import {
  CaretDown,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { SubjectCard, type SubjectData } from "./subject-card";

interface SubjectGridProps {
  subjects: SubjectData[];
  termName?: string;
}

type FilterType = "ALL" | "NOTES" | "PYQS";
type SortType = "ALPHA" | "RESOURCES";

export function SubjectGrid({ subjects, termName = "Current Semester" }: SubjectGridProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<FilterType>("ALL");
  const [sortBy, setSortBy] = useState<SortType>("ALPHA");
  const [showAll, setShowAll] = useState(false);

  // Filter & Sort subjects
  const filteredSubjects = useMemo(() => {
    return subjects
      .filter((s) => {
        const matchesQuery =
          s.name.toLowerCase().includes(query.toLowerCase()) ||
          (s.description || "").toLowerCase().includes(query.toLowerCase());
        if (!matchesQuery) return false;

        if (typeFilter === "NOTES") return s.notesCount > 0;
        if (typeFilter === "PYQS") return s.pyqsCount > 0;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "RESOURCES") {
          const totalA = a.notesCount + a.pyqsCount + a.answersCount;
          const totalB = b.notesCount + b.pyqsCount + b.answersCount;
          return totalB - totalA;
        }
        return a.name.localeCompare(b.name);
      });
  }, [subjects, query, typeFilter, sortBy]);

  const visibleSubjects = showAll ? filteredSubjects : filteredSubjects.slice(0, 6);

  return (
    <section id="subjects" className="space-y-6" aria-labelledby="my-subjects-heading">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="my-subjects-heading" className="text-xl font-bold font-display text-foreground">
              My Subjects
            </h2>
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-bold text-brand">
              {filteredSubjects.length}
            </span>
          </div>
          <p className="text-xs text-muted">Selected papers for {termName}</p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search input */}
          <div className="relative flex-1 sm:w-48 sm:flex-none">
            <MagnifyingGlass size={16} weight="bold" className="absolute left-3 top-3 text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter subjects..."
              className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-8 text-xs font-medium focus:border-brand focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2.5 top-3 text-muted hover:text-foreground"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as FilterType)}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground focus:border-brand focus:outline-none"
          >
            <option value="ALL">All Material</option>
            <option value="NOTES">Has Notes</option>
            <option value="PYQS">Has PYQs</option>
          </select>

          {/* Sort selection */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            className="h-10 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-foreground focus:border-brand focus:outline-none"
          >
            <option value="ALPHA">A-Z Name</option>
            <option value="RESOURCES">Most Resources</option>
          </select>
        </div>
      </div>

      {/* Grid of Subject Cards */}
      {filteredSubjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-10 text-center space-y-3">
          <p className="text-sm font-bold text-foreground">No subjects found</p>
          <p className="text-xs text-muted max-w-sm">
            No subjects matched your filter criteria. Try clearing the search or changing your semester selection.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setTypeFilter("ALL");
            }}
            className="rounded-xl bg-surface-muted px-4 py-2 text-xs font-semibold text-foreground hover:bg-border"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleSubjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}

      {/* View All Toggle */}
      {filteredSubjects.length > 6 && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={() => setShowAll(!showAll)}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-6 py-2.5 text-xs font-bold text-foreground hover:border-brand hover:text-brand transition-colors"
          >
            <span>{showAll ? "Show Less" : `View All ${filteredSubjects.length} Subjects`}</span>
            <CaretDown size={14} weight="bold" className={`transition-transform ${showAll ? "rotate-180" : ""}`} />
          </button>
        </div>
      )}
    </section>
  );
}
