import Link from "next/link";
import { MagnifyingGlass, X } from "@phosphor-icons/react/dist/ssr";
import { addSubjectAction, removeSubjectAction } from "@/lib/paid-notes-actions";
import type { SubjectRow } from "@/lib/student-dashboard";
import { AddSubjectForm } from "./add-subject-form";

const TYPE_TONE: Record<string, string> = {
  SEC: "bg-sky-500/12 text-sky-700 dark:text-sky-300",
  VAC: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  GE: "bg-violet-500/12 text-violet-700 dark:text-violet-300",
  AEC: "bg-amber-500/14 text-amber-800 dark:text-amber-300",
  DSC: "bg-rose-500/12 text-rose-700 dark:text-rose-300",
  DSE: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300",
};
const Chip = ({ type }: { type: string }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${TYPE_TONE[type] ?? "bg-foreground/[0.07] text-muted"}`}>{type}</span>
);

function RemoveButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={removeSubjectAction}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" aria-label={`Remove ${name}`} className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-600">
        <X size={16} weight="bold" />
      </button>
    </form>
  );
}

const where = (s: SubjectRow) => [s.course, s.semester ? `Sem ${s.semester}` : null].filter(Boolean).join(" · ");
const findHref = (name: string) => `/search?q=${encodeURIComponent(name)}`;

// "My subjects": the SEC / VAC / GE / AEC papers the student studies. `rows` is
// null while the StudentSubject table doesn't exist (migration not applied).
export function SubjectsCard({ rows, error, limit }: { rows: SubjectRow[] | null; error?: string; limit: number }) {
  const list = rows ?? [];
  return (
    <section id="subjects" aria-label="My subjects" className="relative scroll-mt-24 rounded-[28px] bg-surface p-5 shadow-[var(--shadow-tile)] sm:p-7">
      <span className="absolute -top-3 right-5 rounded-full bg-emerald-400/90 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-sm sm:right-7">
        {list.length} / {limit} added
      </span>
      <h2 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] sm:text-[1.6rem]">Add your subjects here</h2>
      <p className="mt-1 text-[15px] text-muted">Your SEC, VAC, GE, AEC, DSC and DSE papers with their subject codes, one tap from their PYQs.</p>

      {list.length > 0 && (
        <>
          {/* Desktop: table */}
          <table className="mt-5 hidden w-full text-left sm:table">
            <thead>
              <tr className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
                <th className="w-14 pb-2 pl-1 font-semibold">S.No</th>
                <th className="w-24 pb-2 font-semibold">Type</th>
                <th className="pb-2 font-semibold">Subject name</th>
                <th className="w-44 pb-2 font-semibold">Subject code</th>
                <th className="w-40 pb-2" />
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <tr key={s.id} className="border-t border-foreground/[0.07]">
                  <td className="py-3 pl-1 text-[15px] tabular-nums text-muted">{i + 1}</td>
                  <td className="py-3"><Chip type={s.type} /></td>
                  <td className="py-3 pr-3">
                    <span className="block text-[16px] font-semibold tracking-[-0.01em]">{s.name}</span>
                    {where(s) && <span className="block text-xs text-muted">{where(s)}</span>}
                  </td>
                  <td className="py-3 font-mono text-[14px] text-muted">{s.code ?? "—"}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={findHref(s.name)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold text-brand transition hover:bg-brand/10">
                        <MagnifyingGlass size={15} weight="bold" /> PYQs
                      </Link>
                      <RemoveButton id={s.id} name={s.name} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Phone: cards, not a squeezed table */}
          <ul className="mt-5 flex flex-col gap-2.5 sm:hidden">
            {list.map((s, i) => (
              <li key={s.id} className="rounded-[20px] bg-foreground/[0.04] p-3.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground/[0.07] text-xs font-semibold tabular-nums text-muted">{i + 1}</span>
                  <Chip type={s.type} />
                  <span className="ml-auto font-mono text-[13px] text-muted">{s.code ?? ""}</span>
                </div>
                <p className="mt-2 text-[16px] font-semibold leading-snug tracking-[-0.01em]">{s.name}</p>
                {where(s) && <p className="text-xs text-muted">{where(s)}</p>}
                <div className="mt-2 flex items-center justify-between">
                  <Link href={findHref(s.name)} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-brand/10 px-4 text-sm font-semibold text-brand">
                    <MagnifyingGlass size={15} weight="bold" /> Find PYQs
                  </Link>
                  <RemoveButton id={s.id} name={s.name} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5">
        {rows === null ? (
          <p className="rounded-[18px] bg-foreground/[0.05] px-4 py-3 text-sm text-muted">Subject lists are being switched on. Check back soon.</p>
        ) : list.length >= limit ? (
          <p className="text-sm text-muted">You&apos;ve added the limit of {limit}. Remove one to add another, or ask us on WhatsApp to raise it.</p>
        ) : (
          <AddSubjectForm key={list.length} action={addSubjectAction} error={error} startOpen={list.length === 0} />
        )}
      </div>
    </section>
  );
}
