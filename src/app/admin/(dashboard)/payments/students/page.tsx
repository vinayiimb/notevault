export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeItems, EXTRA_ITEMS, getNotesCatalog } from "@/lib/paid-notes";
import { addStudentAction, grantSubjectsAction, resetStudentDevicesAction, revokeSubjectAction, setSubjectLimitAction } from "@/lib/paid-notes-actions";
import { listLiveDevices, liveDeviceCounts } from "@/lib/student-devices";
import { MAX_DEVICES } from "@/lib/student-device-policy";
import { ResetPasswordButton } from "@/components/admin/payment-approve";
import { getActivitySummaries, getAnalytics, getStudentActivity } from "@/lib/student-activity";
import { BarChart } from "@/components/admin/bar-chart";
import { StudentInsights } from "@/components/admin/student-insights";
import { STUDENT_STATUSES, statusInfo, studentStatus, type StudentStatusId } from "@/lib/student-status";
import { deletePurchaseAction, deleteStudentAction, updatePurchaseAction } from "@/lib/admin-student-actions";
import { fmtDuration, hourLabel } from "@/lib/student-activity-format";
import { accessExpiry } from "@/lib/paid-notes-pricing";
import { shortDate, timeAgo } from "@/lib/time-ago";
import { listSubjects, getSubjectLimit } from "@/lib/student-dashboard";
import { DEFAULT_MAX_SUBJECTS, MAX_SUBJECT_LIMIT } from "@/lib/feathers";
import { listNotices, NOTICE_AUDIENCES, MAX_NOTICE_BODY, MAX_NOTICE_TITLE } from "@/lib/student-notices";
import { deleteNoticeAction, markRepliesSeenAction, sendNoticeAction, toggleNoticeAction } from "@/lib/student-notice-actions";

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const card = "rounded-xl border border-border bg-surface";
const WEEK_MS = 7 * 86_400_000;
const withinWeek = (d: Date | null) => !!d && Date.now() - d.getTime() < WEEK_MS;
const FILTERS = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "sample", label: "Sample" },
  { id: "active", label: "Active" },
  { id: "slipping", label: "Slipping" },
  { id: "inactive", label: "Inactive" },
  { id: "never", label: "Never read" },
] as const;
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const hourShort = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

