import type { Metadata } from "next";
import "./bom.css";
import { BODY_FULL, BODY_PREVIEW } from "./body";
import { BomClient } from "./client";
import { getNoteAccess } from "@/lib/paid-notes";

export const metadata: Metadata = {
  title: "Business Organization and Management Notes (B.A. VS Tourism Sem 1)",
  description:
    "Unit-wise Business Organization and Management notes with solved previous-year questions, flashcards and a quiz. Study notes for 6132401102, Semester I.",
  robots: { index: false, follow: false },
};

// Same rule as every paid subject: owner (approved, unexpired purchase), admin, or free = full page.
// Everyone else gets the Unit I preview only; the locked units are not in the HTML they receive.
export const dynamic = "force-dynamic";

export default async function BusinessOrganizationSamplePage() {
  const access = await getNoteAccess("bavs-tourism-management", "business-organization-and-management");
  const html = access === "locked" ? BODY_PREVIEW : BODY_FULL;
  return (
    <>
      <div className="bomx" id="bomx" dangerouslySetInnerHTML={{ __html: html }} />
      <BomClient />
    </>
  );
}
