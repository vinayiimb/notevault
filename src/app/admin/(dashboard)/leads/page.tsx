export const dynamic = "force-dynamic";
import Link from "next/link";
import { Phone, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { OrderAccess } from "@/components/admin/order-access";
import { markOrderDeliveredAction, setLeadNoteAction, setLeadStatusAction } from "@/lib/note-lead-actions";
import { LEAD_STATUSES, formatLeadPhone, leadWhatsAppText, type LeadStatusName } from "@/lib/note-leads";
import { NOTES_DELIVERY_HOURS, orderPlanLabel, orderWhatsAppText } from "@/lib/notes-orders";
import { AlertsPanel } from "@/components/admin/alerts-panel";
import { CHAT_INBOX } from "@/lib/chat-link";
import { intentScore } from "@/lib/lead-intent";
import { parseOrderMeta, receivedOf } from "@/lib/order-meta";

const SOURCE_LABEL: Record<string, string> = {
  "notes-hub": "Notes page form",
  "notes-list": "Clicked a note",
  "note-page": "Note page card",
  "paper-pdf": "Opened a free paper",
  "pyq-page": "Landed on a papers page",
};
const STATUS_ACTIONS: { status: LeadStatusName; label: string }[] = [
  { status: "CONTACTED", label: "Contacted" },
  { status: "CONVERTED", label: "Converted" },
  { status: "DROPPED", label: "Dropped" },
  { status: "NEW", label: "Back to new" },
];

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const withinDays = (d: Date, n: number) => Date.now() - d.getTime() < n * 24 * 60 * 60 * 1000;
const hoursSince = (d: Date) => (Date.now() - d.getTime()) / (60 * 60 * 1000);

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
// Buttons are 44px tall on phones (thumb-sized) and compact from sm up.
const waBtn = "inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 sm:h-auto sm:px-3 sm:py-1.5 sm:text-xs";
const callBtn = "inline-flex size-11 items-center justify-center gap-1.5 rounded-lg border border-border text-muted hover:text-foreground sm:h-auto sm:w-auto sm:px-3 sm:py-1.5 sm:text-xs sm:font-medium";
const softBtn = "h-11 w-full rounded-lg border border-border px-3 text-sm text-muted hover:border-accent hover:text-accent sm:h-auto sm:w-auto sm:py-1.5 sm:text-xs";

const VIEWS = [
  { id: "orders", label: "Orders" },
  { id: "numbers", label: "Numbers" },
  { id: "visitors", label: "No number" },
  { id: "insights", label: "Insights" },
] as const;
type ViewId = (typeof VIEWS)[number]["id"];

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "good" | "warn" | "hot" }) {
  const color = tone === "good" ? "text-green-700 dark:text-green-400" : tone === "warn" ? "text-amber-700 dark:text-amber-400" : tone === "hot" ? "text-red-600" : "";
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${color}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default async function AdminLeadsPage({ searchParams }: { searchParams: Promise<{ status?: string; view?: string }> }) {
  const { status: rawStatus, view: rawView } = await searchParams;
  const status: LeadStatusName = LEAD_STATUSES.find((s) => s === rawStatus) ?? "NEW";

  // Section 1: students who paid directly in the pop-up (Razorpay). Hand-added tracker rows start with "manual-", so they never show here.
  // Section 2: a simple per-student summary of every order. Separate queries so a database without the table still shows leads.
  const direct = { razorpayOrderId: { not: { startsWith: "manual-" } } };
  let orders: { paid: Awaited<ReturnType<typeof prisma.notesOrder.findMany>>; delivered: Awaited<ReturnType<typeof prisma.notesOrder.findMany>>; all: Awaited<ReturnType<typeof prisma.notesOrder.findMany>> } | null = null;
  try {
    const [paid, delivered, all] = await Promise.all([
      prisma.notesOrder.findMany({ where: { status: "PAID", ...direct }, orderBy: { paidAt: "asc" }, take: 100 }),
      prisma.notesOrder.findMany({ where: { status: "DELIVERED", ...direct }, orderBy: { deliveredAt: "desc" }, take: 10 }),
      prisma.notesOrder.findMany({ orderBy: { paidAt: "desc" }, take: 1000 }),
    ]);
    orders = { paid, delivered, all };
  } catch (err) {
    console.error("orders not read:", err);
  }
  // Tracker rows: one per student (phone, or Gmail when they have no phone).
  const tracker = new Map<string, { phone: string; gmail: string; subjects: number; received: number; toSend: number; last: Date }>();
  for (const o of orders?.all ?? []) {
    const m = parseOrderMeta(o.adminNote);
    const key = o.phone || `mail:${m.gmail}`;
    const t = tracker.get(key) ?? { phone: o.phone, gmail: "", subjects: 0, received: 0, toSend: 0, last: o.paidAt };
    if (m.gmail) t.gmail = m.gmail;
    if (!m.under) t.subjects += 1; // subjects listed under a whole-semester order are not counted twice
    t.received += receivedOf(o.amount, m);
    if (o.status === "PAID") t.toSend += 1;
    tracker.set(key, t);
  }
  const trackerRows = [...tracker.values()].sort((a, b) => b.toSend - a.toSend || b.last.getTime() - a.last.getTime()).slice(0, 15);

  let data;
  try {
    const since = daysAgo(30);
    const [counts, leads, top, week] = await Promise.all([
      prisma.noteLead.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.noteLead.findMany({ where: { status }, orderBy: { createdAt: "desc" }, take: 300 }),
      prisma.noteLead.groupBy({
        by: ["programmeSlug", "programme", "subjectSlug", "subject", "hasNotes"],
        where: { createdAt: { gte: since } },
        _count: { _all: true },
        orderBy: { _count: { subjectSlug: "desc" } },
        take: 8,
      }),
      prisma.noteLead.count({ where: { createdAt: { gte: daysAgo(7) } } }),
    ]);
    const phones = [...new Set(leads.map((l) => l.phone))];
    const perPhone = await prisma.noteLead.groupBy({ by: ["phone"], where: { phone: { in: phones } }, _count: { _all: true } });
    data = { counts, leads, top, week, requests: new Map(perPhone.map((p) => [p.phone, p._count._all])) };
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
  // Funnel clicks (Yes / opened chat / chose WhatsApp). Separate query: a database without the LeadIntent table yet
  // still shows every lead, just without the flags.
  let intents: Awaited<ReturnType<typeof prisma.leadIntent.findMany>> = [];
  try {
    intents = await prisma.leadIntent.findMany({ where: { createdAt: { gte: daysAgo(30) } }, orderBy: { createdAt: "desc" }, take: 500 });
  } catch (err) {
    console.error("lead intents not read (migration not applied?):", err);
  }
  const flagsOf = new Map<string, { yes: boolean; chat: boolean; wa: boolean }>();
  for (const i of intents) {
    if (!i.phone) continue;
    const f = flagsOf.get(i.phone) ?? { yes: false, chat: false, wa: false };
    flagsOf.set(i.phone, { yes: true, chat: f.chat || !!i.chatAt, wa: f.wa || !!i.waAt });
  }
  const unreached = intents
    .filter((i) => !i.phone && withinDays(i.createdAt, 3))
    .sort((a, b) => intentScore(b) - intentScore(a) || b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 40);
  const { counts, top, requests, week } = data;
  // Hot first: someone who opened the chat or chose WhatsApp outranks a bare number, then newest first.
  const hot = (phone: string) => { const f = flagsOf.get(phone); return f ? intentScore({ chatAt: f.chat ? "x" : null, waAt: f.wa ? "x" : null }) : 0; };
  const leads = [...data.leads].sort((a, b) => hot(b.phone) - hot(a.phone) || b.createdAt.getTime() - a.createdAt.getTime());
  const countOf = (s: LeadStatusName) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const toSend = orders?.paid.length ?? 0;
  const view: ViewId = VIEWS.find((v) => v.id === rawView)?.id ?? (rawStatus ? "numbers" : toSend > 0 ? "orders" : "numbers");
  const totalLeads = LEAD_STATUSES.reduce((n, st) => n + countOf(st), 0);
  const convRate = totalLeads ? Math.round((countOf("CONVERTED") / totalLeads) * 100) : 0;
  const badge: Record<ViewId, number> = { orders: toSend, numbers: countOf("NEW"), visitors: unreached.length, insights: 0 };

  return (
    <div className="px-4 py-5 sm:p-8">
      <h1 className="text-2xl font-semibold">Leads</h1>

      {/* At a glance */}
      <div className="mt-4 grid max-w-5xl grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Paid, notes to send" value={toSend} tone={toSend ? "good" : undefined} hint={`within ${NOTES_DELIVERY_HOURS}h`} />
        <Tile label="New numbers" value={countOf("NEW")} tone={countOf("NEW") ? "hot" : undefined} hint="not contacted yet" />
        <Tile label="Contacted" value={countOf("CONTACTED")} />
        <Tile label="Converted" value={countOf("CONVERTED")} hint={`${convRate}% of all numbers`} tone="good" />
        <Tile label="Said Yes, no number" value={unreached.length} hint="last 3 days" tone={unreached.length ? "warn" : undefined} />
        <Tile label="Numbers this week" value={week} hint={`${totalLeads} in total`} />
      </div>

      {/* One job per tab */}
      <nav aria-label="Leads sections" className="mt-5 grid max-w-3xl grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1 sm:grid-cols-4">
        {VIEWS.map((v) => (
          <Link
            key={v.id}
            href={`/admin/leads?view=${v.id}`}
            aria-current={view === v.id ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${view === v.id ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
          >
            {v.label}
            {badge[v.id] > 0 && <span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${view === v.id ? "bg-accent text-accent-foreground" : "bg-border text-muted"}`}>{badge[v.id]}</span>}
          </Link>
        ))}
      </nav>

      {view === "orders" && !orders && <p className="mt-6 text-sm text-muted">Orders table not readable yet (migration?).</p>}
      {view === "orders" && orders && (
        <section id="paid" className="mt-6 max-w-3xl scroll-mt-4">
          <h2 className="text-lg font-semibold">
            Paid directly{orders.paid.length > 0 ? <span className="text-green-600"> · {orders.paid.length} to send</span> : ""}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Paid in the pop-up themselves. Ask for their Gmail on WhatsApp, type it in Give site access, done. Promised within{" "}
            {NOTES_DELIVERY_HOURS} hours.
          </p>
          {orders.paid.length === 0 && <p className="mt-3 text-sm text-muted">Nobody waiting.</p>}
          <ul className="mt-3 flex flex-col gap-3">
            {orders.paid.map((o) => {
              const overdue = hoursSince(o.paidAt) > NOTES_DELIVERY_HOURS;
              return (
                <li key={o.id} className="rounded-xl border-2 border-green-600/40 bg-green-600/5 p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-lg font-semibold tabular-nums">{formatLeadPhone(o.phone)}</p>
                    <p className="text-xs text-muted">Paid {o.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                  </div>
                  <p className="mt-1.5 text-sm">
                    <span className="font-medium">{orderPlanLabel(o)}</span>
                    <span className="text-muted"> · {o.programme}{o.semester ? ` · Sem ${o.semester}` : ""}</span>
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full bg-green-600 px-2 py-0.5 font-semibold text-white">₹{o.amount} paid</span>
                    {overdue && <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-medium text-red-600">Past {NOTES_DELIVERY_HOURS}h</span>}
                  </div>
                  <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
                    <a
                      href={`https://wa.me/${o.phone}?text=${encodeURIComponent(orderWhatsAppText(o))}`}
                      target="_blank"
                      rel="noreferrer"
                      className={waBtn}
                    >
                      <WhatsappLogo size={16} weight="bold" />
                      WhatsApp
                    </a>
                    <a href={`tel:+${o.phone}`} aria-label="Call" className={callBtn}>
                      <Phone size={16} weight="bold" />
                      <span className="sr-only sm:not-sr-only">Call</span>
                    </a>
                    <form action={markOrderDeliveredAction} className="col-span-2 sm:col-auto">
                      <input type="hidden" name="id" value={o.id} />
                      <button type="submit" className={softBtn}>
                        Mark delivered
                      </button>
                    </form>
                  </div>
                  <OrderAccess id={o.id} subjects={orderPlanLabel(o)} />
                </li>
              );
            })}
          </ul>
          {orders.delivered.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-muted">Recently delivered ({orders.delivered.length})</summary>
              <ul className="mt-2 flex flex-col gap-2">
                {orders.delivered.map((o) => (
                  <li key={o.id} className="flex flex-col gap-1.5 rounded-lg border border-border px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <span>
                      <span className="font-medium">{orderPlanLabel(o)}</span>
                      <span className="text-muted"> · {o.programme}{o.semester ? ` · Sem ${o.semester}` : ""} · {formatLeadPhone(o.phone)} · ₹{o.amount}</span>
                    </span>
                    <form action={markOrderDeliveredAction}>
                      <input type="hidden" name="id" value={o.id} />
                      <input type="hidden" name="status" value="PAID" />
                      <button type="submit" className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline">
                        Undo
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
      )}


      {view === "orders" && (
      <section id="tracker" className="mt-10 max-w-3xl scroll-mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Tracker</h2>
          <Link href="/admin/leads/delivery" className="text-sm font-medium text-accent hover:underline">Open full tracker &rarr;</Link>
        </div>
        {trackerRows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No students yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
            {trackerRows.map((t) => (
              <li key={t.phone || t.gmail} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block font-medium tabular-nums">{t.phone ? formatLeadPhone(t.phone) : t.gmail}</span>
                  {t.phone && t.gmail && <span className="block break-all text-xs text-muted">{t.gmail}</span>}
                </span>
                <span className="flex items-center gap-3 text-xs text-muted">
                  <span>{t.subjects} subject{t.subjects === 1 ? "" : "s"}</span>
                  <span className="font-semibold text-foreground">₹{t.received}</span>
                  <span className={t.toSend ? "font-semibold text-amber-600" : "text-green-600"}>{t.toSend ? `${t.toSend} to send` : "Sent ✓"}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      )}

      {view === "numbers" && (<>
      <section id="numbers" className="mt-6 max-w-3xl scroll-mt-4">
        <h2 className="text-lg font-semibold">WhatsApp numbers</h2>
        <p className="mt-1 text-sm text-muted">Left their number for notes. Message them, then move them along.</p>
      </section>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {LEAD_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/leads?view=numbers&status=${s}`}
            className={`rounded-lg border px-3 py-2.5 text-center text-sm sm:py-1.5 ${s === status ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
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
            const flags = flagsOf.get(l.phone);
            return (
              <li key={l.id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
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
                  {flags && (flags.chat || flags.wa) && <span className="rounded-full bg-red-500/10 px-2 py-0.5 font-semibold text-red-600">🔥 Hot</span>}
                  <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted">{SOURCE_LABEL[l.source] ?? l.source}</span>
                  {flags && (
                    <>
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted">👍 Clicked Yes</span>
                      <span className={`rounded-full px-2 py-0.5 ${flags.chat ? "bg-green-600/10 font-medium text-green-700" : "bg-surface-muted text-muted"}`}>
                        {flags.chat ? "💬 Opened chat" : "Chat not opened"}
                      </span>
                      {flags.wa && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted">Chose WhatsApp</span>}
                    </>
                  )}
                  {times > 1 && <span className="rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent">{times} requests from this number</span>}
                </div>

                <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <a
                    href={`https://wa.me/${l.phone}?text=${encodeURIComponent(leadWhatsAppText(l))}`}
                    target="_blank"
                    rel="noreferrer"
                    className={waBtn}
                  >
                    <WhatsappLogo size={16} weight="bold" />
                    WhatsApp
                  </a>
                  <a href={`tel:+${l.phone}`} aria-label="Call" className={callBtn}>
                    <Phone size={16} weight="bold" />
                    <span className="sr-only sm:not-sr-only">Call</span>
                  </a>
                  <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                  <div className="col-span-2 grid grid-cols-3 gap-2 sm:contents">
                    {STATUS_ACTIONS.filter((a) => a.status !== l.status).map((a) => (
                      <form key={a.status} action={setLeadStatusAction}>
                        <input type="hidden" name="id" value={l.id} />
                        <input type="hidden" name="status" value={a.status} />
                        <button type="submit" className={softBtn}>
                          {a.label}
                        </button>
                      </form>
                    ))}
                  </div>
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
      </>)}

      {view === "visitors" && unreached.length === 0 && <p className="mt-6 text-sm text-muted">Nobody in the last 3 days.</p>}
      {view === "visitors" && unreached.length > 0 && (
        <section className="mt-6 max-w-3xl">
          <h2 className="text-lg font-semibold">
            Said Yes, no number yet<span className="text-amber-600"> · {unreached.length}</span>
          </h2>
          <p className="mt-1 text-sm text-muted">
            They never left a number, so the live chat is the only way to reach them. Warmest first: the ones that opened the
            chat may write any moment.{" "}
            <a href={CHAT_INBOX} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">
              Open the chat inbox →
            </a>
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {unreached.map((i) => (
              <li key={i.id} className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">
                  <span className="font-medium">{i.subject || "Notes"}</span>
                  <span className="text-muted">{i.programme ? ` · ${i.programme}` : ""}{i.semester ? ` · Sem ${i.semester}` : ""}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${i.chatAt ? "bg-green-600/10 text-green-700" : "bg-surface-muted text-muted"}`}>
                    {i.chatAt ? "💬 Opened chat" : "Chat not opened"}
                  </span>
                  {i.waAt && <span className="rounded-full bg-surface-muted px-2 py-0.5 text-muted">Chose WhatsApp, no number</span>}
                  <span className="text-muted">{i.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {view === "insights" && (<div className="max-w-3xl">
      {top.length > 0 && (
        <section className="mt-6">
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
      <AlertsPanel />
      </div>)}
    </div>
  );
}
