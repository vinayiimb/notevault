import type { Metadata } from "next";
import Link from "next/link";
import { JAM_UNITS } from "@/lib/jam-economics";
import { loadJamQuestions } from "@/lib/jam-economics-data";
import { JAM_EN_SYLLABUS } from "@/data/jam-economics/syllabus";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { JamNav } from "@/components/jam/jam-nav";
import { JamFaqs } from "@/components/jam/jam-faqs";

export const metadata: Metadata = {
  title: "IIT JAM Economics Syllabus 2027 — Topic-wise Weightage from PYQs",
  description:
    "IIT JAM Economics (EN) syllabus with topic-wise weightage from 300 previous year questions (2021–2025): how many questions each unit and topic gets every year, plus the official JAM 2027 syllabus.",
  alternates: { canonical: "/jameco/syllabus" },
};

export const dynamic = "force-static";

// Pastel band per unit, like a tinted section column.
const UNIT_TINT: Record<string, string> = {
  Mathematics: "bg-sky-50",
  Statistics: "bg-amber-50",
  Microeconomics: "bg-rose-50",
  Macroeconomics: "bg-violet-50",
  "Indian Economy": "bg-emerald-50",
};

const pct = (n: number, d: number) => Math.round((n / d) * 100);
const analyserLink = (unit: string, topic?: string) =>
  `/jameco?${new URLSearchParams(topic ? { unit, topic } : { unit }).toString()}`;

