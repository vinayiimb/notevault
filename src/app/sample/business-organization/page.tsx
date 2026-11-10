import type { Metadata } from "next";
import "./bom.css";
import { BODY_HTML } from "./body";
import { BomClient } from "./client";

export const metadata: Metadata = {
  title: "Business Organization and Management Notes (B.A. VS Tourism Sem 1)",
  description:
    "Unit-wise Business Organization and Management notes with solved previous-year questions, flashcards and a quiz. Study notes for 6132401102, Semester I.",
  alternates: { canonical: "/sample/business-organization" },
  robots: { index: false, follow: false },
};

export default function BusinessOrganizationSamplePage() {
  return (
    <>
      <div className="bomx" id="bomx" dangerouslySetInnerHTML={{ __html: BODY_HTML }} />
      <BomClient />
    </>
  );
}
