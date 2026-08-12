"use client";

import { useState, useMemo } from "react";
import { MagnifyingGlass, FileArrowDown, BookOpen, CaretRight, X } from "@phosphor-icons/react";
import type { DuPypPaper, PapersByGrid } from "@/lib/du-pyp-data";

// ─── Types passed from server ────────────────────────────────────────────────

interface Props {
  programmes: string[];
  groupedProgrammes: Record<string, string[]>;
  totalCount: number;
}

const SEMESTER_LABELS: Record<string, string> = {
  I: "Semester I", II: "Semester II", III: "Semester III",
  IV: "Semester IV", V: "Semester V", VI: "Semester VI",
  VII: "Semester VII", VIII: "Semester VIII", Pool: "Pool",
};

const TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  DSC:      { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-500/30" },
  DSE:      { bg: "bg-blue-500/15",   text: "text-blue-300",   border: "border-blue-500/30"   },
  GE:       { bg: "bg-emerald-500/15",text: "text-emerald-300",border: "border-emerald-500/30"},
  AEC:      { bg: "bg-amber-500/15",  text: "text-amber-300",  border: "border-amber-500/30"  },
  SEC:      { bg: "bg-pink-500/15",   text: "text-pink-300",   border: "border-pink-500/30"   },
  VAC:      { bg: "bg-cyan-500/15",   text: "text-cyan-300",   border: "border-cyan-500/30"   },
  "Academic Track":       { bg: "bg-orange-500/15", text: "text-orange-300", border: "border-orange-500/30" },
  "Community Outreach":   { bg: "bg-lime-500/15",   text: "text-lime-300",   border: "border-lime-500/30"   },
  "Compulsory":           { bg: "bg-red-500/15",    text: "text-red-300",    border: "border-red-500/30"    },
};

const TYPE_FULL: Record<string, string> = {
  DSC: "Discipline Specific Core",
  DSE: "Discipline Specific Elective",
  GE:  "Generic Elective",
  AEC: "Ability Enhancement Course",
  SEC: "Skill Enhancement Course",
  VAC: "Value Addition Course",
};

// ─── Main Client Component ────────────────────────────────────────────────────

