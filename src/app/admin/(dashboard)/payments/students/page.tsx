export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeItems, EXTRA_ITEMS, getNotesCatalog } from "@/lib/paid-notes";
import { grantSubjectsAction, resetStudentDevicesAction, revokeSubjectAction, setSubjectLimitAction } from "@/lib/paid-notes-actions";
import { listLiveDevices, liveDeviceCounts } from "@/lib/student-devices";
import { MAX_DEVICES } from "@/lib/student-device-policy";
import { ResetPasswordButton } from "@/components/admin/payment-approve";
import { getActivitySummaries, getStudentActivity } from "@/lib/student-activity";
import { fmtDuration, hourLabel } from "@/lib/student-activity-format";
import { accessExpiry } from "@/lib/paid-notes-pricing";
import { shortDate, timeAgo } from "@/lib/time-ago";
import { listSubjects, getSubjectLimit } from "@/lib/student-dashboard";
import { DEFAULT_MAX_SUBJECTS, MAX_SUBJECT_LIMIT } from "@/lib/feathers";

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

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

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; email?: string }> }) {
  const { q = "", email } = await searchParams;
  return (
    <div className="p-4 sm:p-8">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-foreground">&larr; Payments</Link>
      <Link href="/admin/payments/analytics" className="ml-4 text-sm text-muted hover:text-foreground">Analytics &rarr;</Link>
      <h1 className="mt-2 text-2xl font-semibold">Students</h1>
      <p className="mt-1 text-sm text-muted">
        Everyone who has paid or been given access. Open a student to add or remove subjects.
      </p>
      {email ? <StudentDetail email={email.trim().toLowerCase()} /> : <StudentList q={q.trim().toLowerCase()} />}
    </div>
  );
}

async function StudentList({ q }: { q: string }) {
  // ponytail: loads every purchase and groups in memory; add pagination when it reaches thousands.
  const [purchases, activity, deviceCounts] = await Promise.all([
    prisma.purchase.findMany({
    where: q ? { email: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    select: { email: true, phone: true, items: true, amount: true, status: true, createdAt: true },
    }),
    getActivitySummaries(), // null = activity migration not applied yet
    liveDeviceCounts(), // null = device migration not applied yet
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
  const students = [...byEmail.values()];
  return (
    <>
      <div className="mt-6 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <form className="flex flex-1 gap-2">
          <input name="q" defaultValue={q} placeholder="Search by email" className={`${inputClass} min-w-0 flex-1`} />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground">Search</button>
        </form>
        <form className="flex flex-1 gap-2">
          <input name="email" type="email" required placeholder="Give access to a new Gmail" className={`${inputClass} min-w-0 flex-1`} />
          <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">Open</button>
        </form>
      </div>

      {activity === null && (
        <p className="mt-4 max-w-3xl rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300">
          Reading-time tracking starts once the student-activity migration is applied.
        </p>
      )}

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No students yet.</p>
      ) : (
        <ul className="mt-4 flex max-w-3xl flex-col gap-3">
          {students.map((s) => (
            <li key={s.email}>
              <Link
                href={`/admin/payments/students?email=${encodeURIComponent(s.email)}`}
                className="block rounded-xl border border-border bg-surface p-4 transition hover:border-accent sm:p-5"
              >
                <p className="break-all font-medium">{s.email}</p>
                <p className="mt-1 text-sm text-muted">
                  {s.unlocked.size} subject{s.unlocked.size === 1 ? "" : "s"} · ₹{s.paid} paid
                  {s.pending > 0 && <span className="text-amber-600 dark:text-amber-400"> · {s.pending} pending</span>}
                  {s.phone && <> · +{s.phone}</>}
                </p>
                {activity && (
                  <p className="mt-1 text-sm">
                    {s.seconds > 0 ? (
                      <>
                        <span className="font-medium">{fmtDuration(s.seconds)} read</span>
                        <span className="text-muted"> · last active {s.lastActive ? timeAgo(s.lastActive.toISOString()) : "—"}</span>
                      </>
                    ) : (
                      <span className="text-muted">No reading yet</span>
                    )}
                    {deviceCounts && <span className="text-muted"> · {deviceCounts.get(s.email) ?? 0}/{MAX_DEVICES} devices</span>}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function StudentDetail({ email }: { email: string }) {
  const [purchases, account, catalog, devices, activity, listed, subjectLimit] = await Promise.all([
    prisma.purchase.findMany({ where: { email }, orderBy: { createdAt: "desc" } }),
    prisma.notesAccount.findUnique({ where: { email }, select: { email: true } }),
    getNotesCatalog(),
    listLiveDevices(email).catch(() => null), // null = migration not applied yet
    getStudentActivity(email), // null = activity migration not applied yet
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
        <p className="break-all text-lg font-semibold">{email}</p>
        <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted">WhatsApp</dt>
          <dd>
            {phone ? (
              <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">+{phone}</a>
            ) : "—"}
          </dd>
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
            <div className="mt-4">
              <p className="text-xs text-muted">Last 14 days (minutes per day)</p>
              <div className="mt-2 flex h-20 items-end gap-1" role="img" aria-label="Reading minutes per day, last 14 days">
                {[...activity.days].reverse().map((d) => {
                  const max = Math.max(...activity.days.map((x) => x.seconds), 60);
                  return (
                    <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${fmtDuration(d.seconds)}`}>
                      <div className="w-full rounded-sm bg-accent" style={{ height: `${d.seconds ? Math.max(6, (d.seconds / max) * 100) : 0}%` }} />
                    </div>
                  );
                })}
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
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
