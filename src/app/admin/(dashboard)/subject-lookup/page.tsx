export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { SubjectLookupTable } from "@/components/admin/subject-lookup-table";

// A flat, searchable Programme -> Subject -> ID table. Exists specifically
// so an admin preparing a question-bank CSV (see /admin/bulk-upload-questions)
// can find the exact Subject ID a row needs — there was previously no way
// to see a Subject's ID without already knowing it and navigating to
// /admin/subjects/[id] via Programs -> Term -> Subject.
export default async function SubjectLookupPage() {
  const subjects = await prisma.subject.findMany({
    include: { term: { include: { program: true } } },
    orderBy: [{ term: { program: { name: "asc" } } }, { name: "asc" }],
  });

  const rows = subjects.map((s) => ({
    id: s.id,
    subjectName: s.name,
    programName: s.term.program.name,
    termName: s.term.name,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Subject lookup</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Find a subject&apos;s ID to use in the <code>SubjectId</code> column of a question-bank CSV upload.
        Search by programme or subject name, then copy the ID.
      </p>

      <SubjectLookupTable rows={rows} />
    </div>
  );
}