function StatusBadge({ id }: { id: StudentStatusId }) {
  const s = statusInfo(id);
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}>
      <span aria-hidden className={`size-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}
const SORTS = [
  { id: "recent", label: "Newest" },
  { id: "reading", label: "Most reading" },
  { id: "paid", label: "Top paid" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];
type SortId = (typeof SORTS)[number]["id"];

function Tile({ label, value, hint, tone }: { label: string; value: string | number; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className={`${card} p-3.5 sm:p-4`}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums sm:text-2xl ${tone === "good" ? "text-green-700 dark:text-green-400" : tone === "warn" ? "text-amber-700 dark:text-amber-400" : ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

type Student = { email: string; phone: string; unlocked: Set<string>; paid: number; pending: number; lastAt: Date; seconds: number; lastActive: Date | null };


// Adds the hand-built paid pages (EXTRA_ITEMS) to the picker, without duplicating a subject that already has a note.
function withExtras(catalog: Awaited<ReturnType<typeof getNotesCatalog>>) {
  const out = catalog.map((p) => ({ ...p, subjects: [...p.subjects] }));
  for (const e of EXTRA_ITEMS) {
    let prog = out.find((p) => p.slug === e.programmeSlug);
    if (!prog) { prog = { slug: e.programmeSlug, name: e.programme, subjects: [] }; out.push(prog); }
    if (!prog.subjects.some((x) => x.slug === e.subjectSlug)) prog.subjects.push({ slug: e.subjectSlug, name: e.subject, semester: e.semester });
  }
  return out;
}

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; email?: string; f?: string; sort?: string }> }) {
  const { q = "", email, f, sort } = await searchParams;
  const filter: FilterId = FILTERS.find((x) => x.id === f)?.id ?? "all";
  const order: SortId = SORTS.find((x) => x.id === sort)?.id ?? "recent";
  return (
    <div className="p-4 sm:p-8">
      <nav className="flex gap-4 text-sm text-muted">
        <Link href={email ? "/admin/payments/students" : "/admin/payments"} className="hover:text-foreground">&larr; {email ? "All students" : "Payments"}</Link>
        <Link href="/admin/payments/analytics" className="hover:text-foreground">Analytics &rarr;</Link>
      </nav>
      <h1 className="mt-2 text-2xl font-semibold">Students</h1>
      {!email && <p className="mt-1 text-sm text-muted">Everyone who has paid or been given access. Open a student to manage subjects, devices and payments.</p>}
      {email ? <StudentDetail email={email.trim().toLowerCase()} /> : <StudentList q={q.trim().toLowerCase()} filter={filter} order={order} />}
    </div>
  );
}

async function StudentList({ q, filter, order }: { q: string; filter: FilterId; order: SortId }) {
  // ponytail: loads every purchase and groups in memory; add pagination when it reaches thousands.
  const [purchases, activity, deviceCounts, notices, analytics] = await Promise.all([
    prisma.purchase.findMany({
      where: q ? { email: { contains: q } } : undefined,
      orderBy: { createdAt: "desc" },
      select: { email: true, phone: true, items: true, amount: true, status: true, createdAt: true },
    }),
    getActivitySummaries(), // null = activity migration not applied yet
    liveDeviceCounts(), // null = device migration not applied yet
    listNotices(), // null = notice migration not applied yet
    getAnalytics(30), // null = activity migration not applied yet
  ]);
  const byEmail = new Map<string, Student>();
  for (const p of purchases) {
    const a = activity?.get(p.email);
    const s = byEmail.get(p.email) ?? { email: p.email, phone: p.phone, unlocked: new Set(), paid: 0, pending: 0, lastAt: p.createdAt, seconds: a?.seconds ?? 0, lastActive: a?.lastAt ?? null };
    if (!s.phone) s.phone = p.phone;
    if (p.status === "APPROVED") {
      p.items.forEach((k) => s.unlocked.add(k));
      s.paid += p.amount;
    }
    if (p.status === "PENDING") s.pending++;
    byEmail.set(p.email, s);
  }
  const all = [...byEmail.values()];
  const activeRecently = (s: Student) => withinWeek(s.lastActive);
  const statusOf = (s: Student) => studentStatus(s.lastActive);
  const byStatus = Object.fromEntries(STUDENT_STATUSES.map((x) => [x.id, 0])) as Record<StudentStatusId, number>;
  for (const st of all) byStatus[statusOf(st)]++;
  const stats = {
    total: all.length,
    paid: all.filter((s) => s.paid > 0).length,
    revenue: all.reduce((n, s) => n + s.paid, 0),
    pending: all.reduce((n, s) => n + s.pending, 0),
    active: all.filter(activeRecently).length,
    idle: all.filter((s) => s.seconds === 0).length,
    seconds: all.reduce((n, s) => n + s.seconds, 0),
  };
  const counts: Record<FilterId, number> = { all: stats.total, paid: stats.paid, sample: stats.total - stats.paid, active: byStatus.today + byStatus.week, slipping: byStatus.slipping, inactive: byStatus.inactive, never: byStatus.never };
  const students = all
    .filter((s) => {
      const st = statusOf(s);
      return filter === "all" || (filter === "paid" ? s.paid > 0 : filter === "sample" ? s.paid === 0 : filter === "active" ? st === "today" || st === "week" : st === filter);
    })
    .sort((a, b) => (order === "reading" ? b.seconds - a.seconds : order === "paid" ? b.paid - a.paid : 0) || b.lastAt.getTime() - a.lastAt.getTime());
  const href = (next: { f?: FilterId; sort?: SortId }) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    const f2 = next.f ?? filter, s2 = next.sort ?? order;
    if (f2 !== "all") sp.set("f", f2);
    if (s2 !== "recent") sp.set("sort", s2);
    const qs = sp.toString();
    return `/admin/payments/students${qs ? `?${qs}` : ""}`;
  };
  const open = (email: string) => `/admin/payments/students?email=${encodeURIComponent(email)}`;
  const reading = (s: Student) => (s.seconds > 0 ? fmtDuration(s.seconds) : "—");
  const last = (s: Student) => (s.lastActive ? timeAgo(s.lastActive.toISOString()) : "Never");

  return (
    <div className="max-w-5xl">
      {/* 1. At a glance */}
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Students" value={stats.total} />
        <Tile label="Paid" value={stats.paid} hint={`${stats.total - stats.paid} sample`} tone="good" />
        <Tile label="Revenue" value={`₹${stats.revenue.toLocaleString("en-IN")}`} />
        <Tile label="Pending payments" value={stats.pending} tone={stats.pending ? "warn" : undefined} />
        <Tile label="Active last 7 days" value={activity ? stats.active : "—"} hint={activity ? `${fmtDuration(stats.seconds)} read in total` : "tracking off"} />
        <Tile label="Never opened notes" value={activity ? stats.idle : "—"} tone={stats.idle ? "warn" : undefined} hint="worth a nudge" />
      </div>
      {activity === null && (
        <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Reading-time tracking starts once the student-activity migration is applied.
        </p>
      )}

      {/* 2. Insights: money, reading, who needs a nudge */}
      {activity && analytics && (
        <StudentInsights
          a={analytics}
          byStatus={byStatus}
          total={stats.total}
          opened={stats.total - stats.idle}
          topReaders={[...all].filter((x) => x.seconds > 0).sort((x, y) => y.seconds - x.seconds).slice(0, 5).map((x) => ({ email: x.email, seconds: x.seconds }))}
          statusHref={(id) => href({ f: id === "today" || id === "week" ? "active" : id })}
        />
      )}

      {/* 3. Tools: add a student, message everyone */}
      <div className="mt-5 grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <details className={`${card} group`}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium">
            Add a student <span className="text-muted transition group-open:rotate-90">&rsaquo;</span>
          </summary>
          <form action={addStudentAction} className="flex flex-col gap-3 border-t border-border p-4">
            <input name="email" type="email" required placeholder="Student's Gmail" className={inputClass} />
            <input name="phone" inputMode="tel" placeholder="WhatsApp number (optional)" className={inputClass} />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" name="type" value="sample" defaultChecked /> Sample student</label>
              <label className="flex items-center gap-1.5"><input type="radio" name="type" value="paid" /> Paid student</label>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <input name="subjects" type="number" min={1} max={MAX_SUBJECT_LIMIT} placeholder="Subjects (if paid)" className={inputClass} />
              <input name="amount" type="number" min={0} placeholder="Amount ₹ (if paid)" className={inputClass} />
            </div>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90">Add student</button>
          </form>
        </details>

        <details className={`${card} group`}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 font-medium">
            <span>
              Message students
              {notices && notices.some((n) => n.active) && <span className="ml-2 rounded-full bg-green-600/10 px-2 py-0.5 text-[11px] font-semibold text-green-700">{notices.filter((n) => n.active).length} live</span>}
              {notices && notices.some((n) => n.replies.some((r) => !r.seen)) && (
                <span className="ml-1.5 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                  {notices.reduce((k, n) => k + n.replies.filter((r) => !r.seen).length, 0)} new {notices.reduce((k, n) => k + n.replies.filter((r) => !r.seen).length, 0) === 1 ? "reply" : "replies"}
                </span>
              )}
            </span>
            <span className="text-muted transition group-open:rotate-90">&rsaquo;</span>
          </summary>
          <div className="border-t border-border p-4">
            {notices === null ? (
              <p className="text-sm text-amber-800 dark:text-amber-300">
                Apply the <code>20261114120000_add_student_notice</code> migration to switch this on.
              </p>
            ) : (
              <>
                <form action={sendNoticeAction} className="flex flex-col gap-2.5">
                  <p className="text-xs text-muted">Shows at the top of their dashboard (/account) until you hide it.</p>
                  <input name="title" required maxLength={MAX_NOTICE_TITLE} placeholder="Title, e.g. Sem 3 notes are out" className={inputClass} />
                  <textarea name="body" required maxLength={MAX_NOTICE_BODY} rows={3} placeholder="Message" className={inputClass} />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select name="audience" defaultValue="ALL" className={`${inputClass} sm:flex-1`}>
                      {NOTICE_AUDIENCES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                    </select>
                    <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground hover:opacity-90">Send to dashboards</button>
                  </div>
                </form>
                {notices.length > 0 && (
                  <ul className="mt-4 flex flex-col divide-y divide-border border-t border-border">
                    {notices.map((n) => (
                      <li key={n.id} className="py-2.5 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0">
                            <span className="font-medium">{n.title}</span>
                            <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-semibold ${n.active ? "bg-green-600/10 text-green-700" : "bg-surface-muted text-muted"}`}>{n.active ? "Live" : "Hidden"}</span>
                            <span className="block text-xs text-muted">{n.audience === "PAID" ? "Students with notes" : "All signed-in students"} · {shortDate(n.createdAt.toISOString())}</span>
                          </p>
                          <span className="flex shrink-0 gap-1.5">
                            <form action={toggleNoticeAction}>
                              <input type="hidden" name="id" value={n.id} />
                              <input type="hidden" name="active" value={n.active ? "0" : "1"} />
                              <button type="submit" className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-foreground">{n.active ? "Hide" : "Show"}</button>
                            </form>
                            <form action={deleteNoticeAction}>
                              <input type="hidden" name="id" value={n.id} />
                              <button type="submit" className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:border-red-500 hover:text-red-500">Delete</button>
                            </form>
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 whitespace-pre-line text-xs text-muted">{n.body}</p>
                        {n.replies.length > 0 && (
                          <div className="mt-2 rounded-lg bg-surface-muted p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-medium">{n.replies.length} {n.replies.length === 1 ? "reply" : "replies"}</p>
                              {n.replies.some((r) => !r.seen) && (
                                <form action={markRepliesSeenAction}>
                                  <input type="hidden" name="id" value={n.id} />
                                  <button type="submit" className="text-xs text-accent hover:underline">Mark read</button>
                                </form>
                              )}
                            </div>
                            <ul className="mt-1.5 flex flex-col gap-2">
                              {n.replies.map((r) => (
                                <li key={r.id} className="text-xs">
                                  <p className="flex flex-wrap items-center gap-x-2">
                                    {!r.seen && <span aria-label="New" className="size-1.5 rounded-full bg-accent" />}
                                    <Link href={`/admin/payments/students?email=${encodeURIComponent(r.email)}`} className="font-medium hover:text-accent">{r.email}</Link>
                                    <span className="text-muted">{timeAgo(r.createdAt.toISOString())}</span>
                                  </p>
                                  <p className="mt-0.5 whitespace-pre-line text-foreground/80">{r.body}</p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </details>
      </div>

      {/* 4. The list: filter, sort, search */}
      <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Filter students" className="flex gap-1.5 overflow-x-auto pb-1">
          {FILTERS.map((x) => (
            <Link key={x.id} href={href({ f: x.id })} aria-current={filter === x.id ? "page" : undefined} className={`shrink-0 rounded-full border px-3 py-1.5 text-sm ${filter === x.id ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}>
              {x.label} <span className="tabular-nums opacity-70">{counts[x.id]}</span>
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <span className="flex gap-2 whitespace-nowrap text-xs text-muted">
            Sort:
            {SORTS.map((x) => (
              <Link key={x.id} href={href({ sort: x.id })} className={order === x.id ? "font-semibold text-foreground" : "hover:text-foreground"}>{x.label}</Link>
            ))}
          </span>
          <form className="flex gap-2">
            {filter !== "all" && <input type="hidden" name="f" value={filter} />}
            <input name="q" defaultValue={q} placeholder="Search by email" className={`${inputClass} min-w-0 flex-1 sm:w-56`} />
            <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground">Search</button>
          </form>
        </div>
      </div>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{all.length ? "Nobody in this filter." : "No students yet."}</p>
      ) : (
        <>
          {/* Phone: one card per student */}
          <ul className="mt-3 flex flex-col gap-2.5 sm:hidden">
            {students.map((s) => (
              <li key={s.email}>
                <Link href={open(s.email)} className={`${card} block p-4 active:bg-surface-muted`}>
                  <p className="flex items-start justify-between gap-2">
                    <span className="min-w-0 break-all font-medium">{s.email}</span>
                    <TypeBadge paid={s.paid} />
                  </p>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span><span className="block text-muted">Subjects</span><span className="font-semibold">{s.unlocked.size}</span></span>
                    <span><span className="block text-muted">Paid</span><span className="font-semibold">₹{s.paid}</span></span>
                    <span><span className="block text-muted">Reading</span><span className="font-semibold">{reading(s)}</span></span>
                  </div>
                  {activity && <div className="mt-2"><StatusBadge id={statusOf(s)} /></div>}
                  <p className="mt-2 text-xs text-muted">
                    Last active {last(s)}
                    {deviceCounts && <> · {deviceCounts.get(s.email) ?? 0}/{MAX_DEVICES} devices</>}
                    {s.pending > 0 && <span className="text-amber-600"> · {s.pending} pending</span>}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {/* Desktop: a table */}
          <div className={`${card} mt-3 hidden overflow-x-auto sm:block`}>
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Student</th>
                  <th className="px-3 py-2.5 font-medium">Type</th>
                  <th className="px-3 py-2.5 text-right font-medium">Subjects</th>
                  <th className="px-3 py-2.5 text-right font-medium">Paid</th>
                  <th className="px-3 py-2.5 text-right font-medium">Reading</th>
                  <th className="px-3 py-2.5 font-medium">Status</th>
                  {deviceCounts && <th className="px-4 py-2.5 text-right font-medium">Devices</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students.map((s) => (
                  <tr key={s.email} className="hover:bg-surface-muted">
                    <td className="max-w-[18rem] px-4 py-2.5">
                      <Link href={open(s.email)} className="block truncate font-medium hover:text-accent">{s.email}</Link>
                      {(s.phone || s.pending > 0) && (
                        <span className="text-xs text-muted">
                          {s.phone && `+${s.phone}`}
                          {s.pending > 0 && <span className="text-amber-600">{s.phone ? " · " : ""}{s.pending} pending</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><TypeBadge paid={s.paid} /></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{s.unlocked.size}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">₹{s.paid}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{reading(s)}</td>
                    <td className="px-3 py-2.5">
                      {activity ? <StatusBadge id={statusOf(s)} /> : null}
                      <span className="mt-0.5 block text-xs text-muted">{last(s)}</span>
                    </td>
                    {deviceCounts && <td className="px-4 py-2.5 text-right tabular-nums text-muted">{deviceCounts.get(s.email) ?? 0}/{MAX_DEVICES}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TypeBadge({ paid }: { paid: number }) {
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${paid > 0 ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-surface-muted text-muted"}`}>
      {paid > 0 ? "Paid" : "Sample"}
    </span>
  );
}

async function StudentDetail({ email }: { email: string }) {
  const [purchases, account, catalog, devices, activity, listed, subjectLimit] = await Promise.all([
    prisma.purchase.findMany({ where: { email }, orderBy: { createdAt: "desc" } }),
    prisma.notesAccount.findUnique({ where: { email }, select: { email: true } }),
    getNotesCatalog(),
    listLiveDevices(email).catch(() => null), // null = migration not applied yet
    getStudentActivity(email, 30), // null = activity migration not applied yet
    listSubjects(email), // null = subjects migration not applied yet
    getSubjectLimit(email),
  ]);
  const approved = purchases.filter((p) => p.status === "APPROVED");
  const unlocked = [...new Set(approved.flatMap((p) => p.items))];
  const names = await describeItems([...new Set([...purchases.flatMap((p) => p.items), ...(activity?.subjects.map((s) => s.key) ?? [])])]);
  const phone = purchases.find((p) => p.phone)?.phone ?? "";
  const paid = approved.reduce((sum, p) => sum + p.amount, 0);
  const owned = new Set(unlocked);
  const subjects = unlocked.map((k) => names[k] ?? k).join(", ");
  // Per subject: lifetime if any approved purchase of it is lifetime, else the latest end date.
  const validity = (key: string) => {
    let best: Date | null | undefined;
    for (const p of approved.filter((x) => x.items.includes(key))) {
      const end = accessExpiry(p);
      if (best === null) break;
      best = end === null || best === undefined || end > best ? end : best;
    }
    if (best === null || best === undefined) return "Lifetime access";
    return best > new Date() ? `Valid till ${shortDate(best.toISOString())}` : `Expired ${shortDate(best.toISOString())}`;
  };

  return (
    <div className="mt-6 flex max-w-3xl flex-col gap-6">
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 break-all text-lg font-semibold">{email}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${paid > 0 ? "bg-green-600/10 text-green-700 dark:text-green-400" : "bg-surface-muted text-muted"}`}>{paid > 0 ? "Paid student" : "Sample student"}</span>
        </div>
        {activity && <div className="mt-2"><StatusBadge id={studentStatus(activity.lastAt)} /></div>}
        {phone && (
          <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm text-accent hover:underline">WhatsApp +{phone}</a>
        )}
        <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {[
            ["Paid", `₹${paid}`],
            ["Subjects", String(unlocked.length)],
            ["Reading", activity ? fmtDuration(activity.totalSeconds) : "—"],
            ["Last active", activity?.lastAt ? timeAgo(activity.lastAt.toISOString()) : "Never"],
            ["Devices", devices === null ? "—" : `${devices.length}/${MAX_DEVICES}`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-surface-muted px-3 py-2.5">
              <dt className="text-xs text-muted">{k}</dt>
              <dd className="mt-0.5 text-base font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-medium">Subjects they can read ({unlocked.length})</h2>
        {unlocked.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {unlocked.map((k) => (
              <li key={k} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  {names[k] ?? k}
                  <span className="block text-xs text-muted">{validity(k)}</span>
                </span>
                <form action={revokeSubjectAction}>
                  <input type="hidden" name="email" value={email} />
                  <input type="hidden" name="item" value={k} />
                  <button type="submit" className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-red-500 hover:text-red-500">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form action={grantSubjectsAction} className="mt-4 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <input type="hidden" name="email" value={email} />
          <select name="item" required defaultValue="" className={`${inputClass} min-w-0 flex-1`}>
            <option value="" disabled>Add a subject…</option>
            {withExtras(catalog).map((p) => (
              <optgroup key={p.slug} label={p.name}>
                {p.subjects.map((s) => {
                  const key = `${p.slug}/${s.slug}`;
                  return (
                    <option key={key} value={key} disabled={owned.has(key)}>
                      {s.semester ? `Sem ${s.semester} · ` : ""}{s.name}{owned.has(key) ? " (has it)" : ""}
                    </option>
                  );
                })}
              </optgroup>
            ))}
          </select>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            Give access
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-medium">Reading activity</h2>
        {activity === null ? (
          <p className="mt-3 text-sm text-muted">Not tracked yet (activity migration pending).</p>
        ) : activity.totalSeconds === 0 && !activity.lastAt ? (
          <p className="mt-3 text-sm text-muted">Hasn&apos;t opened any notes since tracking started.</p>
        ) : (
          <>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><dt className="text-xs text-muted">Total reading</dt><dd className="text-lg font-semibold">{fmtDuration(activity.totalSeconds)}</dd></div>
              <div><dt className="text-xs text-muted">Days active</dt><dd className="text-lg font-semibold">{activity.activeDays}</dd></div>
              <div><dt className="text-xs text-muted">Last active</dt><dd className="text-lg font-semibold">{activity.lastAt ? timeAgo(activity.lastAt.toISOString()) : "—"}</dd></div>
              <div><dt className="text-xs text-muted">Current streak</dt><dd className="text-lg font-semibold">{activity.streak} day{activity.streak === 1 ? "" : "s"}</dd></div>
              <div><dt className="text-xs text-muted">Avg on a reading day</dt><dd className="text-lg font-semibold">{activity.avgPerActiveDay}m</dd></div>
              <div><dt className="text-xs text-muted">Usually reads around</dt><dd className="text-lg font-semibold">{activity.peakHour === null ? "—" : hourLabel(activity.peakHour)}</dd></div>
            </dl>
            <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <p className="mb-2 text-xs text-muted">Reading per day, last 30 days</p>
                <BarChart label="Reading minutes per day, last 30 days" format={(v) => `${v}m`} data={[...activity.days].reverse().map((d) => ({ label: shortDay(d.day), value: Math.round(d.seconds / 60) }))} />
              </div>
              <div>
                <p className="mb-2 text-xs text-muted">When they read (India time)</p>
                <BarChart label="Reading by hour of day" tone="bg-indigo-400" format={(v) => fmtDuration(v)} data={activity.hours.map((v, h) => ({ label: hourShort(h), value: v }))} />
              </div>
            </div>
            <h3 className="mt-5 text-sm font-medium">By subject</h3>
            <ul className="mt-2 flex flex-col divide-y divide-border">
              {activity.subjects.map((s) => (
                <li key={s.key} className="py-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 font-medium">{names[s.key] ?? s.key}</span>
                    <span className="shrink-0 font-semibold">{fmtDuration(s.seconds)}</span>
                  </div>
                  <p className="text-xs text-muted">
                    opened {s.opens}× · {s.days} day{s.days === 1 ? "" : "s"} · reached about {s.depth}% of the note · last {timeAgo(s.lastAt.toISOString())}
                  </p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                    <div className="h-full rounded-full bg-accent" style={{ width: `${s.depth}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section>
        <h2 className="font-medium">Payment history</h2>
        {purchases.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No payments — access added here is free (₹0).</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {purchases.map((p) => (
              <li key={p.id} className="rounded-xl border border-border bg-surface p-4 text-sm">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">₹{p.amount} · {p.status.charAt(0) + p.status.slice(1).toLowerCase()}</p>
                  <p className="text-xs text-muted">{p.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                </div>
                <p className="mt-1 font-mono text-xs text-muted">{p.utr.startsWith("admin-") || p.utr.startsWith("promoter-") ? p.adminNote ?? "Added by admin" : `${p.provider === "razorpay" ? "Razorpay" : "UTR"} ${p.utr}`}</p>
                <p className="mt-1">{p.items.length ? p.items.map((k) => names[k] ?? k).join(", ") : <span className="text-muted">(all subjects removed)</span>}</p>
                <details className="group mt-3 border-t border-border pt-2">
                  <summary className="cursor-pointer list-none text-xs font-medium text-accent">Edit or delete this payment</summary>
                  <form action={updatePurchaseAction} className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[8rem_10rem_1fr_auto] sm:items-end">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="text-xs text-muted">Amount ₹
                      <input name="amount" type="number" min={0} max={100000} defaultValue={p.amount} required className={`${inputClass} mt-1 w-full`} />
                    </label>
                    <label className="text-xs text-muted">Status
                      <select name="status" defaultValue={p.status} className={`${inputClass} mt-1 w-full`}>
                        <option value="APPROVED">Approved</option>
                        <option value="PENDING">Pending</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
                    </label>
                    <label className="col-span-2 text-xs text-muted sm:col-span-1">Note
                      <input name="adminNote" defaultValue={p.adminNote ?? ""} maxLength={500} placeholder="e.g. refunded ₹50" className={`${inputClass} mt-1 w-full`} />
                    </label>
                    <button type="submit" className="col-span-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 sm:col-span-1">Save</button>
                  </form>
                  <form action={deletePurchaseAction} className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-red-500/5 p-2.5 text-xs">
                    <input type="hidden" name="id" value={p.id} />
                    <label className="flex items-center gap-1.5 text-red-700 dark:text-red-400">
                      <input type="checkbox" name="confirm" value="yes" required /> Delete this payment (removes the access it gave)
                    </label>
                    <button type="submit" className="rounded-lg border border-red-500/50 px-3 py-1.5 font-medium text-red-600 hover:bg-red-500/10">Delete payment</button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
      {devices !== null && devices.length > 0 && (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
          <h2 className="font-medium">Devices ({devices.length}/{MAX_DEVICES})</h2>
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {devices.map((d) => (
              <li key={d.id} className="py-2 text-sm">
                <p className="font-medium">{d.label}</p>
                <p className="text-xs text-muted">Signed in {shortDate(d.since)} · last used {timeAgo(d.lastSeen)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-medium">Account settings</h2>
        <dl className="mt-3 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">WhatsApp</dt>
          <dd>
            {phone ? (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">+{phone}</a>
            ) : "—"}
          </dd>
          <dt className="text-muted">Type</dt>
          <dd>{paid > 0 ? "Paid student" : "Sample student"}</dd>
          <dt className="text-muted">Paid</dt>
          <dd>₹{paid}</dd>
          <dt className="text-muted">Password login</dt>
          <dd>{account ? "Yes" : "No (can still use Google)"}</dd>
          <dt className="text-muted">Devices</dt>
          <dd>
            {devices === null ? (
              "Not tracked yet (device migration pending)"
            ) : devices.length === 0 ? (
              "None signed in"
            ) : (
              <span>
                {devices.length}/{MAX_DEVICES} — {devices.map((d) => d.label).join(", ")}
              </span>
            )}
          </dd>
        </dl>
        {devices !== null && (
          <form action={resetStudentDevicesAction} className="mt-3 flex items-center gap-3 text-xs text-muted">
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-red-500 hover:text-red-500">
              Reset devices
            </button>
            Signs them out everywhere and clears their swap count (lost phone, hit the limit).
          </form>
        )}
        {listed !== null && (
          <div className="mt-3 border-t border-border pt-3 text-sm">
            <p className="text-muted">
              Dashboard subjects: {listed.length} of {subjectLimit}
              {subjectLimit !== DEFAULT_MAX_SUBJECTS ? " (custom limit)" : ""}
            </p>
            {listed.length > 0 && <p className="mt-1">{listed.map((x) => `${x.type} ${x.name}${x.code ? ` (${x.code})` : ""}`).join(" · ")}</p>}
            <form action={setSubjectLimitAction} className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <input type="hidden" name="email" value={email} />
              <label htmlFor="subject-limit">Subject limit</label>
              <input id="subject-limit" name="limit" type="number" min={1} max={MAX_SUBJECT_LIMIT} defaultValue={subjectLimit} className={`${inputClass} w-20`} />
              <button type="submit" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:border-accent hover:text-accent">Save</button>
              <button type="submit" name="reset" value="1" className="rounded-lg border border-border px-3 py-1.5 text-xs hover:text-foreground">Use default ({DEFAULT_MAX_SUBJECTS})</button>
            </form>
          </div>
        )}
        <div className="mt-3 border-t border-border pt-3">
          <ResetPasswordButton email={email} phone={phone} subjects={subjects} />
        </div>
      </section>

      <section className="rounded-xl border border-red-500/40 p-4 sm:p-6">
        <h2 className="font-medium text-red-600 dark:text-red-400">Delete student</h2>
        <p className="mt-1 text-sm text-muted">Removes their payments, login, devices, reading history, dashboard subjects and tickets. This cannot be undone.</p>
        <form action={deleteStudentAction} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="email" value={email} />
          <input name="confirmEmail" required autoComplete="off" placeholder={`Type ${email} to confirm`} aria-label="Type the student's email to confirm" className={`${inputClass} min-w-0 flex-1`} />
          <button type="submit" className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700">Delete student</button>
        </form>
      </section>

    </div>
  );
}
