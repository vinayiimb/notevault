export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeItems, getPaymentSettings } from "@/lib/paid-notes";
import { PACKS } from "@/lib/paid-notes-pricing";
import {
  rejectPurchaseAction,
  removeUpiQrAction,
  updatePaymentSettingsAction,
  uploadUpiQrAction,
} from "@/lib/paid-notes-actions";
import { ImageDropzone } from "@/components/admin/image-dropzone";
import { ApprovePaymentButton, ResetPasswordButton } from "@/components/admin/payment-approve";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
type Status = (typeof STATUSES)[number];

const inputClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: rawStatus } = await searchParams;
  const status: Status = STATUSES.includes(rawStatus as Status) ? (rawStatus as Status) : "PENDING";

  const [settings, purchases, counts] = await Promise.all([
    getPaymentSettings(),
    prisma.purchase.findMany({ where: { status }, orderBy: { createdAt: status === "PENDING" ? "asc" : "desc" }, take: 200 }),
    prisma.purchase.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countOf = (s: Status) => counts.find((c) => c.status === s)?._count._all ?? 0;
  const names = await describeItems([...new Set(purchases.flatMap((p) => p.items))]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="mt-1 text-sm text-muted">
        Students pay by UPI and submit their UTR. Check it in your UPI app, then approve — that creates their login
        (Gmail + password) and unlocks the subjects they paid for.
      </p>

      {/* Setup */}
      <section className="mt-8 max-w-2xl rounded-xl border border-border bg-surface p-6">
        <h2 className="font-medium">Payment setup</h2>
        {settings.paywallEnabled && !settings.active && (
          <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            Paywall is switched on but there&apos;s no UPI ID or QR yet — notes stay free until you add one.
          </p>
        )}
        <form action={updatePaymentSettingsAction} className="mt-4 flex flex-col gap-4">
          <label className="flex items-start gap-3 rounded-lg border border-border bg-background p-3">
            <input type="checkbox" name="paywallEnabled" defaultChecked={settings.paywallEnabled} className="mt-0.5 size-4" />
            <span className="text-sm">
              <span className="font-medium">Paywall on</span>
              <span className="block text-muted">
                Notes show a free preview (~30%) and the rest needs purchase. Off = all notes free, checkout shows
                &ldquo;coming soon&rdquo;.
              </span>
            </span>
          </label>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="upiId">UPI ID</label>
            <input id="upiId" name="upiId" defaultValue={settings.upiId ?? ""} placeholder="yourname@okaxis" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted" htmlFor="upiPayeeName">Payee name (shown to students)</label>
            <input id="upiPayeeName" name="upiPayeeName" defaultValue={settings.upiPayeeName ?? ""} placeholder="DU PYQ Online" className={inputClass} />
          </div>
          <button type="submit" className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90">
            Save
          </button>
        </form>

        <div className="mt-6 border-t border-border pt-6">
          <h3 className="text-sm font-medium">UPI QR code</h3>
          {settings.upiQrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.upiQrUrl} alt="Current UPI QR" className="mt-3 size-44 rounded-xl border border-border bg-white object-contain p-2" />
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted">
              No QR uploaded yet — students only see the UPI ID.
            </p>
          )}
          <form action={uploadUpiQrAction} className="mt-4 flex flex-col gap-4">
            <ImageDropzone name="file" required />
            <button type="submit" className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90">
              {settings.upiQrUrl ? "Replace QR" : "Upload QR"}
            </button>
          </form>
          {settings.upiQrUrl && (
            <form action={removeUpiQrAction} className="mt-2">
              <button type="submit" className="text-sm text-muted hover:text-red-500">Remove QR</button>
            </form>
          )}
        </div>

        <p className="mt-6 border-t border-border pt-4 text-xs text-muted">
          Prices: {PACKS.map((p) => `₹${p.price} for ${p.subjects}`).join(" · ")} — mixed automatically to the cheapest
          total. Change them in src/lib/paid-notes-pricing.ts.
        </p>
      </section>

      {/* Payments */}
      <div className="mt-10 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/payments?status=${s}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${s === status ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:text-foreground"}`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()} ({countOf(s)})
          </Link>
        ))}
        <Link
          href="/admin/payments/students"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground"
        >
          Students &rarr;
        </Link>
      </div>

      {purchases.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing here.</p>
      ) : (
        <ul className="mt-4 flex max-w-3xl flex-col gap-3">
          {purchases.map((p) => {
            const subjects = p.items.map((k) => names[k] ?? k).join(", ");
            return (
              <li key={p.id} className="rounded-xl border border-border bg-surface p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-semibold">₹{p.amount}</p>
                  <p className="text-xs text-muted">{p.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
                </div>
                <dl className="mt-2 grid grid-cols-[90px_1fr] gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted">UTR</dt>
                  <dd className="font-mono">{p.utr}</dd>
                  <dt className="text-muted">Email</dt>
                  <dd className="break-all">{p.email}</dd>
                  <dt className="text-muted">WhatsApp</dt>
                  <dd>
                    <a href={`https://wa.me/${p.phone}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      +{p.phone}
                    </a>
                  </dd>
                  <dt className="text-muted">Subjects</dt>
                  <dd>{subjects}</dd>
                  {p.adminNote && (
                    <>
                      <dt className="text-muted">Note</dt>
                      <dd>{p.adminNote}</dd>
                    </>
                  )}
                </dl>

                {p.status === "PENDING" && (
                  <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
                    <ApprovePaymentButton id={p.id} subjects={subjects} />
                    <form action={rejectPurchaseAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      <input name="adminNote" placeholder="Reason (optional), e.g. UTR not found" className={`${inputClass} min-w-0 flex-1`} />
                      <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-red-500 hover:text-red-500">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
                {p.status === "APPROVED" && (
                  <div className="mt-3 border-t border-border pt-3">
                    <ResetPasswordButton email={p.email} phone={p.phone} subjects={subjects} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