export function DuPypBrowser({ programmes, groupedProgrammes, totalCount }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [gridData, setGridData] = useState<PapersByGrid | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [activeSem, setActiveSem] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<string | null>(null);

  // Filter programmes by search
  const filteredGroups = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return groupedProgrammes;
    const result: Record<string, string[]> = {};
    for (const [group, progs] of Object.entries(groupedProgrammes)) {
      const filtered = progs.filter((p) => p.toLowerCase().includes(q));
      if (filtered.length) result[group] = filtered;
    }
    return result;
  }, [search, groupedProgrammes]);

  const totalFiltered = useMemo(
    () => Object.values(filteredGroups).flat().length,
    [filteredGroups]
  );

  async function selectProgramme(prog: string) {
    setSelected(prog);
    setActiveSem(null);
    setActiveType(null);
    setLoadingGrid(true);
    try {
      const res = await fetch(`/api/pyp-grid?programme=${encodeURIComponent(prog)}`);
      const data: PapersByGrid = await res.json();
      setGridData(data);
      if (data.semesters.length > 0) setActiveSem(data.semesters[0]);
      if (data.paperTypes.length > 0) setActiveType(data.paperTypes[0]);
    } catch {
      setGridData(null);
    } finally {
      setLoadingGrid(false);
    }
  }

  const activePapers: DuPypPaper[] =
    gridData && activeSem && activeType
      ? (gridData.grid[activeSem]?.[activeType] ?? [])
      : [];

  return (
    <div className="flex flex-col gap-8">

      {/* ── Stats bar ── */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent/70 inline-block" />
          <strong className="text-foreground">{totalCount.toLocaleString()}</strong> total papers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-violet-400/70 inline-block" />
          <strong className="text-foreground">118</strong> official programmes
        </span>
        {Object.entries(TYPE_COLORS).slice(0, 6).map(([type, col]) => (
          <span key={type} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${col.bg} ${col.text} ${col.border}`}>
            {type}
          </span>
        ))}
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">

        {/* ── LEFT: Programme selector ── */}
        <aside className="flex flex-col gap-3">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              type="search"
              placeholder="Search programmes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-surface-muted pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/60"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground">
                <X size={14} />
              </button>
            )}
          </div>

          <p className="text-xs text-muted px-1">
            {totalFiltered} programme{totalFiltered !== 1 ? "s" : ""}
            {search ? ` matching "${search}"` : ""}
          </p>

          {/* Programme groups */}
          <div className="flex flex-col gap-4 max-h-[calc(100vh-280px)] overflow-y-auto pr-1 scrollbar-thin">
            {Object.entries(filteredGroups).map(([group, progs]) => (
              <div key={group}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted/70 px-1">
                  {group}
                </p>
                <div className="flex flex-col gap-0.5">
                  {progs.map((prog) => (
                    <button
                      key={prog}
                      onClick={() => selectProgramme(prog)}
                      className={`group flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition-all duration-150 ${
                        selected === prog
                          ? "bg-accent/20 border border-accent/40 text-foreground font-medium"
                          : "border border-transparent text-muted hover:bg-surface-muted hover:text-foreground"
                      }`}
                    >
                      <CaretRight
                        size={12}
                        className={`shrink-0 transition-transform duration-150 ${selected === prog ? "rotate-90 text-accent" : "text-muted/40 group-hover:text-muted"}`}
                      />
                      <span className="leading-snug">{prog}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {Object.keys(filteredGroups).length === 0 && (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                No programmes match &ldquo;{search}&rdquo;
              </div>
            )}
          </div>
        </aside>

        {/* ── RIGHT: Semester × Paper-type grid ── */}
        <section className="flex flex-col gap-5">
          {!selected && (
            <div className="flex h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface-muted/50 text-center">
              <BookOpen size={36} className="text-muted/40" />
              <p className="text-sm text-muted max-w-xs leading-relaxed">
                Select a programme from the left to see its semester-wise papers organised by type.
              </p>
            </div>
          )}

          {selected && (
            <>
              {/* Programme header */}
              <div className="rounded-xl border border-border bg-surface-muted/60 px-5 py-4">
                <p className="text-xs text-muted font-medium uppercase tracking-widest mb-1">Selected Programme</p>
                <h2 className="text-lg font-semibold text-foreground">{selected}</h2>
              </div>

              {loadingGrid && (
                <div className="grid grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-24 rounded-xl bg-surface-muted/60 animate-pulse border border-border/40" />
                  ))}
                </div>
              )}

              {!loadingGrid && gridData && (
                <>
                  {/* Semester tabs (horizontal scroll) */}
                  <div className="overflow-x-auto pb-1">
                    <div className="flex gap-2 min-w-max">
                      {gridData.semesters.map((sem) => {
                        const semPaperCount = Object.values(gridData.grid[sem] ?? {}).flat().length;
                        return (
                          <button
                            key={sem}
                            onClick={() => { setActiveSem(sem); setActiveType(gridData.paperTypes[0] ?? null); }}
                            className={`flex flex-col items-center gap-1 rounded-xl border px-4 py-3 transition-all duration-150 min-w-[100px] ${
                              activeSem === sem
                                ? "border-accent/60 bg-accent/15 text-foreground"
                                : "border-border bg-surface-muted/50 text-muted hover:border-border/80 hover:bg-surface-muted hover:text-foreground"
                            }`}
                          >
                            <span className="text-xs font-semibold uppercase tracking-wider">
                              {SEMESTER_LABELS[sem] ?? sem}
                            </span>
                            <span className="text-lg font-bold">{semPaperCount}</span>
                            <span className="text-[10px] text-muted/70">papers</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Paper type pills */}
                  {activeSem && (
                    <div className="flex flex-wrap gap-2">
                      {gridData.paperTypes.map((type) => {
                        const count = gridData.grid[activeSem]?.[type]?.length ?? 0;
                        if (count === 0) return null;
                        const col = TYPE_COLORS[type] ?? TYPE_COLORS["DSC"];
                        return (
                          <button
                            key={type}
                            onClick={() => setActiveType(type)}
                            className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                              activeType === type
                                ? `${col.bg} ${col.text} ${col.border} shadow-sm`
                                : "border-border bg-surface-muted text-muted hover:border-border/80 hover:text-foreground"
                            }`}
                          >
                            <span>{type}</span>
                            <span className={`ml-0.5 rounded-full px-1.5 py-px text-[10px] font-bold ${activeType === type ? col.text : "text-muted"}`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Paper type full label */}
                  {activeType && (
                    <p className="text-xs text-muted">
                      <strong className="text-foreground">{activeType}</strong>
                      {TYPE_FULL[activeType] ? ` — ${TYPE_FULL[activeType]}` : ""}
                    </p>
                  )}

                  {/* Papers list */}
                  {activePapers.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {activePapers.map((paper, i) => (
                        <div
                          key={i}
                          className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface-muted/40 px-4 py-3.5 hover:border-border/80 hover:bg-surface-muted/70 transition-all duration-150"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex flex-col gap-1 min-w-0">
                              <p className="text-sm font-medium text-foreground leading-snug">
                                {paper.canonicalName || paper.subjectName}
                              </p>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                                {paper.courseNumber && (
                                  <span className="font-mono">{paper.courseNumber}</span>
                                )}
                                {paper.credits && (
                                  <span>{paper.credits} credits</span>
                                )}
                                {paper.upc && (
                                  <span className="font-mono text-muted/60">UPC: {paper.upc}</span>
                                )}
                              </div>
                            </div>
                            {paper.officialLink && (
                              <a
                                href={paper.officialLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted hover:border-accent/50 hover:text-accent transition-all duration-150"
                              >
                                <FileArrowDown size={14} />
                                Syllabus
                              </a>
                            )}
                          </div>

                          {paper.examPapers.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {(() => {
                                const seenLabels = new Map<string, number>();
                                return paper.examPapers.map((exam, j) => {
                                  const baseLabel = `${exam.year ?? "Paper"}${
                                    exam.set && exam.set.toUpperCase() !== "SET-1" ? ` (${exam.set})` : ""
                                  }`;
                                  const occurrence = (seenLabels.get(baseLabel) ?? 0) + 1;
                                  seenLabels.set(baseLabel, occurrence);
                                  const label = occurrence > 1 ? `${baseLabel} #${occurrence}` : baseLabel;
                                  const isShiv = exam.isShivaji || exam.college === "Shivaji";
                                  const isKal = exam.isKalindi || exam.college === "Kalindi";
                                  const isAnd = exam.isANDC || exam.college === "ANDC";
                                  const isRam = (exam as any).isRamanujan || exam.college === "Ramanujan";
                                  const collegeTitle = isShiv ? "Shivaji College Archive" : isKal ? "Kalindi College Archive" : isAnd ? "Acharya Narendra Dev College (ANDC) Archive" : isRam ? "Ramanujan College Archive" : null;

                                  return (
                                    <a
                                      key={j}
                                      href={exam.link}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={[exam.session, exam.set, exam.marks ? `${exam.marks} marks` : null, collegeTitle].filter(Boolean).join(" · ")}
                                      className="flex items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-[11px] font-semibold text-accent hover:border-accent/60 hover:bg-accent/20 transition-all duration-150"
                                    >
                                      <FileArrowDown size={11} />
                                      {label}
                                      {isShiv && (
                                        <span 
                                          className="ml-1 px-1 py-px text-[9px] font-black tracking-tight rounded-sm bg-emerald-500 text-emerald-950 uppercase"
                                          title="Shivaji College Archive"
                                        >
                                          S
                                        </span>
                                      )}
                                      {isKal && (
                                        <span 
                                          className="ml-1 px-1 py-px text-[9px] font-black tracking-tight rounded-sm bg-rose-500 text-white uppercase"
                                          title="Kalindi College Archive"
                                        >
                                          K
                                        </span>
                                      )}
                                      {isAnd && (
                                        <span 
                                          className="ml-1 px-1 py-px text-[9px] font-black tracking-tight rounded-sm bg-blue-500 text-white uppercase"
                                          title="Acharya Narendra Dev College (ANDC) Archive"
                                        >
                                          A
                                        </span>
                                      )}
                                      {isRam && (
                                        <span 
                                          className="ml-1 px-1 py-px text-[9px] font-black tracking-tight rounded-sm bg-amber-500 text-amber-950 uppercase"
                                          title="Ramanujan College Archive"
                                        >
                                          R
                                        </span>
                                      )}
                                    </a>
                                  );
                                });
                              })()}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted/60 italic">No exam paper on file yet — syllabus only</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    activeSem && activeType && (
                      <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-6 text-center text-sm text-muted">
                        No papers for {SEMESTER_LABELS[activeSem]} → {activeType}
                      </div>
                    )
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
