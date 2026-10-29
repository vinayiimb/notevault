import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/legal/info-page";
import { OG_IMAGES, SITE_NAME, faqJsonLd, fitTitle, type Faq } from "@/lib/seo";

const title = fitTitle(`DU Exam FAQ: Full Forms, Passing Marks, CGPA | ${SITE_NAME}`, "DU Exam FAQ: Full Forms, Passing Marks, CGPA");
const description =
  "Short answers to common Delhi University exam questions: AEC, SEC, VAC, passing marks, Essential Repeat, CGPA to percentage and PYQs.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/faq" },
  openGraph: { title: title.absolute, description, type: "website", images: OG_IMAGES },
};

// Every answer is condensed from the guide it links to; keep them in step with those posts.
const ITEMS: { faq: Faq; href: string; label: string }[] = [
  {
    faq: {
      q: "What is the full form of AEC in DU?",
      a: "AEC stands for Ability Enhancement Course. Under the UGCF it is a compulsory 2-credit language or environmental studies paper, for example Environmental Science, Hindi or a regional language.",
    },
    href: "/blog/aec-courses-in-du-ability-enhancement-guide",
    label: "AEC guide",
  },
  {
    faq: {
      q: "What is the full form of SEC in DU?",
      a: "SEC stands for Skill Enhancement Course. It is a practical, skill-oriented 2-credit paper, such as Digital Marketing or Creative Writing, and is often marked on practical or project work.",
    },
    href: "/blog/best-sec-courses-in-du-skill-enhancement-guide",
    label: "SEC guide",
  },
  {
    faq: {
      q: "What is the full form of VAC in DU?",
      a: "VAC stands for Value Addition Course. It is a light 2-credit paper on ethics, values, culture or the constitution, aimed at all-round development.",
    },
    href: "/blog/best-vac-courses-in-du-value-addition-guide",
    label: "VAC guide",
  },
  {
    faq: {
      q: "What are DSC, DSE and GE papers in DU?",
      a: "DSC is a Discipline Specific Core paper: the compulsory core of your degree. DSE is a Discipline Specific Elective: an option within your own discipline. GE is a Generic Elective: an elective offered by another department. These typically carry 4 credits each.",
    },
    href: "/blog/understanding-nep-under-du-ugcf-structure",
    label: "UGCF structure explained",
  },
  {
    faq: {
      q: "What are the passing marks in DU?",
      a: "The pass mark is 40% in each paper. If a paper has both theory and practical parts, you must pass each part separately; failing either gives an Essential Repeat (ER) for the whole paper.",
    },
    href: "/blog/du-passing-criteria-and-promotion-rules-explained",
    label: "Passing criteria and promotion rules",
  },
  {
    faq: {
      q: "What is an Essential Repeat (ER) in DU?",
      a: "An ER is a paper in which you did not reach 40% or did not appear. An odd-semester ER can be retaken only in a later odd-semester exam, and an even-semester ER only in a later even-semester exam.",
    },
    href: "/blog/du-passing-criteria-and-promotion-rules-explained",
    label: "Passing criteria and promotion rules",
  },
  {
    faq: {
      q: "How many papers must I pass to be promoted to the next year in DU?",
      a: "Promotion is decided yearly. You must pass at least 50% of the papers across both semesters of the academic year. For example, with 14 papers in Year 1 you need to pass at least 7.",
    },
    href: "/blog/du-passing-criteria-and-promotion-rules-explained",
    label: "Passing criteria and promotion rules",
  },
  {
    faq: {
      q: "How do I convert DU CGPA to percentage?",
      a: "Multiply your CGPA by 9.5. For example, a CGPA of 8.24 gives 8.24 × 9.5 = 78.28%.",
    },
    href: "/blog/du-cgpa-to-percentage-conversion-formula-guide",
    label: "CGPA to percentage guide",
  },
  {
    faq: {
      q: "How many credits do I need for a DU degree?",
      a: "A typical 3-year undergraduate degree needs 132 credits, and a 4-year degree with Honours or Research needs 176 credits.",
    },
    href: "/blog/understanding-nep-under-du-ugcf-structure",
    label: "UGCF structure explained",
  },
  {
    faq: {
      q: "Where can I find Delhi University previous year question papers?",
      a: "On DU PYQ Online, choose your course, then the semester, then the subject. Every paper opens as the original PDF, free and with no login. The papers are the University's own published question papers.",
    },
    href: "/blog/how-to-use-du-previous-year-question-papers",
    label: "How to use DU previous year papers",
  },
  {
    faq: {
      q: "Where can I check my DU exam date?",
      a: "Delhi University publishes the datesheet as programme-wise PDFs, and it is marked tentative, so re-check it a week before your first paper. Our datesheet guide explains how to find your programme and semester.",
    },
    href: "/blog/du-datesheet-december-2026-how-to-check",
    label: "How to check your datesheet",
  },
];

export default function FaqPage() {
  return (
    <InfoPage
      title="DU exam questions, answered"
      intro="Short answers to what Delhi University students ask most, each linked to the full guide."
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(ITEMS.map((i) => i.faq))).replace(/</g, "\\u003c") }}
      />
      {ITEMS.map(({ faq, href, label }) => (
        <section key={faq.q}>
          <h2>{faq.q}</h2>
          <p>{faq.a}</p>
          <p>
            <Link href={href} className="text-brand hover:underline">
              {label} →
            </Link>
          </p>
        </section>
      ))}
      <section>
        <h2>Is DU PYQ Online part of Delhi University?</h2>
        <p>
          No. It is an independent project and is not affiliated with the University of Delhi.{" "}
          <Link href="/about" className="text-brand hover:underline">
            About us →
          </Link>
        </p>
      </section>
    </InfoPage>
  );
}
