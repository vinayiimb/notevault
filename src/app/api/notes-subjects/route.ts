import { NextResponse } from "next/server";
import { getProgrammeSubjectsWithNotesStatus } from "@/lib/canonical-subject-notes-data";
import type { LeadSubject } from "@/lib/note-leads";

export const dynamic = "force-dynamic"; // reads the DB — never at build time

// Subjects of one programme for the lead form's subject dropdown (notes first).
export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("p") ?? "";
  const programme = await getProgrammeSubjectsWithNotesStatus(slug).catch(() => null);
  if (!programme) return NextResponse.json({ subjects: [] }, { status: 404 });
  const subjects: LeadSubject[] = programme.subjects.map((s) => ({
    slug: s.slug, name: s.name, hasNotes: s.hasNotes, semester: s.semester,
  }));
  return NextResponse.json({ subjects }, { headers: { "Cache-Control": "public, max-age=300" } });
}
