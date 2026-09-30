export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { findPapersArchiveCourse, getPapersArchiveSubjectPapers } from "@/lib/papers-archive-data";
import { resetPaperAction, updatePaperAction } from "@/lib/papers-archive-actions";
import { ArchiveFlash } from "@/components/admin/archive-flash";

function decode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function PapersArchiveSubjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseSlug: string; subjectKey: string }>;
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  const [{ courseSlug, subjectKey: rawKey }, { ok, err }] = await Promise.all([params, searchParams]);
  const subjectKey = decode(rawKey);
  const course = await findPapersArchiveCourse(courseSlug);
  if (!course) notFound();
  const data = await getPapersArchiveSubjectPapers(course, subjectKey);
  if (!data) notFound();

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <Link
          href={`/admin/papers-archive/${courseSlug}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft size={14} weight="bold" /> {course}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-foreground">{data.subjectName}</h1>
        <p className="mt-1 text-sm text-muted">
          {data.papers.length} paper{data.papers.length === 1 ? "" : "s"}. Paste a new link to replace a broken
          one, or tick Hide to remove a single paper from /papers.
          {data.combined && " This heading combines several subjects — the original subject of each paper is shown under its session."}
          {data.subjectHidden && " This whole subject is currently hidden from students."}
        </p>
      </div>

      <ArchiveFlash ok={ok} err={err} />

      <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-3">Session</th>
              <th className="px-3 py-3">Sem</th>
              <th className="px-3 py-3">PDF link</th>
              <th className="px-3 py-3">Remove</th>
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.papers.map((p, i) => {
              const formId = `paper-${i}`;
              return (
                <tr
                  key={p.id}
                  className={`border-b border-border/60 align-top last:border-0 ${p.hidden ? "bg-red-500/5" : ""}`}
                >
                  <td className="px-3 py-3">
                    <p className="font-medium text-foreground">{p.yearRange}</p>
                    {data.combined && <p className="text-[11px] font-semibold text-accent">{p.originalSubject}</p>}
                    {p.college && <p className="text-[11px] text-muted">{p.college}</p>}
                    {p.note && <p className="mt-0.5 max-w-xs text-[11px] leading-4 text-muted">{p.note}</p>}
                  </td>
                  <td className="px-3 py-3 text-muted">{p.semester ?? "—"}</td>
                  <td className="px-3 py-3">
                    <form id={formId} action={updatePaperAction}>
                      <input type="hidden" name="paperId" value={p.id} />
                      <input type="hidden" name="courseSlug" value={courseSlug} />
                      <input type="hidden" name="groupKey" value={subjectKey} />
                      <input type="hidden" name="fromPapersPage" value="1" />
                      <input type="hidden" name="originalUrl" value={p.originalUrl} />
                    </form>
                    <div className="flex items-center gap-2">
                      <input
                        name="pdfUrl"
                        form={formId}
                        type="url"
                        defaultValue={p.pdfUrl}
                        className="w-full min-w-80 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs focus:border-accent focus:outline-none"
                      />
                      <a
                        href={p.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open this PDF"
                        className="shrink-0 text-muted hover:text-accent"
                      >
                        <ArrowSquareOut size={16} weight="bold" />
                      </a>
                    </div>
                    {p.pdfUrl !== p.originalUrl && (
                      <p className="mt-1 truncate text-[11px] text-muted">Originally: {p.originalUrl}</p>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <label className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        name="hidden"
                        form={formId}
                        defaultChecked={p.hidden}
                        className="size-4 accent-red-500"
                      />
                      Hide
                    </label>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        form={formId}
                        className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-semibold hover:bg-surface-muted"
                      >
                        Save
                      </button>
                      {p.edited && (
                        <form action={resetPaperAction}>
                          <input type="hidden" name="paperId" value={p.id} />
                          <input type="hidden" name="courseSlug" value={courseSlug} />
                          <input type="hidden" name="groupKey" value={subjectKey} />
                          <input type="hidden" name="fromPapersPage" value="1" />
                          <button type="submit" className="text-xs font-semibold text-red-500 hover:underline">
                            Reset
                          </button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
