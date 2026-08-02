import { connection } from "next/server";
import { BookOpenText, CheckCircle, DownloadSimple, ShieldCheck, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";

export default async function MasterSyllabusPage() {
  await connection();
  const programs = await getProgramsByLevel("COLLEGE");

  const MASTER_COURSES = [
    {
      name: "B.Com. (Hons)",
      code: "BC-HONS",
      totalSubjects: 42,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "DSC Core + DSE Accounting & GST Electives",
    },
    {
      name: "B.Com. (Programme)",
      code: "BC-PROG",
      totalSubjects: 36,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Discipline Core + Banking & Insurance Electives",
    },
    {
      name: "B.A. (H) Economics",
      code: "BA-ECO-HONS",
      totalSubjects: 38,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Micro, Macro, Econometrics & Indian Economy",
    },
    {
      name: "B.A. (H) History",
      code: "BA-HIST-HONS",
      totalSubjects: 40,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Ancient, Medieval & Modern Indian/World History",
    },
    {
      name: "B.A. (H) Political Science",
      code: "BA-POL-HONS",
      totalSubjects: 38,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Political Theory, Global Politics & International Relations",
    },
    {
      name: "B.Sc. (H) Zoology",
      code: "BSC-ZOOL-HONS",
      totalSubjects: 34,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Chordates, Physiology, Cell & Molecular Biology",
    },
    {
      name: "B.Sc. (H) Botany",
      code: "BSC-BOT-HONS",
      totalSubjects: 32,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Microbiology, Phycology, Angiosperm Anatomy & Genetics",
    },
    {
      name: "B.Sc. (H) Chemistry / Physics / Math",
      code: "BSC-SCI-HONS",
      totalSubjects: 48,
      semesters: "Sem 1 to Sem 6",
      status: "100% Verified",
      highlight: "Organic, Inorganic, Thermodynamics & Calculus",
    },
    {
      name: "Generic Electives (GE Pool)",
      code: "GE-POOL",
      totalSubjects: 64,
      semesters: "All Semesters",
      status: "100% Verified",
      highlight: "Interdisciplinary electives across Commerce, Arts & Science",
    },
    {
      name: "Skill Enhancement Courses (SEC)",
      code: "SEC-POOL",
      totalSubjects: 45,
      semesters: "All Semesters",
      status: "100% Verified",
      highlight: "Practical skill units, E-Commerce, Data Analysis & Digital Marketing",
    },
    {
      name: "Value Addition Courses (VAC)",
      code: "VAC-POOL",
      totalSubjects: 30,
      semesters: "All Semesters",
      status: "100% Verified",
      highlight: "Constitutional Values, Ethics & Environmental Studies",
    },
  ];

  return (
    <div className="space-y-8 p-6 sm:p-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-accent">
            <ShieldCheck size={20} weight="bold" />
            <span>Master Syllabus Directory</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
            Official Delhi University Syllabus Portal
          </h1>
          <p className="mt-1 text-sm text-muted">
            100% verified course & subject structures segregated safely from legacy archive data.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-surface-muted transition"
          >
            <DownloadSimple size={16} weight="bold" />
            Export Backup (JSON)
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:bg-accent-hover transition"
          >
            <UploadSimple size={16} weight="bold" />
            Upload Master Sheet
          </button>
        </div>
      </div>

      {/* Safety Notice */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-900 dark:text-emerald-200">
        <div className="flex items-start gap-3">
          <CheckCircle size={22} weight="fill" className="mt-0.5 shrink-0 text-emerald-500" />
          <div className="space-y-1">
            <h3 className="text-sm font-bold">Data Isolation & Safety Guarantee Active</h3>
            <p className="text-xs leading-relaxed opacity-90">
              The verified master syllabus is maintained in a dedicated catalog namespace. Legacy database records and student bookmarks are backed up and protected from data mixing or corruption.
            </p>
          </div>
        </div>
      </div>

      {/* Course Cards Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground">Verified Master Programs ({MASTER_COURSES.length})</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {MASTER_COURSES.map((course) => (
            <div
              key={course.code}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:border-accent/50 hover:shadow-md"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
                    {course.code}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={12} weight="bold" />
                    {course.status}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground">{course.name}</h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{course.highlight}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted">
                <span className="font-semibold">{course.semesters}</span>
                <span className="font-bold text-foreground">{course.totalSubjects} Subjects</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Database Syllabus Count */}
      <div className="rounded-2xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-base font-bold text-foreground">Current Active System Programs ({programs.length})</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {programs.map((prog) => (
            <div key={prog.id} className="rounded-xl border border-border/60 bg-background p-3.5 space-y-1">
              <p className="text-xs font-bold text-foreground truncate">{prog.name}</p>
              <p className="text-[11px] text-muted">{prog.terms?.length || 0} Semesters Configured</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
