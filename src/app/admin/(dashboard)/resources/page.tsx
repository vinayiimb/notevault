import Link from "next/link";
import { ArrowSquareOut, FilePdf, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function pageHref(params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  query.set("page", String(page));
  return `/admin/resources?${query.toString()}`;
}

export default async function AdminResourceLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    programId?: string;
    termId?: string;
    subjectId?: string;
    year?: string;
    type?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const programId = params.programId ?? "";
  const termId = params.termId ?? "";
  const subjectId = params.subjectId ?? "";
  const year = params.year ?? "";
  const type = params.type === "PYQ" || params.type === "NOTES" ? params.type : "";
  const requestedPage = Math.max(1, Number(params.page) || 1);

  const filters: Prisma.ResourceWhereInput[] = [];
  if (q) {
    filters.push({
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { fileName: { contains: q, mode: "insensitive" } },
        { subject: { name: { contains: q, mode: "insensitive" } } },
        { subject: { term: { program: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  if (programId) filters.push({ subject: { term: { programId } } });
  if (termId) filters.push({ subject: { termId } });
  if (subjectId) filters.push({ subjectId });
  if (year && /^\d{4}$/.test(year)) filters.push({ year: Number(year) });
  if (type) filters.push({ type });
  const where: Prisma.ResourceWhereInput = filters.length ? { AND: filters } : {};

  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      terms: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  });

  const availableTerms = programId
    ? programs.find((program) => program.id === programId)?.terms ?? []
    : programs.flatMap((program) => program.terms.map((term) => ({ ...term, programName: program.name })));
  const availableSubjects = termId
    ? availableTerms.find((term) => term.id === termId)?.subjects ?? []
    : programId
      ? availableTerms.flatMap((term) => term.subjects)
      : [];

  const [total, aggregate, pyqCount, notesCount] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.aggregate({ where, _sum: { fileSize: true } }),
    prisma.resource.count({ where: { AND: [where, { type: "PYQ" }] } }),
    prisma.resource.count({ where: { AND: [where, { type: "NOTES" }] } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const resources = await prisma.resource.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          term: { select: { id: true, name: true, program: { select: { id: true, name: true } } } },
        },
      },
      batch: { select: { id: true } },
    },
  });

  return (
    <div className="p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">PDF library</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Every uploaded PDF, including older files without a batch. Filter by course, semester,
            subject, year, or type, then open the original file directly.
          </p>
        </div>
        <Link
          href="/admin/consolidated-upload"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Upload PDFs
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3 border-y border-border py-4">
        <div><span className="text-xl font-semibold">{total}</span><span className="ml-2 text-sm text-muted">files found</span></div>
        <div><span className="text-xl font-semibold">{pyqCount}</span><span className="ml-2 text-sm text-muted">PYQs</span></div>
        <div><span className="text-xl font-semibold">{notesCount}</span><span className="ml-2 text-sm text-muted">notes</span></div>
        <div><span className="text-xl font-semibold">{formatBytes(aggregate._sum.fileSize ?? 0)}</span><span className="ml-2 text-sm text-muted">stored</span></div>
      </div>

      <form method="get" className="mt-6 flex flex-wrap items-end gap-3 rounded-xl bg-surface-muted p-4">
        <label className="min-w-64 flex-1 text-xs font-medium text-muted">
          Search
          <span className="mt-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
            <MagnifyingGlass size={16} />
            <input name="q" defaultValue={q} placeholder="Title, filename, subject, course…" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" />
          </span>
        </label>
        <label className="text-xs font-medium text-muted">
          Course
          <select name="programId" defaultValue={programId} className="mt-1 block h-10 max-w-64 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            <option value="">All courses</option>
            {programs.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Semester
          <select name="termId" defaultValue={termId} className="mt-1 block h-10 max-w-56 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            <option value="">All semesters</option>
            {availableTerms.map((term) => (
              <option key={term.id} value={term.id}>{"programName" in term ? `${term.programName} · ` : ""}{term.name}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Subject
          <select name="subjectId" defaultValue={subjectId} disabled={!programId && !termId} className="mt-1 block h-10 max-w-60 rounded-lg border border-border bg-background px-3 text-sm text-foreground disabled:opacity-50">
            <option value="">All subjects</option>
            {availableSubjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
          </select>
        </label>
        <label className="text-xs font-medium text-muted">
          Year
          <input name="year" defaultValue={year} inputMode="numeric" placeholder="2024" className="mt-1 block h-10 w-24 rounded-lg border border-border bg-background px-3 text-sm text-foreground" />
        </label>
        <label className="text-xs font-medium text-muted">
          Type
          <select name="type" defaultValue={type} className="mt-1 block h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground">
            <option value="">All types</option>
            <option value="PYQ">PYQ</option>
            <option value="NOTES">Notes</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Apply</button>
        <Link href="/admin/resources" className="flex h-10 items-center px-2 text-sm text-muted hover:text-foreground">Clear</Link>
      </form>

      {resources.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 py-12 text-center">
          <FilePdf size={32} className="text-muted" />
          <p className="font-medium">No PDFs match these filters</p>
          <p className="text-sm text-muted">Clear one or more filters, or upload a new archive.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="border-b border-border bg-surface-muted text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">PDF</th>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Semester</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Year</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Uploaded</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {resources.map((resource) => (
                <tr key={resource.id} className="hover:bg-surface-muted/60">
                  <td className="max-w-72 px-4 py-3">
                    <p className="truncate font-medium" title={resource.title}>{resource.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted" title={resource.fileName}>{resource.fileName} · {formatBytes(resource.fileSize)}</p>
                  </td>
                  <td className="max-w-56 px-4 py-3"><span className="line-clamp-2">{resource.subject.term.program.name}</span></td>
                  <td className="px-4 py-3 text-muted">{resource.subject.term.name}</td>
                  <td className="max-w-52 px-4 py-3">
                    <Link href={`/admin/subjects/${resource.subject.id}`} className="line-clamp-2 text-accent hover:underline">{resource.subject.name}</Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">{resource.academicYear || resource.year || "—"}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-surface-muted px-2 py-1 text-xs">{resource.type === "PYQ" ? "PYQ" : "Notes"}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted">
                    {resource.createdAt.toLocaleDateString()}
                    {resource.batch && <Link href={`/admin/batches/${resource.batch.id}`} className="mt-1 block text-accent hover:underline">View batch</Link>}
                  </td>
                  <td className="px-4 py-3">
                    <a href={resource.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-accent hover:underline">
                      Open PDF <ArrowSquareOut size={14} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="text-muted">Page {page} of {pageCount}</span>
          <div className="flex gap-2">
            {page > 1 && <Link href={pageHref(params, page - 1)} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Previous</Link>}
            {page < pageCount && <Link href={pageHref(params, page + 1)} className="rounded-lg border border-border px-3 py-2 hover:bg-surface-muted">Next</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