export default function JamSyllabusPage() {
  const questions = loadJamQuestions();
  const years = [...new Set(questions.map((q) => q.year))].sort();
  const total = questions.length;
  const lastYear = years.at(-1)!;

  const units = JAM_UNITS.map((unit) => {
    const qs = questions.filter((q) => q.unit === unit);
    const topics = [...new Set(qs.map((q) => q.topic))]
      .map((topic) => {
        const tq = qs.filter((q) => q.topic === topic);
        return { topic, total: tq.length, byYear: years.map((y) => tq.filter((q) => q.year === y).length) };
      })
      .sort((a, b) => b.total - a.total || a.topic.localeCompare(b.topic));
    const types = (["MCQ", "MSQ", "NAT"] as const).map((t) => [t, qs.filter((q) => q.type === t).length] as const);
    const syllabus = JAM_EN_SYLLABUS.find((s) => s.unit === unit)!;
    return { unit, title: syllabus.title, syllabus, count: qs.length, lastYearCount: qs.filter((q) => q.year === lastYear).length, topics, types };
  });
  const maxTopic = Math.max(...units.flatMap((u) => u.topics.map((t) => t.total)));
  const ranked = [...units].sort((a, b) => b.count - a.count);
  const indian = units.find((u) => u.unit === "Indian Economy")!;

  const faqs = [
    {
      q: "Which unit carries the most weightage in JAM Economics?",
      a: `${ranked[0].title} has the most questions: ${ranked[0].count} of the ${total} analysed (${pct(ranked[0].count, total)}%), followed by ${ranked[1].title} (${ranked[1].count}) and ${ranked[2].title} (${ranked[2].count}). ${ranked[4].title} is the smallest unit with ${ranked[4].count} questions.`,
    },
    {
      q: "Can I skip Indian Economy for JAM Economics?",
      a: `It is the smallest unit, ${indian.count} of ${total} questions (about ${Math.round(indian.count / years.length)} a year), so it should not come first. But these are mostly short recall questions on plans, reforms, poverty and public finance that take seconds to answer, so dropping the unit gives away easy marks. Revise its high-frequency topics: ${indian.topics
        .slice(0, 3)
        .map((t) => t.topic)
        .join(", ")}.`,
    },
    {
      q: "In what order should I complete the JAM Economics syllabus?",
      a: "Follow dependency order: Mathematics first (functions, calculus, matrices, optimization), then Statistics (probability, distributions, estimation, regression), then Microeconomics and Macroeconomics, which use both, and Indian Economy alongside as regular reading. Within each unit start with the highest-weightage topics in the table above.",
    },
    {
      q: "How many MCQ, MSQ and NAT questions come from each unit?",
      a: units.map((u) => `${u.title}: ${u.types.map(([t, n]) => `${n} ${t}`).join(", ")}`).join(". ") + ".",
    },
    {
      q: "Is this weightage based on the new JAM 2027 syllabus?",
      a: `Yes. Every one of the ${total} questions from JAM ${years[0]}–${lastYear} is tagged to a unit and topic of the JAM 2027 Economics syllabus, so the table shows how often each part of the current syllabus has actually been asked.`,
    },
    {
      q: "Where can I practise these questions topic-wise?",
      a: "Open the PYQ Analyser on this site and filter by year, question type, unit or topic. Every question has a full step-by-step solution, and MCQ, MSQ and NAT answers can be checked before the solution is shown.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-3 pb-12 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "IIT JAM Economics", url: "/jameco" },
          { name: "Syllabus", url: "/jameco/syllabus" },
        ]}
      />
      <JamNav active="/jameco/syllabus" />
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">IIT JAM Economics Syllabus</h1>
      <p className="mt-1 text-sm text-muted">
        {total} questions from {years.length} previous year papers ({years[0]}–{lastYear}), tagged by syllabus unit and topic.
      </p>

      <h2 className="mb-3 mt-7 text-lg font-semibold text-foreground">Topic-wise weightage</h2>
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-sm sm:min-w-[720px]">
          <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
            <tr>
              <th colSpan={2} className="px-3 py-2.5 text-left font-medium">
                Topic
              </th>
              {years.map((y) => (
                <th key={y} className="hidden w-16 border-l border-border px-2 py-2.5 text-center font-medium sm:table-cell">
                  {y}
                </th>
              ))}
              <th className="w-20 border-l border-border px-2 py-2.5 text-center font-medium sm:w-28">Total</th>
            </tr>
          </thead>
          {units.map((u) => (
            <tbody key={u.unit} className="border-t border-border">
              {u.topics.map((t, i) => (
                <tr key={t.topic} className="border-t border-border/60 first:border-t-0">
                  {i === 0 && (
                    <th rowSpan={u.topics.length} scope="rowgroup" className={`w-9 border-r border-border p-0 ${UNIT_TINT[u.unit]}`}>
                      <Link
                        href={analyserLink(u.unit)}
                        className="mx-auto block w-fit rotate-180 py-2 text-xs font-medium text-foreground [writing-mode:vertical-rl] hover:underline"
                      >
                        {u.unit}
                      </Link>
                    </th>
                  )}
                  <td className="px-3 py-2">
                    <Link href={analyserLink(u.unit, t.topic)} className="font-medium text-foreground hover:underline">
                      {t.topic}
                    </Link>
                  </td>
                  {t.byYear.map((n, yi) => (
                    <td key={years[yi]} className="hidden border-l border-border/60 px-2 py-2 text-center text-muted sm:table-cell">
                      {n || ""}
                    </td>
                  ))}
                  <td className="relative border-l border-border/60 p-0">
                    <span className="absolute inset-y-0 left-0 bg-red-400/90" style={{ width: `${(t.total / maxTopic) * 100}%` }} aria-hidden />
                    <span className="relative block px-2 py-2 text-center font-semibold text-foreground">{t.total}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="mt-2 text-xs text-muted">Tap a topic or unit to practise those questions in the PYQ Analyser. Year-by-year counts show on larger screens.</p>

      <article className="mt-12 border-t border-border pt-8 text-[15px] leading-relaxed text-muted">
        <h2 className="text-xl font-semibold text-foreground">IIT JAM Economics Syllabus &amp; Topic-Wise Weightage</h2>
        <p className="mt-3">
          This syllabus breakdown is built from a question-by-question analysis of {years.length} JAM Economics papers ({years[0]} to {lastYear}),{" "}
          {total} questions in total. Each question is tagged to a unit and a topic of the JAM 2027 syllabus, so the weightage reflects what the
          exam has actually asked rather than a generic topic list.
        </p>
        <p className="mt-3">
          The paper draws its questions from {units.length} units:{" "}
          {ranked.map((u, i) => (
            <span key={u.unit}>
              {i ? (i === ranked.length - 1 ? " and " : ", ") : ""}
              {u.title} ({u.count} questions)
            </span>
          ))}
          . Each year&apos;s paper has 60 questions for 100 marks: 30 MCQs, 10 MSQs and 20 numerical-answer (NAT) questions.
        </p>

        {units.map((u) => {
          const top = u.topics.slice(0, 5);
          const rest = u.topics.slice(5);
          return (
            <section key={u.unit} className="mt-8">
              <h3 className="text-[17px] font-semibold text-foreground">IIT JAM {u.title} Syllabus</h3>
              <p className="mt-2">
                {u.title} accounts for {u.count} of the {total} questions analysed, around {pct(u.count, total)}% of the paper across {years[0]} to{" "}
                {lastYear}. In {lastYear} alone it contributed {u.lastYearCount} questions. By type: {u.types.map(([t, n]) => `${n} ${t}`).join(", ")}.
              </p>
              <p className="mt-2">These topics carry the most weightage within the unit:</p>
              <ul className="mt-1 list-disc space-y-1 pl-6">
                {top.map((t) => (
                  <li key={t.topic}>
                    <strong className="font-semibold text-foreground">{t.topic}</strong>: {t.total} questions, around {pct(t.total, u.count)}% of the unit
                  </li>
                ))}
              </ul>
              {rest.length > 0 && (
                <p className="mt-2">
                  The remaining {rest.reduce((n, t) => n + t.total, 0)} questions are spread across {rest.map((t) => t.topic).join(", ")}.
                </p>
              )}
              <details className="group mt-3 rounded-xl border border-border bg-surface px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-medium text-foreground">
                  Official JAM 2027 syllabus: {u.title} <span className="text-muted group-open:hidden">(show)</span>
                </summary>
                <dl className="mt-3 space-y-3 text-sm">
                  {u.syllabus.parts.map((p) => (
                    <div key={p.heading}>
                      <dt className="font-semibold text-foreground">{p.heading}</dt>
                      <dd className="mt-0.5">{p.text}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </section>
          );
        })}

        <h3 className="mt-8 text-[17px] font-semibold text-foreground">How to use the JAM Economics syllabus weightage</h3>
        <p className="mt-2">
          Start with the highest-weightage topics in each unit, since they decide the largest share of marks and keep coming back. Use the year
          columns in the table to check whether a topic is gaining or losing weight before you commit study time to it. Once the high-yield topics
          feel comfortable, cover the lower-weightage ones so nothing in the paper surprises you.
        </p>
        <p className="mt-2">
          The most useful next step is to solve the same questions: every paper behind these numbers is solved step by step in the{" "}
          <Link href="/jameco" className="font-medium text-foreground underline underline-offset-2">
            JAM Economics PYQ Analyser
          </Link>
          , where you can filter by year, question type, unit and topic. To see what score you need, check the{" "}
          <Link href="/jameco/cutoff" className="font-medium text-foreground underline underline-offset-2">
            JAM Economics cutoffs
          </Link>
          .
        </p>
      </article>

      <div className="mt-12">
        <JamFaqs faqs={faqs} />
      </div>
    </div>
  );
}
