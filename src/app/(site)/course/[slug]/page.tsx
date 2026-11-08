import { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle, WarningCircle, Books, Files, ChartBar } from "@phosphor-icons/react/dist/ssr";
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

  const rows: [string, string | number, boolean][] = [
    ["Total Marks", assessment.totalMarks, true],
    [`End-term Theory Exam (${assessment.theoryDuration})`, assessment.theoryMarks, assessment.theoryMarks > 0],
    ["Internal Assessment (IA)", assessment.internalAssess, assessment.internalAssess > 0],
    ["Tutorial Continuous Assessment", assessment.tutorialCa, assessment.tutorialCa > 0],
    ["Practical Continuous Assessment", assessment.practicalCa, assessment.practicalCa > 0],
    ["End-term Practical Exam", assessment.endTermPractical, assessment.endTermPractical > 0],
    ["Viva Voce", assessment.viva, assessment.viva > 0],
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      {/* Course Header */}
      <div className="mb-8 sm:mb-10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent">
            {courseType || "General"}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-3 py-1 text-[12px] font-semibold text-success">
            <CheckCircle size={14} weight="fill" />
            Verified source
          </span>
        </div>
        <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-5xl">{title}</h1>
        <p className="mt-3 text-[15px] text-muted sm:text-[17px]">
          UPC <span className="font-semibold text-foreground">{upcs.join(", ")}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Core Info */}
        <div className="space-y-4 md:col-span-2">
          {/* L-T-P Structure */}
          <div className="rounded-[28px] bg-surface p-5 shadow-[var(--shadow-tile)] sm:p-7">
            <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em] text-foreground">
              <Books size={20} className="text-accent" />
              Course structure
            </h2>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Total", totalCredits, "Credits"],
                ["Theory", structure.theory, ""],
                ["Tutorial", structure.tutorial, ""],
                ["Practical", structure.practical, ""],
              ].map(([label, value, unit]) => (
                <div key={String(label)} className="rounded-[18px] bg-surface-muted p-4 text-center">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</p>
                  <p className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.03em] text-foreground">{value}</p>
                  {unit && <p className="mt-1 text-[12px] text-muted">{unit}</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Assessment Scheme */}
          <div className="rounded-[28px] bg-surface p-5 shadow-[var(--shadow-tile)] sm:p-7">
            <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em] text-foreground">
              <ChartBar size={20} className="text-brand" />
              Assessment scheme (official UGCF)
            </h2>
            <ul className="mt-5 divide-y divide-border/70 overflow-hidden rounded-[18px] bg-surface-muted text-[15px]">
              {rows.filter(([, , show]) => show).map(([label, value], i) => (
                <li key={label} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-muted">{label}</span>
                  <span className={i === 0 ? "font-semibold text-foreground" : "font-medium text-foreground"}>{value}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-2 rounded-[14px] bg-amber-500/10 p-3 text-[13px] leading-snug text-amber-800 dark:text-amber-300">
              <WarningCircle size={16} className="mt-0.5 shrink-0" />
              <span>Assessment marks are strictly mapped from the University-notified UGCF assessment matrix based on the L-T-P structure.</span>
            </p>
          </div>
        </div>

        {/* Action Panel */}
        <div className="space-y-4">
          <div className="rounded-[28px] bg-surface-muted p-5 sm:p-6">
            <h3 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-foreground">
              <Files size={19} className="text-brand" />
              Resources
            </h3>
            <p className="mb-5 mt-2 text-[14px] leading-snug text-muted">
              Prepare for {title} using official DU Previous Year Papers.
            </p>
            <Link
              href={`/papers?q=${encodeURIComponent(title)}`}
              className="flex w-full items-center justify-center rounded-full bg-brand py-3 text-[15px] font-semibold text-brand-foreground transition-colors duration-300 hover:bg-brand-hover"
            >
              Search PYQs
            </Link>
          </div>

          <div className="rounded-[28px] bg-surface-muted p-5 text-[13px] leading-snug text-muted sm:p-6">
            <h4 className="mb-2 text-[15px] font-semibold text-foreground">Source provenance</h4>
            <p className="mb-2">This course record has been extracted directly from the DU Academic Affairs official listings.</p>
            {officialSource && (
              <a href={officialSource} target="_blank" rel="noopener noreferrer" className="block break-all font-medium text-brand hover:underline">
                View official notification →
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
