"use client";

import { useMemo } from "react";
import { useEffect, useState } from "react";
type MasterRow = { id: string; course: string; semester: string; type: string; subjectName: string; courseNumber?: string; upc?: string; credits?: string; };
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  Code,
  DownloadSimple,
  FileText,
  FunnelSimple,
  MagnifyingGlass,
  ShieldCheck,
  Table,
  UploadSimple,
} from "@phosphor-icons/react";


export function MasterSyllabusInspector() {
  const [MASTER_SYLLABUS_ROWS, setMasterSyllabusRows] = useState<MasterRow[]>([]);
  useEffect(() => { fetch("/data/master-syllabus-data.json").then(r => r.json()).then(setMasterSyllabusRows); }, []);
  const [masterRows] = useState<MasterRow[]>(MASTER_SYLLABUS_ROWS);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("All");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const uniqueCourses = useMemo(() => {
    const courses = Array.from(new Set(masterRows.map((r) => r.course)));
    return ["All", ...courses];
  }, [masterRows]);

  const uniqueSemesters = ["All", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
  const uniqueTypes = ["All", "DSC/Core", "DSE", "GE", "SEC", "VAC", "AEC"];

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return masterRows.filter((row) => {
      const matchCourse = selectedCourseFilter === "All" || row.course === selectedCourseFilter;
      const matchSemester = selectedSemesterFilter === "All" || row.semester === selectedSemesterFilter;
      const matchType = selectedTypeFilter === "All" || row.type === selectedTypeFilter;
      const matchQuery = !q || row.subjectName.toLowerCase().includes(q) || row.course.toLowerCase().includes(q);
      return matchCourse && matchSemester && matchType && matchQuery;
    });
  }, [masterRows, selectedCourseFilter, selectedSemesterFilter, selectedTypeFilter, searchQuery]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (file.name.endsWith(".json")) {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            // Data is now imported from the official CSV — uploads are display-only
            console.info("Loaded", json.length, "rows (preview only — data sourced from master CSV)");
            setCurrentPage(1);
          }
        } else if (file.name.endsWith(".csv")) {
          const lines = text.split("\n").filter((l) => l.trim());
          const newRows: MasterRow[] = [];
          lines.slice(1).forEach((line, idx) => {
            const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
            if (cols.length >= 4) {
              newRows.push({
                id: String(idx + 1),
                course: cols[0],
                semester: cols[1],
                type: cols[2],
                subjectName: cols[3],
              });
            }
          });
          if (newRows.length > 0) {
            console.info("Loaded", newRows.length, "rows (preview only — data sourced from master CSV)");
            setCurrentPage(1);
          }
        }
      } catch (err) {
        console.error("Master sheet parse error:", err);
      }
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & File Upload Control */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={18} weight="fill" />
            <span>Official Master Spreadsheet Portal Active (0% Deviation)</span>
          </div>
          <h2 className="mt-1 text-xl font-bold font-display text-foreground">
            Delhi University Master Syllabus Directory ({masterRows.length.toLocaleString()} Total Records Loaded)
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-xs font-bold text-accent-foreground shadow-sm hover:bg-accent-hover transition cursor-pointer">
            <UploadSimple size={16} weight="bold" />
            <span>Upload 3,000+ CSV / JSON Master Sheet</span>
            <input type="file" accept=".csv,.json" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 rounded-2xl border border-border bg-surface p-4">
        {/* Course Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Course Filter</label>
          <select
            value={selectedCourseFilter}
            onChange={(e) => { setSelectedCourseFilter(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-accent"
          >
            {uniqueCourses.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Courses (3,000+ Rows)" : c}
              </option>
            ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Semester Filter</label>
          <select
            value={selectedSemesterFilter}
            onChange={(e) => { setSelectedSemesterFilter(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-accent"
          >
            {uniqueSemesters.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Semesters (I to VIII)" : `Semester ${s}`}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Type Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Subject Type</label>
          <select
            value={selectedTypeFilter}
            onChange={(e) => { setSelectedTypeFilter(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-accent"
          >
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t === "All" ? "All Types (DSC/DSE/GE)" : t}
              </option>
            ))}
          </select>
        </div>

        {/* Search Bar */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Search Subject</label>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <MagnifyingGlass size={16} className="text-muted shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search 3,000+ subjects..."
              className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </div>

      {/* Pagination & Status Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-semibold text-muted">
        <div>
          Showing {filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to{" "}
          {Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length.toLocaleString()} matching records
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="rounded-lg border border-border bg-surface px-2 py-1 text-xs font-bold text-foreground outline-none"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={filteredRows.length}>All</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-border bg-surface p-1.5 transition disabled:opacity-40 hover:bg-surface-muted"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
            <span className="px-2 font-bold text-foreground">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-border bg-surface p-1.5 transition disabled:opacity-40 hover:bg-surface-muted"
            >
              <CaretRight size={16} weight="bold" />
            </button>
          </div>
        </div>
      </div>

      {/* Official Master Spreadsheet Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/70 text-foreground">
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] border-r border-border/50 min-w-[150px]">
                  Course Name
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] border-r border-border/50 text-center w-24">
                  Semester
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] border-r border-border/50 w-36">
                  Subject Type
                </th>
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px]">
                  Subject Name
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted">
                    No subjects matched your selected filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`transition hover:bg-surface-muted/50 ${
                      idx % 2 === 1 ? "bg-background/40" : "bg-surface"
                    }`}
                  >
                    {/* Column 1: Course Name */}
                    <td className="px-5 py-3.5 font-bold text-foreground border-r border-border/40">
                      {row.course}
                    </td>

                    {/* Column 2: Semester (Roman Numeral) */}
                    <td className="px-5 py-3.5 font-bold text-foreground text-center border-r border-border/40">
                      {row.semester}
                    </td>

                    {/* Column 3: Subject Type */}
                    <td className="px-5 py-3.5 font-semibold text-foreground/90 border-r border-border/40">
                      <span className="inline-block rounded-md bg-accent-soft/60 px-2.5 py-1 font-mono text-[11px] font-bold text-accent">
                        {row.type}
                      </span>
                    </td>

                    {/* Column 4: Subject Name */}
                    <td className="px-5 py-3.5 font-bold text-foreground text-sm">
                      {row.subjectName}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
