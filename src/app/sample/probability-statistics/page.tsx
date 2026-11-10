import type { Metadata } from "next";
import "./bom.css";
import "./katex.css";
import { BODY_HTML } from "./body";
import { BomClient } from "./client";

export const metadata: Metadata = {
  title: "Probability and Statistics Notes (B.Sc. Hons. Mathematics Sem 1)",
  description:
    "Unit-wise Probability and Statistics notes with every 2023-2026 previous-year question solved, flashcards and a quiz. Study notes for 2352011103, Semester I.",
  alternates: { canonical: "/sample/probability-statistics" },
  robots: { index: false, follow: false },
};

export default function ProbabilityStatisticsSamplePage() {
  return (
    <>
      <div className="bomx" id="bomx" dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
      <BomClient />
    </>
  );
}
