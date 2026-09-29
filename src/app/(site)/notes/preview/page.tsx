import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NotesSection } from "@/components/subjects/notes-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

// Forces this page to render per-request instead of being statically
// generated at build time. It queries the database on every load (a random
// subject each time), and DATABASE_URL is only available at runtime on
// Railway, not inside the Docker build container.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Notes Preview | DU PYQ Online",
  description: "See a sample of the compiled study notes available on DU PYQ Online — picked at random from a real subject.",
  robots: { index: false, follow: true },
};

// A random real SubjectNotes row on every load, not a fixed demo — so this
// stays a fair sample of what's actually in the database instead of drifting
// stale like a hardcoded example would.
export default async function NotesPreviewPage() {
  const count = await prisma.subjectNotes.count();

  if (count === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">No notes to preview yet</h1>
        <p className="mt-3 text-sm text-muted">
          Check back soon — we&apos;re adding compiled study notes for DU subjects.
        </p>
        <Link href="/notes" className="mt-6 inline-block text-sm font-bold text-brand hover:underline">
          Browse notes by programme →
        </Link>
      </div>
    );
  }

  const skip = Math.floor(Math.random() * count);
  const note = await prisma.subjectNotes.findFirst({
    skip,
    include: {
      subject: {
        select: {
          name: true,
          slug: true,
          term: { select: { program: { select: { name: true } } } },
        },
      },
    },
  });

  if (!note) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">No notes to preview yet</h1>
        <Link href="/notes" className="mt-6 inline-block text-sm font-bold text-brand hover:underline">
          Browse notes by programme →
        </Link>
      </div>
    );
  }

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Notes", url: "/notes" },
    { name: "Preview", url: "/notes/preview" },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-2xl">
        <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
          Demo preview
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          {note.subject.name}
        </h1>
        <p className="mt-2 text-sm text-muted">
          {note.subject.term.program.name} — a random sample of our compiled notes. Refresh for another.
        </p>
      </div>

      <NotesSection
        content={note.content}
        theme={note.theme}
        subjectName={note.subject.name}
        programmeName={note.subject.term.program.name}
      />

      <div className="mt-12 rounded-2xl border border-border bg-surface p-6 text-center">
        <p className="text-sm text-muted">
          Want notes for your own subject?
        </p>
        <div className="mt-3 flex flex-wrap justify-center gap-3">
          <Link
            href="/notes"
            className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:opacity-90"
          >
            Browse all notes
          </Link>
          <Link
            href={`/subject/${note.subject.slug}/notes`}
            className="rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-semibold text-foreground hover:border-accent"
          >
            Open this subject
          </Link>
        </div>
      </div>
    </div>
  );
}
