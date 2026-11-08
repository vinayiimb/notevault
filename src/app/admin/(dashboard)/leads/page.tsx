export const dynamic = "force-dynamic";
import Link from "next/link";
import { Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { setLeadNoteAction, setLeadStatusAction } from "@/lib/note-lead-actions";
import { LEAD_STATUSES, formatLeadPhone, leadWhatsAppText, type LeadStatusName } from "@/lib/note-leads";

const SOURCE_LABEL: Record<string, string> = {
  "notes-hub": "Notes page form",
  "notes-list": "Clicked a note",
  "note-page": "Note page card",
  "paper-pdf": "Opened a free paper",
};
const STATUS_ACTIONS: { status: LeadStatusName; label: string }[] = [
  { status: "CONTACTED", label: "Contacted" },
  { status: "CONVERTED", label: "Converted" },
  { status: "DROPPED", label: "Dropped" },
  { status: "NEW", label: "Back to new" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status: LeadStatusName = LEAD_STATUSES.find((s) => s === rawStatus) ?? "NEW";

  let data;
  try {
    const since = daysAgo(30);
    const [counts, leads, top] = await Promise.all([
      prisma.noteLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.noteLead.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.noteLead.groupBy({
        by: ["programmeSlug", "programme", "subjectSlug", "subject", "hasNotes"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { subjectSlug: "desc" } },
        take: 8,
      }),
    ]);
    const phones = [...new Set(leads.map((l) => l.phone))];
    const perPhone = await prisma.noteLead.groupBy({ by: ["phone"], where: { phone: { in: phones } }, _count: { _all: true } });
    data = { counts, leads, top, requests: new Map(perPhone.map((p) => [p.phone, p._count._all])) };
  } catch (err) {
    console.error("leads page:", err);
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Leads</h1>
        <p className="mt-4 max-w-xl rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Couldn&apos;t read the leads table. If this is a fresh deploy, the <code>add_note_lead</code> migration has
          not been applied to this database yet.
        </p>
      </div>
    );
  }
  const { counts, leads, top, requests } = data;
  const countOf = (s: LeadStatusName) => counts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Leads</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Students who left their number to get notes. Message them on WhatsApp (the text is pre-filled from what they
        asked for), then move them along as you talk.
      </p>

      {top.length > 0 && (
        <section className="mt-6 max-w-3xl">
          <h2 className="text-sm font-medium">Most asked for, last 30 days</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {top.map((t) => (
              <span
                key={`${t.programmeSlug}/${t.subjectSlug}`}
                className={`rounded-full border px-3 py-1 text-xs ${t.hasNotes ? "border-border text-muted" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}
                title={t.hasNotes ? "Notes ready" : "No notes yet — people are asking for this"}
              >
                {t.subject} · {t.programme} · {t._count._all}
              </span>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-muted">Amber = no notes written yet, so these are the ones worth making next.</p>
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/leads?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${s === status ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()} ({countOf(s)})
          </Link>
        ))}
      </div>

      {leads.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-4 flex max-w-3xl flex-col gap-3">
          {leads.map((l) => {
            const times = requests.get(l.phone) ?? 1;
            return (
              <li key={l.id} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-semibold tabular-nums">{formatLeadPhone(l.phone)}</p>
                  <p className="text-xs text-muted">{l.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                </div>
                <p className="mt-1.5 text-sm">
                  <span className="font-medium">{l.subject}</span>
                  <span className="text-muted">
                    {" "}· {l.programme}{l.semester ? ` · Sem ${l.semester}` : ""}
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${l.hasNotes ? "bg-success-soft text-success" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
                    {l.hasNotes ? "Notes ready" : "No notes yet"}
                  </span>
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted">{SOURCE_LABEL[l.source] ?? l.source}</span>
                  {times > 1 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{times} requests from this number</span>}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <a
                    href={`https://wa.me/${l.phone}?text=${encodeURIComponent(leadWhatsAppText(l))}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
                  >
                    <WhatsappLogo size={14} weight="bold" />
                    WhatsApp
                  </a>
                  <a
                    href={`tel:+${l.phone}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                  >
                    <Phone size={14} weight="bold" />
                    Call
                  </a>
                  <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                  {STATUS_ACTIONS.filter((a) => a.status !== l.status).map((a) => (
                    <form key={a.status} action={setLeadStatusAction}>
                      <input type="hidden" name="id" value={l.id} />
                      <input type="hidden" name="status" value={a.status} />
                      <button
                        type="submit"
                        className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                      >
                        {a.label}
                      </button>
                    </form>
                  ))}
                </div>

                <form action={setLeadNoteAction} className="mt-3 flex items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input
                    name="adminNote"
                    defaultValue={l.adminNote ?? ""}
                    maxLength={500}
                    placeholder="Note, e.g. wants Sem 3 combo, call after 6pm"
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button type="submit" className="rounded-lg border border-border px-3 py-2 text-xs text-muted hover:text-foreground">
                    Save
                  </button>
                </form>
                {l.contactedAt && (
                  <p className="mt-2 text-xs text-muted">
                    Last moved {l.contactedAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
