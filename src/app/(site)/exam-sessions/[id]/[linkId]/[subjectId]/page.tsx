import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react/dist/ssr";
import { getSessionLinkWithSubjects } from "@/lib/data";

export default async function ExamSessionSubjectPage({
  params,
}: {
  params: Promise<{ id: string; linkId: string; subjectId: string }>;
}) {
  const { id, linkId, subjectId } = await params;
  const link = await getSessionLinkWithSubjects(linkId);
  if (!link || link.sessionId !== id) notFound();

  const files = link.driveFiles.filter((f) => f.driveSubjectId === subjectId);
  if (files.length === 0) notFound();
  const subjectName = files[0].driveSubject?.name ?? "Subject";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">
        <Link href="/exam-sessions" className="hover:text-foreground">
          Question papers
        </Link>{" "}
        ·{" "}
        <Link href={`/exam-sessions/${link.sessionId}`} className="hover:text-foreground">
          {link.session.label}
        </Link>{" "}
        ·{" "}
        <Link href={`/exam-sessions/${link.sessionId}/${link.id}`} className="hover:text-foreground">
          {link.program.name}
          {link.variantLabel && ` (${link.variantLabel})`}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{subjectName}</h1>

      <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-surface">
        <ul className="divide-y divide-border">
          {files.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-4 p-4">
              <span className="flex min-w-0 items-center gap-2.5">
                <FileText size={18} weight="bold" className="shrink-0 text-accent" />
                <span className="min-w-0">
                  <p className="truncate font-medium">{file.fileName}</p>
                  {file.year && <p className="text-xs text-muted">{file.year}</p>}
                </span>
              </span>
              <a
                href={file.webViewLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
              >
                View
                <ArrowSquareOut size={13} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
