import type { Metadata } from "next";
import Link from "next/link";
import AttendanceCalculator from "@/components/tools/attendance-calculator";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { OG_IMAGES, faqJsonLd, type Faq } from "@/lib/seo";

const title = "DU Attendance Calculator (75% Rule)";
const description =
  "Free attendance calculator for DU students: enter classes attended and held to see your percentage, how many classes you can still miss, or how many you must attend to reach 75%.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/tools/attendance-calculator" },
  openGraph: { title, description, type: "website", images: OG_IMAGES },
};

const FAQS: Faq[] = [
  {
    q: "How is attendance percentage calculated?",
    a: "Attendance % = (classes attended ÷ classes held) × 100. If you attended 30 of 40 classes, your attendance is 75%.",
  },
  {
    q: "How many classes can I miss and still keep 75%?",
    a: "You can miss at most ⌊attended ÷ 0.75⌋ − held more classes, counting from today. At 45 attended out of 50 held, that is 10 more classes. The calculator above does this for any numbers and any required percentage.",
  },
  {
    q: "How many classes must I attend to reach 75%?",
    a: "If you are below the requirement, attend x classes in a row without missing any, where x is the smallest whole number with (attended + x) ÷ (held + x) ≥ 0.75. At 30 attended out of 50 held you need 30 in a row.",
  },
  {
    q: "Is the required attendance always 75%?",
    a: "75% is the figure most commonly quoted for Delhi University, but colleges and departments can apply their own rules, including condonation for medical or other approved reasons. Change the required percentage in the calculator and confirm the rule with your college.",
  },
];

export default function AttendanceCalculatorPage() {
  const crumbs = [
    { name: "Home", url: "/" },
    { name: "Study tools", url: "/tools" },
    { name: "Attendance Calculator", url: "/tools/attendance-calculator" },
  ];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <BreadcrumbJsonLd items={crumbs} />
      <VisibleBreadcrumb items={crumbs} />

      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">DU Attendance Calculator</h1>
      <p className="mt-3 text-base leading-7 text-muted">
        Enter how many classes you attended and how many were held. You get your attendance percentage, and either
        how many more classes you can safely miss or how many you need to attend in a row to reach the required
        percentage.
      </p>

      <div className="mt-8">
        <AttendanceCalculator />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-tight">The formula</h2>
        <p className="mt-3 rounded-xl border border-border bg-surface px-4 py-3 text-center font-medium">
          Attendance % = classes attended ÷ classes held × 100
        </p>
        <p className="mt-3 leading-7 text-muted">
          Missing a class lowers the percentage a little each time, while recovering takes many classes in a row.
          That is why a small shortfall late in the semester can need a long streak to fix. Check early.
        </p>
        <p className="mt-3 text-sm leading-6 text-muted">
          Also useful: the{" "}
          <Link href="/tools/sgpa-calculator" className="text-accent underline-offset-2 hover:underline">
            SGPA calculator
          </Link>{" "}
          and the{" "}
          <Link href="/tools/marks-calculator" className="text-accent underline-offset-2 hover:underline">
            Marks &amp; CGPA calculator
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
