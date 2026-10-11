export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { setPromoterActiveAction } from "@/lib/paid-notes-actions";
import { promoterUtrPrefix } from "@/lib/promoter";
import { IssuePromoterLoginForm } from "@/components/promoter-forms";

export default async function AdminPromotersPage() {
  const [promoters, grants] = await Promise.all([
    prisma.promoter.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.purchase.findMany({
      where: { status: "APPROVED", utr: { startsWith: "promoter-" } },
      select: { utr: true, email: true, items: true },
    }),
  ]);
  const statsFor = (id: string) => {
    const mine = grants.filter((g) => g.utr.startsWith(promoterUtrPrefix(id)));
    return { students: new Set(mine.filter((g) => g.items.length).map((g) => g.email)).size, subjects: mine.reduce((n, g) => n + g.items.length, 0) };
  };

  return (
    <div className="p-4 sm:p-8">
      <Link href="/admin/payments" className="text-sm text-muted hover:text-foreground">&larr; Payments</Link>
      <h1 className="mt-2 text-2xl font-semibold">Promoters</h1>
      <p className="mt-1 text-sm text-muted">
        Promoters sign in at /promoter and can only give students notes access (and remove what they gave). Their
        grants show in Students as &ldquo;Added by promoter&rdquo;.
      </p>

      <section className="mt-6 max-w-3xl rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="mb-3 font-medium">Add a promoter / reset password</h2>
        <IssuePromoterLoginForm />
      </section>

      {promoters.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No promoters yet.</p>
      ) : (
        <ul className="mt-6 flex max-w-3xl flex-col gap-3">
          {promoters.map((p) => {
            const s = statsFor(p.id);
            return (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                <div className="min-w-0">
                  <p className="font-medium">
                    {p.name}
                    {!p.active && <span className="ml-2 text-xs text-red-500">Disabled</span>}
                  </p>
                  <p className="break-all text-sm text-muted">{p.email}</p>
                  <p className="mt-1 text-sm text-muted">
                    {s.students} student{s.students === 1 ? "" : "s"} · {s.subjects} subject{s.subjects === 1 ? "" : "s"} given
                  </p>
                </div>
                <form action={setPromoterActiveAction}>
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="active" value={String(!p.active)} />
                  <button
                    type="submit"
                    className={`rounded-lg border border-border px-3 py-1.5 text-xs ${p.active ? "text-muted hover:border-red-500 hover:text-red-500" : "text-accent hover:border-accent"}`}
                  >
                    {p.active ? "Disable" : "Enable"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
