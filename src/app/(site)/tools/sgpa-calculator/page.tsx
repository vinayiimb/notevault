import type { Metadata } from "next";
import Link from "next/link";
import SgpaCalculator from "@/components/tools/sgpa-calculator";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { computeCGPA, getAllGradeThresholds } from "@/lib/calculator";
import { OG_IMAGES, faqJsonLd, type Faq } from "@/lib/seo";

const title = "DU SGPA Calculator (Credits & Grade Points)";
const description =
  "Free DU SGPA calculator: enter each paper's credits and grade point to get your semester SGPA instantly, with the DU 10-point grade table and the formula.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tools/sgpa-calculator" },
  openGraph: { title, description, type: "website", images: OG_IMAGES },
};

// A worked example; the SGPA is computed below with the same function the calculator uses.
const EXAMPLE = [
  { name: "DSC 1", credits: 4, gradePoint: 9 },
  { name: "DSC 2", credits: 4, gradePoint: 8 },
  { name: "DSC 3", credits: 4, gradePoint: 8 },
  { name: "SEC", credits: 2, gradePoint: 10 },
  { name: "VAC", credits: 2, gradePoint: 8 },
  { name: "AEC", credits: 2, gradePoint: 9 },
];
const example = computeCGPA(EXAMPLE.map((p, i) => ({ ...p, id: String(i) })));

const FAQS: Faq[] = [
  {
    q: "What is SGPA in Delhi University?",
    a: "SGPA (Semester Grade Point Average) is the credit-weighted average of the grade points you earn in the papers of one semester. A 4-credit paper counts twice as much as a 2-credit paper.",
  },
  {
    q: "How do I calculate my SGPA?",
    a: "Multiply each paper's credits by its grade point, add those products together, then divide by the total credits of the semester: SGPA = Σ(credits × grade point) ÷ Σ credits.",
  },
  {
    q: "Where do I find my credits and grade points?",
    a: "Your Statement of Marks lists them for every paper, in the CRDT (credits) and GRPT (grade point) columns. Enter those two numbers for each paper in the calculator above.",
  },
  {
    q: "What is the difference between SGPA and CGPA?",
    a: "SGPA covers a single semester. CGPA applies the same credit-weighted average across every semester you have completed, so each paper counts by its credits.",
  },
  {
    q: "Which papers move my SGPA the most?",
    a: "The ones with the most credits. Raising a 4-credit paper by one grade point lifts your SGPA twice as much as raising a 2-credit paper by one grade point.",
  },
];

export default function SgpaCalculatorPage() {
  const grades = getAllGradeThresholds();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Study tools", url: "/tools" },
          { name: "SGPA Calculator", url: "/tools/sgpa-calculator" },
        ]}
      />
      <VisibleBreadcrumb
        items={[
          { name: "Home", url: "/" },
          { name: "Study tools", url: "/tools" },
          { name: "SGPA Calculator", url: "/tools/sgpa-calculator" },
        ]}
      />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">DU SGPA Calculator</h1>
      <p className="mt-3 text-base leading-7 text-muted">
        Enter the credits and grade point of every paper in your semester and get your SGPA straight away. It
        works for any Delhi University semester, so you can check a result or plan what you need next time.
      </p>

      <div className="mt-8">
        <SgpaCalculator />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">How SGPA is calculated</h2>
        <p className="mt-3 leading-7 text-muted">
          Every paper has a credit value and earns a grade point from 0 to 10. Your SGPA weights each grade
          point by its credits:
        </p>
        <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-center font-medium">
          SGPA = Σ (credits × grade point) ÷ Σ credits
        </p>

        <h3 className="mt-8 text-base font-semibold">Worked example</h3>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Paper</th>
                <th className="px-4 py-2 text-right font-medium">Credits</th>
                <th className="px-4 py-2 text-right font-medium">Grade point</th>
                <th className="px-4 py-2 text-right font-medium">Credits × GP</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE.map((p) => (
                <tr key={p.name} className="border-t border-border">
                  <td className="px-4 py-2">{p.name}</td>
                  <td className="px-4 py-2 text-right">{p.credits}</td>
                  <td className="px-4 py-2 text-right">{p.gradePoint}</td>
                  <td className="px-4 py-2 text-right">{p.credits * p.gradePoint}</td>
                </tr>
              ))}
              <tr className="border-t border-border bg-surface-muted font-medium">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2 text-right">{example.totalCredits}</td>
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-right">{example.weightedSum}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 leading-7 text-muted">
          SGPA = {example.weightedSum} ÷ {example.totalCredits} = <strong className="text-foreground">{example.cgpa.toFixed(2)}</strong>
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Marks to grade point</h2>
        <p className="mt-3 leading-7 text-muted">
          Grade points come from the percentage you score in a paper on the 10-point scale used by this site&apos;s
          calculators:
        </p>
        <div className="mt-3 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Marks in the paper</th>
                <th className="px-4 py-2 text-right font-medium">Grade point</th>
                <th className="px-4 py-2 font-medium">Result</th>
              </tr>
            </thead>
            <tbody>
              {grades.map((g, i) => (
                <tr key={g.gradePoint} className="border-t border-border">
                  <td className="px-4 py-2">
                    {g.min === 0 ? `Below ${grades[i - 1].min}%` : i === 0 ? `${g.min}% and above` : `${g.min}% to below ${grades[i - 1].min}%`}
                  </td>
                  <td className="px-4 py-2 text-right">{g.gradePoint}</td>
                  <td className="px-4 py-2">{g.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted">
          Planning backwards from a target? Use the{" "}
          <Link href="/tools/marks-calculator" className="text-accent underline-offset-2 hover:underline">
            Marks &amp; CGPA calculator
          </Link>{" "}
          to see the marks a paper needs, or read{" "}
          <Link href="/blog/how-to-score-9-plus-sgpa-in-delhi-university" className="text-accent underline-offset-2 hover:underline">
            how to score a 9+ SGPA
          </Link>
          .
        </p>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
        <dl className="mt-4 space-y-5">
          {FAQS.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="mt-1 leading-7 text-muted">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)).replace(/</g, "\\u003c") }}
      />
    </div>
  );
}
