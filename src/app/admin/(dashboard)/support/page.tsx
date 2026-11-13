export const dynamic = "force-dynamic";
import Image from "next/image";
import Link from "next/link";
import { Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { deleteTicketAction, replyTicketAction } from "@/lib/support-actions";
import { STATUS_LABEL, TICKET_KINDS, TICKET_STATUSES, parseKind, parseStatus } from "@/lib/support";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

const KIND_BADGE: Record<string, string> = {
  PROBLEM: "bg-amber-100 text-amber-800",
  ERROR: "bg-red-100 text-red-700",
  SUGGESTION: "bg-emerald-100 text-emerald-700",
};

export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string }> }) {
  const { status: statusParam, kind: kindParam } = await searchParams;
  const status = parseStatus(statusParam);
  const kind = parseKind(kindParam);

  const [tickets, counts] = await Promise.all([
    prisma.supportTicket
      .findMany({ where: { ...(status && { status }), ...(kind && { kind }) }, orderBy: { createdAt: "desc" }, take: 200 })
      .catch(() => null), // table missing until the migration is applied
    prisma.supportTicket.groupBy({ by: ["status"], _count: true }).catch(() => []),
  ]);
  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const href = (s?: string, k?: string) => `/admin/support${s || k ? `?${new URLSearchParams({ ...(s && { status: s }), ...(k && { kind: k }) })}` : ""}`;
  const chip = (on: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted hover:text-foreground"}`;

  return (
    <div className="p-4 sm:p-8">
      <div className="rounded-[28px] border border-border bg-surface p-5 shadow-[0_10px_40px_rgba(15,23,42,.06)] sm:p-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Support tickets</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Problems, error reports and suggestions raised by signed-in students. Your reply shows on their Help &amp; tickets page.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link href={href(undefined, kind ?? undefined)} className={chip(!status)}>All</Link>
          {TICKET_STATUSES.map((s) => (
            <Link key={s} href={href(s, kind ?? undefined)} className={chip(status === s)}>
              {STATUS_LABEL[s]} {countOf(s)}
            </Link>
          ))}
          <span className="mx-1 hidden w-px bg-border sm:block" />
          {TICKET_KINDS.map((k) => (
            <Link key={k.id} href={href(status ?? undefined, kind === k.id ? undefined : k.id)} className={chip(kind === k.id)}>
              {k.label}
            </Link>
          ))}
        </div>

        {tickets === null ? (
          <p className="mt-8 rounded-2xl bg-surface-muted p-6 text-sm text-muted">The SupportTicket table doesn&apos;t exist yet — apply the migration first.</p>
        ) : tickets.length === 0 ? (
          <div className="mt-8 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface-muted p-12 text-center">
            <Lifebuoy size={28} className="text-muted" />
            <p className="text-sm text-muted">No tickets here.</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {tickets.map((t) => (
              <article key={t.id} className={`rounded-2xl border p-5 ${t.status === "OPEN" ? "border-accent/30 bg-accent-soft/40" : "border-border bg-background"}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-bold ${KIND_BADGE[t.kind] ?? "bg-surface-muted"}`}>
                    {TICKET_KINDS.find((k) => k.id === t.kind)?.label ?? t.kind}
                  </span>
                  <span className="font-semibold">{STATUS_LABEL[parseStatus(t.status) ?? "OPEN"]}</span>
                  <span className="text-muted">{t.email}</span>
                  <span className="ml-auto text-muted">{t.createdAt.toLocaleString("en-IN")}</span>
                </div>
                <h2 className="mt-2 text-base font-semibold">{t.subject}</h2>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{t.message}</p>
                {(t.pageUrl || t.userAgent) && (
                  <p className="mt-2 break-all text-xs text-muted">
                    {t.pageUrl && <>Raised from <span className="font-medium">{t.pageUrl}</span>. </>}
                    {t.userAgent}
                  </p>
                )}
                {t.screenshotUrl && (
                  <a href={t.screenshotUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block overflow-hidden rounded-lg border border-border hover:border-accent">
                    <Image src={t.screenshotUrl} alt="Screenshot" width={220} height={140} unoptimized loading="lazy" className="h-[140px] w-[220px] object-cover" />
                  </a>
                )}

                <form action={replyTicketAction} className="mt-4 flex flex-col gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <textarea
                    name="reply"
                    rows={3}
                    defaultValue={t.reply ?? ""}
                    placeholder="Reply to the student (they see this on their dashboard)…"
                    className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <select name="status" defaultValue={t.status} className="rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                      {TICKET_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
                      Save
                    </button>
                    <span className="ml-auto" />
                  </div>
                </form>
                <form action={deleteTicketAction} className="mt-1 flex justify-end">
                  <input type="hidden" name="id" value={t.id} />
                  <ConfirmSubmitButton confirmMessage="Delete this ticket? This can't be undone." className="text-xs font-semibold text-red-600 hover:underline">
                    Delete
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
