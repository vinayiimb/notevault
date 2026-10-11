export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { describeItems, getNotesCatalog } from "@/lib/paid-notes";
import { getPromoter, promoterUtrPrefix } from "@/lib/promoter";
import { promoterGrantAction, promoterLogoutAction, promoterRevokeAction } from "@/lib/paid-notes-actions";
import { PromoterLoginForm } from "@/components/promoter-forms";

export const metadata: Metadata = {
  title: "Promoter portal",
  robots: { index: false },
};

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none";

// Sub-admin portal: promoters give students notes access, and can take back
// only what they gave. Admins manage promoters in Admin → Payments → Promoters.
export default async function PromoterPage() {
  const promoter = await getPromoter();
  if (!promoter) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
        <h1 className="text-center font-display text-3xl font-bold tracking-[-0.03em]">Promoter portal</h1>
        <p className="mt-3 text-center text-sm text-muted">Sign in with the login the DU PYQ Online team gave you.</p>
        <PromoterLoginForm />
      </div>
    );
  }

  const [grants, catalog] = await Promise.all([
    prisma.purchase.findMany({
      where: { status: "APPROVED", utr: { startsWith: promoterUtrPrefix(promoter.id) } },
      orderBy: { createdAt: "desc" },
      select: { email: true, items: true },
    }),
    getNotesCatalog(),
  ]);
  const byEmail = new Map<string, Set<string>>();
  for (const g of grants) {
    const set = byEmail.get(g.email) ?? new Set<string>();
    g.items.forEach((k) => set.add(k));
    byEmail.set(g.email, set);
  }
  const students = [...byEmail].filter(([, items]) => items.size > 0);
  const names = await describeItems(students.flatMap(([, items]) => [...items]));

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Promoter portal</h1>
      <form action={promoterLogoutAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="break-all">Signed in as {promoter.name} ({promoter.email})</span>
        <button type="submit" className="font-medium text-brand hover:underline">Sign out</button>
      </form>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-semibold">Give notes access</h2>
        <p className="mt-1 text-sm text-muted">
          The student signs in at www.dupyq.online/login with &ldquo;Continue with Google&rdquo; using this Gmail.
        </p>
        <form action={promoterGrantAction} className="mt-4 flex flex-col gap-3">
          <input name="email" type="email" required placeholder="Student's Gmail" autoComplete="off" className={inputClass} />
          <select name="item" required defaultValue="" className={inputClass}>
            <option value="" disabled>Pick a subject…</option>
            {catalog.map((p) => (
              <optgroup key={p.slug} label={p.name}>
                {p.subjects.map((s) => (
                  <option key={`${p.slug}/${s.slug}`} value={`${p.slug}/${s.slug}`}>
                    {s.semester ? `Sem ${s.semester} · ` : ""}{s.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button type="submit" className="min-h-12 rounded-xl bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
            Give access
          </button>
        </form>
      </section>

      <section className="mt-8">
        <h2 className="font-semibold">Students you gave access ({students.length})</h2>
        {students.length === 0 ? (
          <p className="mt-3 text-sm text-muted">None yet.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {students.map(([email, items]) => (
              <li key={email} className="rounded-2xl border border-border bg-surface p-4">
                <p className="break-all font-medium">{email}</p>
                <ul className="mt-2 flex flex-col divide-y divide-border">
                  {[...items].map((k) => (
                    <li key={k} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="min-w-0">{names[k] ?? k}</span>
                      <form action={promoterRevokeAction}>
                        <input type="hidden" name="email" value={email} />
                        <input type="hidden" name="item" value={k} />
                        <button type="submit" className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs text-muted hover:border-red-500 hover:text-red-500">
                          Remove
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
