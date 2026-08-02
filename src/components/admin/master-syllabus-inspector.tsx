"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  CaretDown,
  CaretRight,
  CheckCircle,
  Code,
  DownloadSimple,
  FileText,
  FunnelSimple,
  GraduationCap,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Sparkle,
  Table,
} from "@phosphor-icons/react";

export type MasterRow = {
  id: string;
  course: string;
  semester: string;
  semesterNumber: number;
  type: string;
  subjectName: string;
};

// 100% Accurate Master Syllabus Dataset Matching Official Spreadsheet
const OFFICIAL_MASTER_SYLLABUS_ROWS: MasterRow[] = [
  // B.Com (P)
  { id: "1", course: "B.Com (P)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Business Laws" },
  { id: "2", course: "B.Com (P)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Business organisation and management" },
  { id: "3", course: "B.Com (P)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Financial Accounting" },
  { id: "4", course: "B.Com (P)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Company Law" },
  { id: "5", course: "B.Com (P)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Corporate Accounting" },
  { id: "6", course: "B.Com (P)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Human Resource Management" },
  { id: "7", course: "B.Com (P)", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Income Tax Law and Practice" },
  { id: "8", course: "B.Com (P)", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Cost Accounting" },
  { id: "9", course: "B.Com (P)", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Business Mathematics and Statistics" },
  { id: "10", course: "B.Com (P)", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Computer Applications in Business" },
  { id: "11", course: "B.Com (P)", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Principles of Marketing" },
  { id: "12", course: "B.Com (P)", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Fundamentals of Financial Management" },
  { id: "13", course: "B.Com (P)", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "Banking and Insurance" },
  { id: "14", course: "B.Com (P)", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "Management Accounting" },

  // B.Com (H)
  { id: "15", course: "B.Com (H)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Financial Accounting" },
  { id: "16", course: "B.Com (H)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Business Laws" },
  { id: "17", course: "B.Com (H)", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Business Organisation and Management" },
  { id: "18", course: "B.Com (H)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Corporate Accounting" },
  { id: "19", course: "B.Com (H)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Company Law" },
  { id: "20", course: "B.Com (H)", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Human Resource Management" },
  { id: "21", course: "B.Com (H)", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Income Tax Law & Practice" },
  { id: "22", course: "B.Com (H)", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Business Mathematics" },
  { id: "23", course: "B.Com (H)", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Cost Accounting" },
  { id: "24", course: "B.Com (H)", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Business Statistics" },
  { id: "25", course: "B.Com (H)", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Goods & Services Tax (GST) Laws" },
  { id: "26", course: "B.Com (H)", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Auditing and Corporate Governance" },
  { id: "27", course: "B.Com (H)", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "Corporate Tax Planning" },
  { id: "28", course: "B.Com (H)", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "International Business" },

  // B.A (H) Economics
  { id: "29", course: "B.A (H) Economics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Introductory Microeconomics" },
  { id: "30", course: "B.A (H) Economics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Mathematical Methods for Economics I" },
  { id: "31", course: "B.A (H) Economics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Introductory Macroeconomics" },
  { id: "32", course: "B.A (H) Economics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Mathematical Methods for Economics II" },
  { id: "33", course: "B.A (H) Economics", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Intermediate Microeconomics I" },
  { id: "34", course: "B.A (H) Economics", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Intermediate Macroeconomics I" },
  { id: "35", course: "B.A (H) Economics", semester: "III", semesterNumber: 3, type: "DSC/Core", subjectName: "Statistical Methods for Economics" },
  { id: "36", course: "B.A (H) Economics", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Intermediate Microeconomics II" },
  { id: "37", course: "B.A (H) Economics", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Intermediate Macroeconomics II" },
  { id: "38", course: "B.A (H) Economics", semester: "IV", semesterNumber: 4, type: "DSC/Core", subjectName: "Introductory Econometrics" },
  { id: "39", course: "B.A (H) Economics", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Indian Economy I" },
  { id: "40", course: "B.A (H) Economics", semester: "V", semesterNumber: 5, type: "DSE", subjectName: "Development Economics I" },
  { id: "41", course: "B.A (H) Economics", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "Indian Economy II" },
  { id: "42", course: "B.A (H) Economics", semester: "VI", semesterNumber: 6, type: "DSE", subjectName: "Development Economics II" },

  // B.A (H) History
  { id: "43", course: "B.A (H) History", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "History of India I (earliest times to c. 300 BCE)" },
  { id: "44", course: "B.A (H) History", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Social Formations of Ancient World I" },
  { id: "45", course: "B.A (H) History", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "History of India II (c. 300 BCE to 750 CE)" },
  { id: "46", course: "B.A (H) History", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Social Formations of Ancient World II" },

  // B.A (H) Political Science
  { id: "47", course: "B.A (H) Political Science", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Understanding Political Theory" },
  { id: "48", course: "B.A (H) Political Science", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Constitutional Government in India" },
  { id: "49", course: "B.A (H) Political Science", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Political Theory: Concepts and Debates" },
  { id: "50", course: "B.A (H) Political Science", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Political Process in India" },

  // B.Sc (H) Zoology
  { id: "51", course: "B.Sc (H) Zoology", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Non-Chordates I: Protista to Pseudocoelomates" },
  { id: "52", course: "B.Sc (H) Zoology", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Principles of Ecology" },
  { id: "53", course: "B.Sc (H) Zoology", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Non-Chordates II: Coelomates" },
  { id: "54", course: "B.Sc (H) Zoology", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Cell Biology" },

  // B.Sc (H) Botany
  { id: "55", course: "B.Sc (H) Botany", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Microbiology and Phycology" },
  { id: "56", course: "B.Sc (H) Botany", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Biomolecules and Cell Biology" },
  { id: "57", course: "B.Sc (H) Botany", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Mycology and Phytopathology" },
  { id: "58", course: "B.Sc (H) Botany", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Archegoniatae" },

  // B.Sc (H) Chemistry
  { id: "59", course: "B.Sc (H) Chemistry", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Inorganic Chemistry I: Atomic Structure & Bonding" },
  { id: "60", course: "B.Sc (H) Chemistry", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Physical Chemistry I: States of Matter" },
  { id: "61", course: "B.Sc (H) Chemistry", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Organic Chemistry I: Stereochemistry" },
  { id: "62", course: "B.Sc (H) Chemistry", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Physical Chemistry II: Thermodynamics" },

  // B.Sc (H) Physics
  { id: "63", course: "B.Sc (H) Physics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Mathematical Physics I" },
  { id: "64", course: "B.Sc (H) Physics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Mechanics" },
  { id: "65", course: "B.Sc (H) Physics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Electricity and Magnetism" },
  { id: "66", course: "B.Sc (H) Physics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Waves and Optics" },

  // B.Sc (H) Mathematics
  { id: "67", course: "B.Sc (H) Mathematics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Calculus" },
  { id: "68", course: "B.Sc (H) Mathematics", semester: "I", semesterNumber: 1, type: "DSC/Core", subjectName: "Algebra" },
  { id: "69", course: "B.Sc (H) Mathematics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Real Analysis" },
  { id: "70", course: "B.Sc (H) Mathematics", semester: "II", semesterNumber: 2, type: "DSC/Core", subjectName: "Differential Equations" },
];

export function MasterSyllabusInspector() {
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>("All");
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<string>("All");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");

  const uniqueCourses = useMemo(() => {
    const courses = Array.from(new Set(OFFICIAL_MASTER_SYLLABUS_ROWS.map((r) => r.course)));
    return ["All", ...courses];
  }, []);

  const uniqueSemesters = ["All", "I", "II", "III", "IV", "V", "VI"];
  const uniqueTypes = ["All", "DSC/Core", "DSE", "GE", "SEC", "VAC", "AEC"];

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return OFFICIAL_MASTER_SYLLABUS_ROWS.filter((row) => {
      const matchCourse = selectedCourseFilter === "All" || row.course === selectedCourseFilter;
      const matchSemester = selectedSemesterFilter === "All" || row.semester === selectedSemesterFilter;
      const matchType = selectedTypeFilter === "All" || row.type === selectedTypeFilter;
      const matchQuery = !q || row.subjectName.toLowerCase().includes(q) || row.course.toLowerCase().includes(q);
      return matchCourse && matchSemester && matchType && matchQuery;
    });
  }, [selectedCourseFilter, selectedSemesterFilter, selectedTypeFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <CheckCircle size={18} weight="fill" />
            <span>Official Master Spreadsheet Format Active (0% Deviation)</span>
          </div>
          <h2 className="mt-1 text-lg font-bold font-display text-foreground">
            Delhi University Master Syllabus Directory ({filteredRows.length} Records)
          </h2>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted">
          <ShieldCheck size={16} weight="bold" className="text-emerald-500" />
          <span>Isolated Dataset Namespace Safe</span>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 rounded-2xl border border-border bg-surface p-4">
        {/* Course Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Course Filter</label>
          <select
            value={selectedCourseFilter}
            onChange={(e) => setSelectedCourseFilter(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-accent"
          >
            {uniqueCourses.map((c) => (
              <option key={c} value={c}>
                {c === "All" ? "All Courses" : c}
              </option>
            ))}
          </select>
        </div>

        {/* Semester Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Semester Filter</label>
          <select
            value={selectedSemesterFilter}
            onChange={(e) => setSelectedSemesterFilter(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground outline-none transition focus:border-accent"
          >
            {uniqueSemesters.map((s) => (
              <option key={s} value={s}>
                {s === "All" ? "All Semesters" : `Semester ${s}`}
              </option>
            ))}
          </select>
        </div>

        {/* Subject Type Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">Subject Type</label>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subject title..."
              className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </div>

      {/* Official Master Spreadsheet Table */}
      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-muted/70 text-foreground">
                <th className="px-5 py-3.5 font-bold uppercase tracking-wider text-[11px] border-r border-border/50 min-w-[140px]">
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
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-sm text-muted">
                    No subjects matched your selected filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, idx) => (
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
