export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeItems, getNotesCatalog } from "@/lib/paid-notes";
import { grantSubjectsAction, revokeSubjectAction } from "@/lib/paid-notes-actions";
import { ResetPasswordButton } from "@/components/admin/payment-approve";

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

type Student = { email: string; phone: string; unlocked: Set<string>; paid: number; pending: number; lastAt: Date };

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; email?: string }> }) {
  const { q = "", email } = await searchParams;
  return (
    <div className="p-4 sm:p-8">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-foreground">&larr; Payments</Link>
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
  const purchases = await prisma.purchase.findMany({
    where: q ? { email: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    select: { email: true, phone: true, items: true, amount: true, status: true, createdAt: true },
  });
  const byEmail = new Map<string, Student>();
  for (const p of purchases) {
    const s = byEmail.get(p.email) ?? { email: p.email, phone: p.phone, unlocked: new Set(), paid: 0, pending: 0, lastAt: p.createdAt };
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
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function StudentDetail({ email }: { email: string }) {
  const [purchases, account, catalog] = await Promise.all([
    prisma.purchase.findMany({ where: { email }, orderBy: { createdAt: "desc" } }),
    prisma.notesAccount.findUnique({ where: { email }, select: { email: true } }),
    getNotesCatalog(),
  ]);
  const approved = purchases.filter((p) => p.status === "APPROVED");
  const unlocked = [...new Set(approved.flatMap((p) => p.items))];
  const names = await describeItems([...new Set(purchases.flatMap((p) => p.items))]);
  const phone = purchases.find((p) => p.phone)?.phone ?? "";
  const paid = approved.reduce((sum, p) => sum + p.amount, 0);
  const owned = new Set(unlocked);
  const subjects = unlocked.map((k) => names[k] ?? k).join(", ");

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
        </dl>
        <div className="mt-3 border-t border-border pt-3">
          <ResetPasswordButton email={email} phone={phone} subjects={subjects} />
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-medium">Subjects they can read ({unlocked.length})</h2>
        {unlocked.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {unlocked.map((k) => (
              <li key={k} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">{names[k] ?? k}</span>
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
            {catalog.map((p) => (
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
                <p className="mt-1 font-mono text-xs text-muted">{p.utr.startsWith("admin-") ? "Added by admin" : `UTR ${p.utr}`}</p>
                <p className="mt-1">{p.items.length ? p.items.map((k) => names[k] ?? k).join(", ") : <span className="text-muted">(all subjects removed)</span>}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
