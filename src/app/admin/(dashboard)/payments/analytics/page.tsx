export const dynamic = "force-dynamic";
import Link from "next/link";
import { describeItems } from "@/lib/paid-notes";
import { getAnalytics } from "@/lib/student-activity";
import { fmtDuration, hourLabel } from "@/lib/student-activity-format";
import type { Person } from "@/lib/student-analytics";

const RANGES = [7, 30, 90] as const;
const card = "rounded-xl border border-border bg-surface p-4 sm:p-5";

const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range } = await searchParams;
  const days = RANGES.find((r) => String(r) === range) ?? 30;
  const a = await getAnalytics(days);

  return (
    <div className="p-4 sm:p-8">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-foreground">&larr; Payments</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin/payments/analytics?range=${r}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${r === days ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
            >
              {r} days
            </Link>
          ))}
          <Link href="/admin/payments/students" className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">Students &rarr;</Link>
        </div>
      </div>

      {a === null ? (
        <p className="mt-6 max-w-2xl rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
          Analytics starts once the student-activity migration is applied.
        </p>
      ) : (
        <Body a={a} days={days} />
      )}
    </div>
  );
}

async function Body({ a, days }: { a: NonNullable<Awaited<ReturnType<typeof getAnalytics>>>; days: number }) {
  const names = await describeItems([...new Set([...a.topSubjects.map((s) => s.key), ...a.unreadSubjects.map((s) => s.key)])]);
  const delta = a.revenue.prevTotal > 0 ? Math.round(((a.revenue.total - a.revenue.prevTotal) / a.revenue.prevTotal) * 100) : null;
  const peak = a.hoursOfDay.some((v) => v > 0) ? a.hoursOfDay.indexOf(Math.max(...a.hoursOfDay)) : null;

  return (
    <div className="mt-6 flex max-w-5xl flex-col gap-6">
      {/* Headline numbers */}
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label={`Revenue · ${days} days`} value={rupees(a.revenue.total)} sub={delta === null ? `${a.revenue.orders} orders` : `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)}% vs previous ${days} days · ${a.revenue.orders} orders`} />
        <Tile label="Average order" value={rupees(a.revenue.aov)} sub={`${a.students.repeat} repeat buyer${a.students.repeat === 1 ? "" : "s"} (all time)`} />
        <Tile label="Paying students" value={String(a.students.paying)} sub={`${a.students.newPaying} new in ${days} days`} />
        <Tile label="Reading time" value={fmtDuration(a.engagement.seconds)} sub={`${fmtDuration(a.engagement.avgPerActive)} per active student`} />
        <Tile label="Active students" value={String(a.engagement.active)} sub={`${a.engagement.activePct}% of paying students`} />
        <Tile label="Paid, never opened" value={String(a.neverRead.length)} sub="bought 2+ days ago, zero reading" tone={a.neverRead.length ? "warn" : undefined} />
      </dl>

      {/* Revenue */}
      <section className={card}>
        <h2 className="font-medium">Revenue per day</h2>
        <Bars items={a.revenue.byDay.map((d) => ({ label: shortDay(d.day), value: d.value, title: `${shortDay(d.day)}: ${rupees(d.value)}` }))} />
        {a.planMix.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-medium">What they buy</h3>
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {a.planMix.map((m) => (
                <li key={m.label} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span>{m.label}</span>
                  <span className="text-muted"><strong className="text-foreground">{m.count}</strong> order{m.count === 1 ? "" : "s"} · {rupees(m.amount)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Engagement */}
      <section className={card}>
        <h2 className="font-medium">Students reading per day</h2>
        <p className="text-xs text-muted">Average {a.engagement.avgDau} a day</p>
        <Bars items={a.engagement.dau.map((d) => ({ label: shortDay(d.day), value: d.value, title: `${shortDay(d.day)}: ${d.value} student${d.value === 1 ? "" : "s"}` }))} />
        <h3 className="mt-5 text-sm font-medium">When they study{peak !== null && <span className="font-normal text-muted"> · busiest around {hourLabel(peak)}</span>}</h3>
        <Bars
          items={a.hoursOfDay.map((v, h) => ({ label: h % 6 === 0 ? hourLabel(h) : "", value: v, title: `${hourLabel(h)}: ${fmtDuration(v)}` }))}
          showEnds={false}
        />
      </section>

      {/* Subjects */}
      <section className={card}>
        <h2 className="font-medium">Most-read subjects</h2>
        {a.topSubjects.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No reading in this period yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {a.topSubjects.map((s) => (
              <li key={s.key} className="py-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 font-medium">{names[s.key] ?? s.key}</span>
                  <span className="shrink-0 font-semibold">{fmtDuration(s.seconds)}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted">
                  {s.readers} of {s.buyers} buyer{s.buyers === 1 ? "" : "s"} reading · opened {s.opens}× · reach about {s.depth}% of the note
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${s.depth}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {a.unreadSubjects.length > 0 && (
          <>
            <h3 className="mt-5 text-sm font-medium">Bought, but nobody has opened</h3>
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {a.unreadSubjects.map((s) => (
                <li key={s.key} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">{names[s.key] ?? s.key}</span>
                  <span className="shrink-0 text-muted">{s.buyers} buyer{s.buyers === 1 ? "" : "s"}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* Follow up */}
      <People title="Paid but never opened a note" hint="Highest-value nudge: they paid and haven't started." people={a.neverRead} message={(p) => `Hi! You bought notes on DU PYQ Online but haven't opened them yet. Sign in at dupyq.online/account with ${p.email} to start. Reply here if you need help logging in.`} />
      <People title="Gone quiet (7+ days)" hint="Reading before, silent now, access still active." people={a.quiet} message={() => "Hi! Your DU PYQ Online notes are waiting for you at dupyq.online/account. Need any subject or help? Just reply here."} />
      <People title="Access ending in 30 days" hint="Renewal chances. Access lasts 6 months from purchase." people={a.expiring} message={(p) => `Hi! ${p.detail.replace("Access ends", "Your DU PYQ Online notes access ends")}. You can renew at dupyq.online/paid-notes.`} />
      <People title="Possible login sharing" hint="Two or more device swaps in 30 days. Check before acting; a lost phone looks the same." people={a.sharing} />
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5 sm:p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 text-2xl font-semibold ${tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""}`}>{value}</dd>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Bars({ items, showEnds = true }: { items: { label: string; value: number; title: string }[]; showEnds?: boolean }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="mt-3">
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Bar chart">
        {items.map((i, n) => (
          <div key={n} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={i.title}>
            <div className="w-full rounded-sm bg-accent" style={{ height: `${i.value ? Math.max(4, (i.value / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[3px] text-[10px] text-muted">
        {showEnds
          ? items.map((i, n) => <span key={n} className="min-w-0 flex-1 whitespace-nowrap">{n === 0 || n === items.length - 1 || n === Math.floor(items.length / 2) ? i.label : ""}</span>)
          : items.map((i, n) => <span key={n} className="min-w-0 flex-1 whitespace-nowrap">{i.label}</span>)}
      </div>
    </div>
  );
}

function People({ title, hint, people, message }: { title: string; hint: string; people: Person[]; message?: (p: Person) => string }) {
  return (
    <section className={card}>
      <h2 className="font-medium">{title} <span className="font-normal text-muted">({people.length})</span></h2>
      <p className="text-xs text-muted">{hint}</p>
      {people.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nobody right now.</p>
      ) : (
        <ul className="mt-2 flex flex-col divide-y divide-border">
          {people.slice(0, 25).map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/payments/students?email=${encodeURIComponent(p.email)}`} className="block break-all font-medium hover:text-accent">{p.email}</Link>
                <p className="text-xs text-muted">{p.detail}</p>
              </div>
              {message && p.phone && (
                <a
                  href={`https://wa.me/${p.phone}?text=${encodeURIComponent(message(p))}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-accent hover:text-accent"
                >
                  WhatsApp
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
