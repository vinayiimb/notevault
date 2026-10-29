import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/legal/info-page";
import { Section } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "About Us: How We Source DU Question Papers",
  description:
    "An independent archive of Delhi University previous year question papers, organised by course, semester and subject. How we source and analyse them.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <InfoPage
      title="About DU PYQ Online"
      intro="An independent archive of Delhi University previous year question papers, built so a student can find the right paper in a few taps instead of digging through a university portal."
    >
      <Section title="What this site is">
        <p>
          DU PYQ Online collects Delhi University (DU) exam papers and arranges them the way students actually look for
          them: by <Link href="/papers" className="text-brand hover:underline">course</Link>, then semester, then
          subject. Every subject page lists the papers we have for it, year by year, with the paper code and a link to
          the original PDF.
        </p>
        <p>
          We are not part of the University of Delhi and are not affiliated with it. This is an independent project,
          built so DU students can find their papers faster.
        </p>
      </Section>

      <Section title="Where the papers come from">
        <p>
          The papers are the University&apos;s own published question papers (the official question-bank portal is
          qb.exam.du.ac.in). We do not rewrite or change them. We organise them, match them to the right course and
          subject using the Unique Paper Code printed on each paper, and link to the original PDF.
        </p>
        <p>
          Papers go through text recognition (OCR) so the questions can be searched. OCR is not perfect, so if a
          question looks garbled, check the PDF. That is always the authoritative version.
        </p>
      </Section>

      <Section title="What we add beyond the PDFs">
        <ul>
          <li>
            <strong>Repeated-question analyses.</strong> For a subject, we put all the papers we have side by side and
            mark which topics came back, in how many papers, and how they were worded. Examples:{" "}
            <Link href="/blog/du-bcom-hons-business-laws-most-repeated-questions" className="text-brand hover:underline">B.Com (Hons) Business Laws</Link>,{" "}
            <Link href="/blog/du-bcom-hons-financial-accounting-most-repeated-questions" className="text-brand hover:underline">B.Com (Hons) Financial Accounting</Link>,{" "}
            <Link href="/blog/du-environmental-science-aec-most-repeated-questions" className="text-brand hover:underline">Environmental Science (AEC)</Link> and{" "}
            <Link href="/blog/du-business-communication-sec-most-repeated-questions" className="text-brand hover:underline">Business Communication (SEC)</Link>.
          </li>
          <li>
            <strong>Exam guides</strong> for each semester, covering passing rules, course types (DSC, DSE, GE, AEC, SEC,
            VAC) and how to plan revision. See the <Link href="/blog" className="text-brand hover:underline">blog</Link>,
            or the <Link href="/faq" className="text-brand hover:underline">short answers on the FAQ page</Link>.
          </li>
          <li>
            <strong>Study notes</strong> for selected subjects. Reading the papers is free; some notes are paid.
          </li>
        </ul>
      </Section>

      <Section title="How the analyses are made, and what they can&apos;t tell you">
        <p>
          Counts like &ldquo;came in 9 of 17 papers&rdquo; are real counts from the papers on our site, with duplicate
          copies of the same paper removed. The answer pointers are short revision prompts, not model answers, so write
          your full answer from your own textbook and class notes.
        </p>
        <p>
          A topic that came up often is a good place to start revising, but it is not a prediction. Past repetition does
          not guarantee what will be asked next, so cover the whole syllabus.
        </p>
      </Section>

      <Section title="Spotted a mistake or a missing paper?">
        <p>
          Tell us on the <Link href="/contact" className="text-brand hover:underline">contact page</Link> or through the{" "}
          <Link href="/feedback" className="text-brand hover:underline">feedback form</Link>. Send the page link and the
          paper code, and we will fix it.
        </p>
      </Section>
    </InfoPage>
  );
}
