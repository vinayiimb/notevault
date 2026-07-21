import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, CaretRight, Exam } from "@phosphor-icons/react/dist/ssr";
import { getExamSessionById } from "@/lib/data";

type SessionLink = Awaited<ReturnType<typeof getExamSessionById>> extends { links: infer L } | null
  ? L extends (infer T)[]
    ? T
    : never
  : never;

// Groups the flat course list into faculty-style sections so a session with
// 20+ courses reads as a syllabus, not a spreadsheet dump.
function categorize(name: string): { label: string; order: number } {
  if (name.includes("Pool") || name.includes("Unsorted")) return { label: "Electives & common pools", order: 5 };
  if (name.includes("Geography")) return { label: "B.A. / B.Sc. (Honours)", order: 3 };
  if (name.startsWith("B.Com")) return { label: "B.Com.", order: 2 };
  if (name.startsWith("B.A.")) {
    return name.includes("(Hons") ? { label: "B.A. (Honours)", order: 0 } : { label: "B.A. (Programme)", order: 1 };
  }
  if (name.startsWith("B.Sc.")) {
    return name.includes("(Hons") ? { label: "B.Sc. (Honours)", order: 3 } : { label: "B.Sc. (Programme)", order: 4 };
  }
  return { label: "Other courses", order: 6 };
}

export default async function ExamSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getExamSessionById(id);
  if (!session) notFound();

  const groups = new Map<string, { order: number; links: SessionLink[] }>();
  for (const link of session.links) {
    const { label, order } = categorize(link.program.name);
    if (!groups.has(label)) groups.set(label, { order, links: [] });
    groups.get(label)!.links.push(link);
  }
  const sortedGroups = [...groups.entries()].sort((a, b) => a[1].order - b[1].order);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">
        <Link href="/exam-sessions" className="hover:text-foreground">
          Question papers
        </Link>
      </p>
      <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
        <Exam size={28} weight="bold" className="text-accent" />
        {session.label}
      </h1>
      {session.links.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          {session.links.length} course{session.links.length === 1 ? "" : "s"} across {sortedGroups.length}{" "}
          categor{sortedGroups.length === 1 ? "y" : "ies"}.
        </p>
      )}

      {session.masterDriveUrl && (
        <a
          href={session.masterDriveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-3 font-medium text-accent-foreground transition hover:opacity-90"
        >
          ALL Search by Name
          <ArrowSquareOut size={16} weight="bold" />
        </a>
      )}

      {session.links.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No courses linked yet.</p>
      ) : (
        <div className="mt-8 flex flex-col gap-8">
          {sortedGroups.map(([label, group]) => (
            <section key={label}>
              <h2 className="mb-3 text-sm font-semibold tracking-wide text-muted uppercase">{label}</h2>
              <div className="overflow-hidden rounded-2xl border border-border bg-surface">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] border-collapse text-left text-sm">
                    <thead className="bg-surface-muted/55 text-xs text-muted">
                      <tr>
                        <th scope="col" className="w-12 px-5 py-3 font-semibold sm:px-6">S. No.</th>
                        <th scope="col" className="px-4 py-3 font-semibold">Name</th>
                        <th scope="col" className="w-32 px-5 py-3 text-right font-semibold sm:px-6">Subjects</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.links.map((link, index) => (
                        <tr key={link.id} className="transition-colors hover:bg-accent-soft/30">
                          <td className="px-5 py-4 align-top text-xs text-muted sm:px-6">{index + 1}</td>
                          <th scope="row" className="px-4 py-4 align-top font-medium text-foreground">
                            {link.program.name}
                            {link.variantLabel && ` (${link.variantLabel})`}
                          </th>
                          <td className="px-5 py-4 align-top text-right sm:px-6">
                            <Link
                              href={`/exam-sessions/${session.id}/${link.id}`}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover"
                            >
                              Browse
                              <CaretRight size={13} weight="bold" aria-hidden="true" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
