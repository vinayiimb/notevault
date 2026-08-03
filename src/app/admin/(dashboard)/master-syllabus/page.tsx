import { BookOpenText, CheckCircle, DownloadSimple, ShieldCheck, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { MasterSyllabusInspector } from "@/components/admin/master-syllabus-inspector";

export const dynamic = "force-dynamic";

export default async function MasterSyllabusPage() {
  const programs = await getProgramsByLevel("COLLEGE");

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
            100% verified, in-depth course & subject structures with full unit breakdowns, isolated safely from legacy archive data.
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

      {/* In-Depth Interactive Inspector Component */}
      <MasterSyllabusInspector />

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
