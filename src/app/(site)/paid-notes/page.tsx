export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { describeItems, getNotesCatalog, getPaymentSettings, getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { studentLogoutAction } from "@/lib/paid-notes-actions";
import { PAID_FEATURES, PLANS } from "@/lib/paid-notes-pricing";

export const metadata: Metadata = {
  title: "Pricing – Full DU Subject Notes from ₹49",
  description: "Unlock complete DU subject notes with full solutions — ₹49 per subject, ₹99 for 3 subjects, ₹149 for a full semester. Pay by UPI.",
  alternates: { canonical: "/paid-notes" },
};

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const settings = await getPaymentSettings();

  if (!settings.active) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-24 text-center sm:px-6">
        <p className="text-sm font-semibold text-brand">Complete subject notes</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          Paid notes are coming to DU PYQ Online.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-muted">
          The complete notes collection is being prepared. You can preview the free archive while access is being finalised.
        </p>
        <Link
          href="/papers"
          className="mx-auto mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-7 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
        >
          Preview Notes
        </Link>
      </div>
    );
  }

  // Old "/paid-notes?add=…" links (cached note pages) go straight to checkout.
  const { add } = await searchParams;
  if (add) redirect(`/paid-notes/checkout?plan=1&add=${encodeURIComponent(add)}`);

  const [catalog, email] = await Promise.all([getNotesCatalog(), getStudentEmail()]);
  const subjectCount = catalog.reduce((n, p) => n + p.subjects.length, 0);
  const owned = email ? [...(await getUnlockedItems(email))] : [];
  const pendingCount = email ? await prisma.purchase.count({ where: { email, status: "PENDING" } }) : 0;
  const names = await describeItems(owned);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-4xl font-bold tracking-[-0.03em] sm:text-6xl">Pricing</h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-sm text-muted sm:text-base">
          <strong className="font-semibold text-foreground">{subjectCount} subjects</strong> across{" "}
          <strong className="font-semibold text-foreground">{catalog.length} course{catalog.length === 1 ? "" : "s"}</strong> — complete
          notes built from actual DU previous year papers.
        </p>
        <div className="mt-4 text-sm">
          {email ? (
            <form action={studentLogoutAction} className="inline-flex items-center gap-2 text-muted">
              <span>Signed in as {email}</span>
              <button type="submit" className="font-medium text-brand hover:underline">Sign out</button>
            </form>
          ) : (
            <Link href="/login" className="font-medium text-brand hover:underline">Already bought? Sign in</Link>
          )}
        </div>
      </div>

      {(owned.length > 0 || pendingCount > 0) && (
        <section className="mx-auto mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-5">
          {owned.length > 0 && (
            <>
              <h2 className="text-sm font-semibold">Your unlocked notes</h2>
              <ul className="mt-3 flex flex-col gap-2">
                {owned.map((key) => (
                  <li key={key}>
                    <Link href={`/notes/${key}`} className="text-sm font-medium text-brand hover:underline">{names[key]} →</Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {pendingCount > 0 && (
            <p className={`text-sm text-muted ${owned.length ? "mt-4 border-t border-border pt-4" : ""}`}>
              {pendingCount} payment{pendingCount > 1 ? "s" : ""} waiting for verification — usually done within a few hours.
            </p>
          )}
        </section>
      )}

      <div className="mt-12 overflow-hidden rounded-3xl border border-border bg-surface">
        <p className="border-b border-border px-6 py-4 text-sm">
          Access: <strong className="font-semibold">lifetime</strong> — no expiry, no subscription.
        </p>
        {/* gap-px over a border-coloured background = 1px dividers in every layout */}
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {/* Free */}
          <PlanColumn
            name="Free"
            price={0}
            cta={{ href: "/papers", label: "Try now" }}
            groups={[
              { title: "Question papers", items: ["All DU PYQs (29,000+)", "Open, view & download"] },
              { title: "Notes", items: ["Free preview of every subject (~30%)"] },
            ]}
          />
          {PLANS.map((plan) => (
            <PlanColumn
              key={plan.subjects}
              name={plan.name}
              price={plan.price}
              listPrice={plan.listPrice > plan.price ? plan.listPrice : undefined}
              badge={plan.badge}
              highlight={plan.subjects === 5}
              cta={{ href: `/paid-notes/checkout?plan=${plan.subjects}`, label: "Buy" }}
              groups={[
                {
                  title: "Notes",
                  items: [
                    `${plan.subjects} subject${plan.subjects > 1 ? "s" : ""} of your choice`,
                    ...(plan.subjects > 1 ? [`₹${Math.round(plan.price / plan.subjects)} per subject`] : []),
                    ...PAID_FEATURES,
                  ],
                },
                { title: "Also free", items: ["All DU PYQs (29,000+)"] },
              ]}
            />
          ))}
        </div>
      </div>
      <p className="mt-4 text-center text-xs text-muted">
        Mix subjects from any course. Pay by UPI — your login arrives on WhatsApp once the payment is verified.
      </p>
    </div>
  );
}

function PlanColumn({
  name,
  price,
  listPrice,
  badge,
  highlight,
  cta,
  groups,
}: {
  name: string;
  price: number;
  listPrice?: number;
  badge?: string | null;
  highlight?: boolean;
  cta: { href: string; label: string };
  groups: { title: string; items: readonly string[] }[];
}) {
  return (
    <div className="flex flex-col bg-surface p-6">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-medium">
        <span className="whitespace-nowrap">{name}</span>
        {badge && (
          <span className="whitespace-nowrap rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">{badge}</span>
        )}
      </h2>
      <p className="mt-2 flex items-baseline gap-2">
        <span className="text-4xl font-semibold tracking-tight">₹{price}</span>
        {listPrice && <span className="text-base text-muted line-through">₹{listPrice}</span>}
      </p>
      <Link
        href={cta.href}
        className={`mt-6 inline-flex min-h-10 w-full items-center justify-center rounded-full border text-sm font-medium transition sm:w-36 ${
          highlight
            ? "border-brand bg-brand text-brand-foreground hover:bg-brand-hover"
            : "border-foreground/80 hover:bg-foreground hover:text-background"
        }`}
      >
        {cta.label}
      </Link>
      <div className="mt-6 flex flex-col gap-5 border-t border-border pt-6">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="text-sm font-medium">{g.title}</h3>
            <ul className="mt-2 flex flex-col gap-1.5">
              {g.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted">
                  <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-green-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
