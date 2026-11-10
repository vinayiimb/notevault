export const dynamic = "force-dynamic";
import Link from "next/link";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { addOrderAction, deleteManualOrderAction, markOrderDeliveredAction, updateOrderAction } from "@/lib/note-lead-actions";
import { formatLeadPhone } from "@/lib/note-leads";
import { NOTES_DELIVERY_HOURS, orderPlanLabel } from "@/lib/notes-orders";

// Who paid in the pop-up, what they bought, and what has been sent to them so far.
// Laid out like the /jameco/syllabus table: one tinted vertical band per student, one row per purchase.

const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const overdue = (d: Date) => Date.now() - d.getTime() > NOTES_DELIVERY_HOURS * 3600_000;
const markBtn = "rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700";
const undoBtn = "text-xs text-muted underline-offset-2 hover:underline";

const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const label = "flex flex-col gap-1 text-xs text-muted";
const linkBtn = "cursor-pointer list-none text-xs font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden";

type Order = Awaited<ReturnType<typeof prisma.notesOrder.findMany>>[number];

function DeliveryCell({ o }: { o: Order }) {
  const done = o.status === "DELIVERED";
  return (
    <form action={markOrderDeliveredAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={o.id} />
      {done ? (
        <>
          <span className="rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700">
            Delivered{o.deliveredAt ? ` ${day(o.deliveredAt)}` : ""}
          </span>
          <input type="hidden" name="status" value="PAID" />
          <button type="submit" className={undoBtn}>Undo</button>
        </>
      ) : (
        <>
          <button type="submit" className={markBtn}>Mark delivered</button>
          {overdue(o.paidAt) && <span className="text-xs font-medium text-red-600">Past {NOTES_DELIVERY_HOURS}h</span>}
        </>
      )}
    </form>
  );
}

/** Edit one purchase, or (no `o`) add a new one. Phone is fixed for a student's own rows and typed for a new student. */
function OrderForm({ o, phone, programmes, askPhone }: { o?: Order; phone?: string; programmes: string[]; askPhone?: boolean }) {
  const manual = o?.razorpayPaymentId.startsWith("manual-");
  return (
    <div className="mt-2 rounded-xl border border-border bg-background p-3">
      <form action={o ? updateOrderAction : addOrderAction} className="grid gap-3 sm:grid-cols-2">
        {o ? <input type="hidden" name="id" value={o.id} /> : <input type="hidden" name="phone" value={phone} />}
        {askPhone && (
          <label className={`${label} sm:col-span-2`}>
            WhatsApp number
            <input name="phone" required inputMode="tel" placeholder="98765 43210" className={field} />
          </label>
        )}
        <label className={label}>
          Bought
          <select name="plan" defaultValue={o?.plan ?? "subject"} className={field}>
            <option value="subject">One subject</option>
            <option value="semester">Whole semester</option>
          </select>
        </label>
        <label className={label}>
          Subject name (blank for a whole semester)
          <input name="subject" defaultValue={o?.subject ?? ""} placeholder="e.g. Financial Accounting" className={field} />
        </label>
        <label className={label}>
          Course
          <input name="programme" required list="delivery-programmes" defaultValue={o?.programme ?? ""} placeholder="e.g. B.Com (P)" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Semester
            <input name="semester" type="number" min={1} max={8} required defaultValue={o?.semester ?? ""} className={field} />
          </label>
          <label className={label}>
            Paid (₹)
            <input name="amount" type="number" min={0} defaultValue={o?.amount ?? 49} className={field} />
          </label>
        </div>
        {!o && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="delivered" /> Already delivered
          </label>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90">
            {o ? "Save changes" : "Add"}
          </button>
        </div>
      </form>
      {manual && (
        <form action={deleteManualOrderAction} className="mt-2">
          <input type="hidden" name="id" value={o!.id} />
          <button type="submit" className="text-xs text-muted hover:text-red-500">Remove this row (added by hand)</button>
        </form>
      )}
      <datalist id="delivery-programmes">{programmes.map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );
}

function EditRow({ o, programmes }: { o: Order; programmes: string[] }) {
  return (
    <details className="mt-1">
      <summary className={linkBtn}>Edit</summary>
      <OrderForm o={o} programmes={programmes} />
    </details>
  );
}

function AddRow({ phone, programmes }: { phone: string; programmes: string[] }) {
  return (
    <details>
      <summary className={linkBtn}>+ Add subject</summary>
      <OrderForm phone={phone} programmes={programmes} />
    </details>
  );
}

export default async function DeliveryTrackerPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const pendingOnly = show === "pending";

  let orders: Order[];
  try {
    orders = await prisma.notesOrder.findMany({ orderBy: { paidAt: "asc" } });
  } catch (err) {
    console.error("delivery tracker:", err);
    return (
      <div className="p-8">
        <h1 className="text-2xl font-semibold">Delivery tracker</h1>
        <p className="mt-4 max-w-xl rounded-lg bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Couldn&apos;t read paid orders. The <code>add_notes_order</code> migration may not be applied to this database.
        </p>
      </div>
    );
  }

  // One group per phone. Students with something still to send come first, then by most recent purchase.
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) byPhone.set(o.phone, [...(byPhone.get(o.phone) ?? []), o]);
  const students = [...byPhone.entries()]
    .map(([phone, list]) => ({ phone, list, delivered: list.filter((o) => o.status === "DELIVERED").length, paid: list.reduce((n, o) => n + o.amount, 0), last: list[list.length - 1].paidAt }))
    .filter((s) => !pendingOnly || s.delivered < s.list.length)
    .sort((a, b) => Number(b.delivered < b.list.length) - Number(a.delivered < a.list.length) || b.last.getTime() - a.last.getTime());

  const programmes = [...new Set(orders.map((o) => o.programme))].sort();
  const totalBought = orders.length;
  const totalDelivered = orders.filter((o) => o.status === "DELIVERED").length;
  const tint = (s: { delivered: number; list: Order[] }) => (s.delivered === s.list.length ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30");
  const tab = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"}`;

  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/admin/leads" className="text-sm text-muted hover:text-foreground">&larr; Leads</Link>
      <h1 className="mt-2 text-2xl font-semibold">Delivery tracker</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Every student who paid, what they bought, and what you have sent so far.</p>

      <dl className="mt-4 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Students", byPhone.size],
          ["Bought", totalBought],
          ["Delivered", totalDelivered],
          ["To send", totalBought - totalDelivered],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex gap-2">
        <Link href="/admin/leads/delivery" className={tab(!pendingOnly)}>All students</Link>
        <Link href="/admin/leads/delivery?show=pending" className={tab(pendingOnly)}>Still to send</Link>
      </div>

      <details className="mt-4 max-w-xl">
        <summary className={linkBtn}>+ Add a student / purchase</summary>
        <OrderForm askPhone programmes={programmes} />
      </details>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{pendingOnly ? "Nothing left to send." : "No paid orders yet."}</p>
      ) : (
        <>
          {/* Desktop: syllabus-style table */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th colSpan={2} className="px-3 py-2.5 text-left font-medium">Subject bought</th>
                  <th className="w-16 border-l border-border px-2 py-2.5 text-center font-medium">Sem</th>
                  <th className="w-20 border-l border-border px-2 py-2.5 text-center font-medium">Paid</th>
                  <th className="w-24 border-l border-border px-2 py-2.5 text-center font-medium">Date</th>
                  <th className="w-52 border-l border-border px-3 py-2.5 text-left font-medium">Delivered</th>
                </tr>
              </thead>
              {students.map((s) => (
                <tbody key={s.phone} className="border-t border-border">
                  {s.list.map((o, i) => (
                    <tr key={o.id} className="border-t border-border/60 first:border-t-0" style={i === 0 && s.list.length === 1 ? { height: "11rem" } : undefined}>
                      {i === 0 && (
                        <th rowSpan={s.list.length + 1} scope="rowgroup" className={`w-12 border-r border-border p-0 ${tint(s)}`}>
                          <a
                            href={`https://wa.me/${s.phone}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mx-auto block w-fit rotate-180 whitespace-nowrap py-6 text-xs font-medium tabular-nums text-foreground [writing-mode:vertical-rl] hover:underline"
                          >
                            {formatLeadPhone(s.phone)} · {s.delivered}/{s.list.length}
                          </a>
                        </th>
                      )}
                      <td className="px-3 py-2">
                        <span className="font-medium text-foreground">{orderPlanLabel(o)}</span>
                        <span className="block text-xs text-muted">{o.programme}</span>
                        <EditRow o={o} programmes={programmes} />
                      </td>
                      <td className="border-l border-border/60 px-2 py-2 text-center text-muted">{o.semester}</td>
                      <td className="border-l border-border/60 px-2 py-2 text-center tabular-nums">₹{o.amount}</td>
                      <td className="border-l border-border/60 px-2 py-2 text-center text-muted">{day(o.paidAt)}</td>
                      <td className="border-l border-border/60 px-3 py-2"><DeliveryCell o={o} /></td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/60">
                    <td colSpan={5} className="px-3 py-2"><AddRow phone={s.phone} programmes={programmes} /></td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>

          {/* Phone: one card per student (a wide table is unusable at 390px) */}
          <ul className="mt-4 flex flex-col gap-3 sm:hidden">
            {students.map((s) => (
              <li key={s.phone} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className={`flex items-center justify-between gap-2 px-4 py-3 ${tint(s)}`}>
                  <div>
                    <p className="font-semibold tabular-nums">{formatLeadPhone(s.phone)}</p>
                    <p className="text-xs text-muted">{s.list.length} bought · {s.delivered} delivered · ₹{s.paid}</p>
                  </div>
                  <a href={`https://wa.me/${s.phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="inline-flex size-11 items-center justify-center rounded-lg bg-green-600 text-white">
                    <WhatsappLogo size={20} weight="fill" />
                  </a>
                </div>
                <ul className="divide-y divide-border">
                  {s.list.map((o) => (
                    <li key={o.id} className="px-4 py-3">
                      <p className="text-sm font-medium">{orderPlanLabel(o)}</p>
                      <p className="text-xs text-muted">{o.programme} · Sem {o.semester} · ₹{o.amount} · {day(o.paidAt)}</p>
                      <div className="mt-2"><DeliveryCell o={o} /></div>
                      <EditRow o={o} programmes={programmes} />
                    </li>
                  ))}
                  <li className="px-4 py-3"><AddRow phone={s.phone} programmes={programmes} /></li>
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
