export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react/dist/ssr";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { getSession } from "@/lib/auth";
import { getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { STUDENT_PDF_DOWNLOAD, itemKey } from "@/lib/paid-notes-pricing";
import { NotesSection } from "@/components/subjects/notes-section";
import { ReadingTracker } from "@/components/account/reading-tracker";

export const metadata: Metadata = {
  title: "Your notes",
  robots: { index: false, follow: false },
};

// The full note, for signed-in students who own it (and admins). This is the
// only place a student reads a paid note: /notes/... stays the free preview.
export default async function StudentNotePage({ params }: { params: Promise<{ programmeSlug: string; subjectSlug: string }> }) {
  const { programmeSlug, subjectSlug } = await params;
  const here = `/account/notes/${programmeSlug}/${subjectSlug}`;

  const admin = !!(await getSession());
  if (!admin) {
    const email = await getStudentEmail();
    if (!email) redirect(`/login?next=${encodeURIComponent(here)}`);
    // Signed in but doesn't own it: the public page has the preview and the unlock offer.
    if (!(await getUnlockedItems(email)).has(itemKey(programmeSlug, subjectSlug))) redirect(`/notes/${programmeSlug}/${subjectSlug}`);
  }

  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note?.content.trim()) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-4 sm:px-6 sm:pt-8">
      {!admin && <ReadingTracker itemKey={itemKey(programmeSlug, subjectSlug)} />}
      <Link
        href="/account"
        className="inline-flex min-h-10 items-center gap-1 rounded-full bg-foreground/[0.06] py-2 pl-2.5 pr-4 text-sm font-semibold transition hover:bg-foreground/[0.1]"
      >
        <CaretLeft size={16} weight="bold" />
        My notes
      </Link>
      <NotesSection
        content={note.content}
        theme={note.theme}
        subjectName={note.subjectName}
        programmeName={note.programmeName}
        downloadable={admin || STUDENT_PDF_DOWNLOAD}
      />
    </div>
  );
}
