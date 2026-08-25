import { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpenText, CheckCircle, WarningCircle, Books, Files, ChartBar } from "@phosphor-icons/react/dist/ssr";
import fs from "fs";
import path from "path";
import Link from "next/link";

interface Props {
  params: Promise<{ slug: string }>;
}

function getCourses() {
  const filePath = path.join(process.cwd(), "public/data/du-courses-catalog.json");
  if (!fs.existsSync(filePath)) return [];
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const courses = getCourses();
  const course = courses.find((c: any) => c.slug === resolvedParams.slug);

  if (!course) return { title: "Course Not Found" };

  return {
    title: `${course.title} | DU Course Intelligence`,
    description: `Structure, Assessment rules, and resources for ${course.title} (${course.upcs.join(", ")}).`,
  };
}

export default async function CoursePage({ params }: Props) {
  const resolvedParams = await params;
  const courses = getCourses();
  const course = courses.find((c: any) => c.slug === resolvedParams.slug);

  if (!course) {
    notFound();
  }

  const { title, courseType, totalCredits, upcs, structure, assessment, officialSource } = course;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      {/* Course Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center rounded-md bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider text-accent">
            {courseType || "General"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
            <CheckCircle size={14} weight="fill" />
            Verified Source
          </span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-3">{title}</h1>
        <p className="text-sm font-medium text-muted">
          UPC: <span className="font-bold text-foreground">{upcs.join(", ")}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Core Info */}
        <div className="md:col-span-2 space-y-6">
          {/* L-T-P Structure */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase mb-4 flex items-center gap-2">
              <Books size={18} className="text-accent" />
              Course Structure
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-3 bg-surface-muted rounded-xl">
                <p className="text-[10px] font-bold uppercase text-muted tracking-wider mb-1">Total</p>
                <p className="text-2xl font-black text-foreground">{totalCredits}</p>
                <p className="text-[10px] text-muted">Credits</p>
              </div>
              <div className="text-center p-3 bg-surface-muted rounded-xl">
                <p className="text-[10px] font-bold uppercase text-muted tracking-wider mb-1">Theory</p>
                <p className="text-2xl font-black text-foreground">{structure.theory}</p>
              </div>
              <div className="text-center p-3 bg-surface-muted rounded-xl">
                <p className="text-[10px] font-bold uppercase text-muted tracking-wider mb-1">Tutorial</p>
                <p className="text-2xl font-black text-foreground">{structure.tutorial}</p>
              </div>
              <div className="text-center p-3 bg-surface-muted rounded-xl">
                <p className="text-[10px] font-bold uppercase text-muted tracking-wider mb-1">Practical</p>
                <p className="text-2xl font-black text-foreground">{structure.practical}</p>
              </div>
            </div>
          </div>

          {/* Assessment Scheme */}
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <h2 className="text-sm font-bold tracking-wide text-foreground uppercase mb-4 flex items-center gap-2">
              <ChartBar size={18} className="text-brand" />
              Assessment Scheme (Official UGCF)
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-muted">Total Marks</span>
                <span className="font-bold text-foreground">{assessment.totalMarks}</span>
              </div>
              {assessment.theoryMarks > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">End-term Theory Exam ({assessment.theoryDuration})</span>
                  <span className="font-semibold text-foreground">{assessment.theoryMarks}</span>
                </div>
              )}
              {assessment.internalAssess > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">Internal Assessment (IA)</span>
                  <span className="font-semibold text-foreground">{assessment.internalAssess}</span>
                </div>
              )}
              {assessment.tutorialCa > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">Tutorial Continuous Assessment</span>
                  <span className="font-semibold text-foreground">{assessment.tutorialCa}</span>
                </div>
              )}
              {assessment.practicalCa > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">Practical Continuous Assessment</span>
                  <span className="font-semibold text-foreground">{assessment.practicalCa}</span>
                </div>
              )}
              {assessment.endTermPractical > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">End-term Practical Exam</span>
                  <span className="font-semibold text-foreground">{assessment.endTermPractical}</span>
                </div>
              )}
              {assessment.viva > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-border">
                  <span className="text-muted">Viva Voce</span>
                  <span className="font-semibold text-foreground">{assessment.viva}</span>
                </div>
              )}
            </div>
            <p className="text-[11px] text-muted mt-4 bg-yellow-50 p-2 rounded-lg border border-yellow-200 text-yellow-800 flex gap-2">
              <WarningCircle size={14} className="shrink-0 mt-0.5" />
              <span>Assessment marks are strictly mapped from the University-notified UGCF assessment matrix based on the L-T-P structure.</span>
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-border bg-brand-soft/20 p-5 shadow-sm">
            <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
              <Files size={18} className="text-brand" />
              Resources
            </h3>
            <p className="text-xs text-muted mb-4">
              Prepare for {title} using official DU Previous Year Papers.
            </p>
            <Link
              href={`/papers?q=${encodeURIComponent(title)}`}
              className="flex w-full items-center justify-center rounded-xl bg-brand py-2.5 text-sm font-bold text-brand-foreground transition hover:bg-brand-hover shadow-sm"
            >
              Search PYQs
            </Link>
          </div>

          <div className="rounded-2xl border border-border bg-surface-muted/50 p-5 shadow-sm text-xs text-muted">
            <h4 className="font-bold text-foreground mb-2 text-sm">Source Provenance</h4>
            <p className="mb-2">This course record has been extracted directly from the DU Academic Affairs official listings.</p>
            {officialSource && (
              <a href={officialSource} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-all block">
                View Official Notification →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
