import Link from "next/link";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { BarChart } from "@/components/admin/bar-chart";
import { describeItems } from "@/lib/paid-notes";
import { fmtDuration } from "@/lib/student-activity-format";
import type { Analytics, Person } from "@/lib/student-analytics";
import { STUDENT_STATUSES, type StudentStatusId } from "@/lib/student-status";

// Admin -> Students: everything about how students buy and read, last 30 days. Server component, no chart library.

const card = "rounded-xl border border-border bg-surface p-4";
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const hourShort = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

function Kpi({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: number | null }) {
  return (
    <div className={card}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-xs text-muted">
        {trend != null && <span className={trend >= 0 ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold text-red-600"}>{trend >= 0 ? "▲" : "▼"} {Math.abs(trend)}% </span>}
        {sub}
      </p>
    </div>
  );
}

function Panel({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`${card} ${className}`}>
      <p className="text-sm font-medium">{title}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
      <div className="mt-3">{children}</div>
    </div>
  );
}

function People({ list, empty }: { list: Person[]; empty: string }) {
  if (!list.length) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <ul className="divide-y divide-border">
      {list.slice(0, 8).map((p) => (
        <li key={p.email} className="flex items-center gap-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <Link href={`/admin/payments/students?email=${encodeURIComponent(p.email)}`} className="block truncate font-medium hover:text-accent">{p.email}</Link>
            <span className="block text-xs text-muted">{p.detail}</span>
          </span>
          {p.phone && (
            <a href={`https://wa.me/${p.phone}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${p.email}`} className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-green-600 text-white hover:bg-green-700">
              <WhatsappLogo size={16} weight="fill" />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export async function StudentInsights({
  a,
  byStatus,
  total,
  opened,
  topReaders,
  statusHref,
}: {
  a: Analytics;
  byStatus: Record<StudentStatusId, number>;
  total: number;
  opened: number;
  topReaders: { email: string; seconds: number }[];
  statusHref: (id: StudentStatusId) => string;
}) {
  const names = await describeItems([...new Set([...a.topSubjects.map((s) => s.key), ...a.unreadSubjects.map((s) => s.key)])]);
  const trend = a.revenue.prevTotal > 0 ? Math.round(((a.revenue.total - a.revenue.prevTotal) / a.revenue.prevTotal) * 100) : null;
  const arpu = a.students.paying ? Math.round(a.revenue.total / Math.max(1, a.students.paying)) : 0;
  // Average daily actives per weekday, from the 30-day series.
  const wd = WEEKDAYS.map(() => ({ sum: 0, n: 0 }));
  for (const d of a.engagement.dau) {
    const i = (new Date(`${d.day}T00:00:00Z`).getUTCDay() + 6) % 7;
    wd[i].sum += d.value;
    wd[i].n++;
  }
  const active7 = byStatus.today + byStatus.week;
  const funnel = [
    { label: "Students", value: total },
    { label: "Opened a note", value: opened },
    { label: "Read in last 30 days", value: a.engagement.active },
    { label: "Read this week", value: active7 },
  ];
  const planMax = Math.max(1, ...a.planMix.map((p) => p.count));
  const attention = [
    { id: "never", label: "Paid, never opened", list: a.neverRead, empty: "Everyone who paid has opened a note." },
    { id: "quiet", label: "Gone quiet 7d+", list: a.quiet, empty: "Nobody has gone quiet." },
    { id: "expiring", label: "Access ending", list: a.expiring, empty: "No access ends in the next 30 days." },
    { id: "sharing", label: "Login sharing?", list: a.sharing, empty: "No signs of shared logins." },
  ];

  return (
    <section className="mt-5 flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-medium">Insights · last 30 days</h2>
        <Link href="/admin/payments/analytics" className="text-sm text-accent hover:underline">More ranges &rarr;</Link>
      </div>

      {/* Money and conversion */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Revenue" value={rupees(a.revenue.total)} trend={trend} sub={`${a.revenue.orders} orders`} />
        <Kpi label="Average order" value={rupees(a.revenue.aov)} />
        <Kpi label="Per paying student" value={rupees(arpu)} />
        <Kpi label="New paying" value={String(a.students.newPaying)} sub={`${a.students.paying} paying in all`} />
        <Kpi label="Repeat buyers" value={String(a.students.repeat)} sub="bought again" />
        <Kpi label="Reading per active" value={fmtDuration(a.engagement.avgPerActive)} sub={`${a.engagement.activePct}% of buyers read`} />
      </div>

      {/* Trends */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Revenue per day" sub={`${rupees(a.revenue.total)} in 30 days`}>
          <BarChart label="Revenue per day, last 30 days" tone="bg-green-600" format={(v) => rupees(v)} data={a.revenue.byDay.map((d) => ({ label: shortDay(d.day), value: d.value }))} />
        </Panel>
        <Panel title="Daily active students" sub={`Average ${a.engagement.avgDau} a day`}>
          <BarChart label="Daily active students, last 30 days" data={a.engagement.dau.map((d) => ({ label: shortDay(d.day), value: d.value }))} />
        </Panel>
        <Panel title="Reading time per day" sub={`${fmtDuration(a.engagement.seconds)} in total`}>
          <BarChart label="Reading minutes per day, last 30 days" tone="bg-emerald-500" format={(v) => `${v}m`} data={a.engagement.readByDay.map((d) => ({ label: shortDay(d.day), value: d.value }))} />
        </Panel>
        <Panel title="When they read" sub="All-time reading by hour (India time)">
          <BarChart label="Reading by hour of day" tone="bg-indigo-400" format={(v) => fmtDuration(v)} data={a.hoursOfDay.map((v, h) => ({ label: hourShort(h), value: v }))} />
        </Panel>
      </div>

      {/* Who is engaged */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="How active are they?" sub="From each student's last reading">
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-muted" role="img" aria-label={STUDENT_STATUSES.map((x) => `${x.label} ${byStatus[x.id]}`).join(", ")}>
            {STUDENT_STATUSES.map((x) => byStatus[x.id] > 0 && <span key={x.id} className={x.dot} style={{ width: `${pct(byStatus[x.id], total)}%` }} />)}
          </div>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {STUDENT_STATUSES.map((x) => (
              <li key={x.id}>
                <Link href={statusHref(x.id)} className="flex items-center gap-2 hover:text-accent">
                  <span aria-hidden className={`size-2 rounded-full ${x.dot}`} />
                  <span className="flex-1 text-muted">{x.label}</span>
                  <span className="font-semibold tabular-nums">{byStatus[x.id]}</span>
                  <span className="w-10 text-right text-xs text-muted">{pct(byStatus[x.id], total)}%</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Reading funnel" sub="How far students get">
          <ul className="flex flex-col gap-2.5">
            {funnel.map((f) => (
              <li key={f.label} className="text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-muted">{f.label}</span>
                  <span className="font-semibold tabular-nums">{f.value} <span className="text-xs font-normal text-muted">{pct(f.value, total)}%</span></span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct(f.value, total)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Busiest days" sub="Average active students per weekday">
          <BarChart label="Average daily active students by weekday" height={96} format={(v) => (v / 10).toFixed(1)} data={wd.map((w, i) => ({ label: WEEKDAYS[i], value: w.n ? Math.round((w.sum / w.n) * 10) : 0 }))} />
        </Panel>
      </div>

      {/* What sells and what is read */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Top subjects" sub="By reading time" className="lg:col-span-2">
          {a.topSubjects.length === 0 ? (
            <p className="text-sm text-muted">No reading yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[30rem] text-sm">
                <thead className="text-left text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-medium">Subject</th>
                    <th className="pb-2 text-right font-medium">Readers</th>
                    <th className="pb-2 text-right font-medium">Bought</th>
                    <th className="pb-2 text-right font-medium">Time</th>
                    <th className="pb-2 pl-4 font-medium">Read through</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {a.topSubjects.slice(0, 8).map((t) => (
                    <tr key={t.key}>
                      <td className="max-w-[16rem] truncate py-2 font-medium">{names[t.key] ?? t.key}</td>
                      <td className="py-2 text-right tabular-nums">{t.readers}</td>
                      <td className="py-2 text-right tabular-nums">{t.buyers}</td>
                      <td className="py-2 text-right tabular-nums">{fmtDuration(t.seconds)}</td>
                      <td className="py-2 pl-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-muted" aria-hidden><div className="h-full rounded-full bg-accent" style={{ width: `${t.depth}%` }} /></div>
                          <span className="text-xs tabular-nums text-muted">{t.depth}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <div className="flex flex-col gap-3">
          <Panel title="What they buy" sub="Orders by plan size">
            {a.planMix.length === 0 ? (
              <p className="text-sm text-muted">No orders in 30 days.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {a.planMix.map((p) => (
                  <li key={p.label}>
                    <div className="flex justify-between gap-2"><span className="text-muted">{p.label}</span><span className="font-semibold tabular-nums">{p.count} · {rupees(p.amount)}</span></div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-muted" aria-hidden><div className="h-full rounded-full bg-green-600" style={{ width: `${pct(p.count, planMax)}%` }} /></div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Bought, never opened" sub="Subjects nobody has read yet">
            {a.unreadSubjects.length === 0 ? (
              <p className="text-sm text-muted">Every bought subject has been opened.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {a.unreadSubjects.slice(0, 6).map((u) => (
                  <li key={u.key} className="flex justify-between gap-2"><span className="truncate">{names[u.key] ?? u.key}</span><span className="shrink-0 text-xs text-muted">{u.buyers} bought</span></li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* People */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Top readers" sub="All-time reading">
          {topReaders.length === 0 ? (
            <p className="text-sm text-muted">No reading yet.</p>
          ) : (
            <ol className="flex flex-col gap-2 text-sm">
              {topReaders.map((r, i) => (
                <li key={r.email} className="flex items-center gap-3">
                  <span className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i === 0 ? "bg-amber-400 text-white" : "bg-surface-muted text-muted"}`}>{i + 1}</span>
                  <Link href={`/admin/payments/students?email=${encodeURIComponent(r.email)}`} className="min-w-0 flex-1 truncate hover:text-accent">{r.email}</Link>
                  <span className="shrink-0 font-semibold tabular-nums">{fmtDuration(r.seconds)}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <div className={`${card} lg:col-span-2`}>
          <p className="text-sm font-medium">Needs attention</p>
          <p className="text-xs text-muted">Message them before they drift away</p>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {attention.map((g) => (
              <div key={g.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{g.label} · {g.list.length}</p>
                <People list={g.list} empty={g.empty} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
