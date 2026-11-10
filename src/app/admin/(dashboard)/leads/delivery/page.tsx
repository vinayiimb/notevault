export const dynamic = "force-dynamic";
import Link from "next/link";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { addOrderAction, deleteManualOrderAction, fillPackFromSyllabusAction, giveNotesAccessAction, markOrderDeliveredAction, quickAddSubjectsAction, saveStudentAction, saveStudentPaymentAction, setOrderPaidAction, updateOrderAction } from "@/lib/note-lead-actions";
import { formatLeadPhone } from "@/lib/note-leads";
import { NOTES_DELIVERY_HOURS, orderPlanLabel } from "@/lib/notes-orders";
import { buildOrderMeta, parseOrderMeta, receivedOf } from "@/lib/order-meta";
import { getNotesCatalog } from "@/lib/paid-notes";
import { normalizePhone } from "@/lib/paid-notes-pricing";

// Who paid in the pop-up (or was added by hand), what they bought, what has been sent, and whether they have access.
// Laid out like the /jameco/syllabus table: one tinted vertical band per student, one row per purchase.
// A whole-semester order can have its subjects listed under it; those are then tracked one by one.

const day = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const overdue = (d: Date) => Date.now() - d.getTime() > NOTES_DELIVERY_HOURS * 3600_000;
const markBtn = "rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700";
const undoBtn = "text-xs text-muted underline-offset-2 hover:underline";
const field = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const label = "flex flex-col gap-1 text-xs text-muted";
const linkBtn = "cursor-pointer list-none text-xs font-medium text-accent hover:underline [&::-webkit-details-marker]:hidden";
const saveBtn = "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90";

type Order = Awaited<ReturnType<typeof prisma.notesOrder.findMany>>[number];
type Profile = { name: string | null; altPhone: string | null; gmail: string | null };
type Preset = { programme: string; semester: number; under: string };

// Everything with access on the site shows up here by itself as rows already marked given: a website purchase, a UPI
// payment you approved, or a subject you gave to a Gmail yourself. Access is unlocked the moment it is approved, so
// there is nothing left to send. Students are matched to a manual entry by Gmail.
const isAuto = (o: Order) => o.id.startsWith("site-");
const isUnpaid = (o: Order) => parseOrderMeta(o.adminNote).unpaid;
const isManual = (o: Order) => o.razorpayPaymentId.startsWith("manual-");
/** Rupees received for one purchase. Razorpay / site payments are always paid in full; hand-entered ones can be part paid. */
const recvOf = (o: Order) => (isManual(o) ? receivedOf(o.amount, parseOrderMeta(o.adminNote)) : o.amount);

type SubjectInfo = { programme: string; subject: string; semester: number };

async function websiteSales(): Promise<{ orders: Order[]; info: Map<string, SubjectInfo> }> {
  const info = new Map<string, SubjectInfo>();
  try {
    const [rows, catalog] = await Promise.all([
      prisma.purchase.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "asc" } }),
      getNotesCatalog(),
    ]);
    for (const c of catalog) for (const x of c.subjects) info.set(`${c.slug}/${x.slug}`, { programme: c.name, subject: x.name, semester: x.semester ?? 0 });
    const orders = rows.flatMap((p) => {
      const phone = normalizePhone(p.phone) ?? "";
      const email = p.email.trim().toLowerCase();
      if (!email || /^(e2e\.|test\.)/i.test(email)) return []; // test accounts are not students
      return p.items.map((key, i): Order => {
        const [programmeSlug = "", subjectSlug = ""] = key.split("/");
        const f = info.get(key);
        return {
          id: `site-${p.id}-${i}`,
          phone,
          plan: "subject",
          programmeSlug,
          programme: f?.programme ?? "",
          semester: f?.semester ?? 0,
          subjectSlug,
          subject: f?.subject ?? subjectSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          amount: i === 0 ? p.amount : 0, // one payment can cover several subjects: count the money once
          razorpayOrderId: `site-${p.id}`,
          razorpayPaymentId: `site-${p.id}`,
          status: "DELIVERED",
          adminNote: buildOrderMeta({ text: p.amount ? "Website purchase" : "Given by admin", gmail: email }),
          paidAt: p.createdAt,
          deliveredAt: p.reviewedAt ?? p.createdAt,
        };
      });
    });
    return { orders, info };
  } catch (err) {
    console.error("website purchases not read:", err);
    return { orders: [], info };
  }
}

const prettySlug = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const semText = (o: { semester: number }) => (o.semester ? `Sem ${o.semester}` : "");
const where = (o: Order) => [o.programme, semText(o)].filter(Boolean).join(" · ");
const localNumber = (p: string | null) => (p ?? "").replace(/^91/, "");

const ACCESS_CHIP = "rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700";

/** A subject inside a whole-semester order: one tap ticks it as given (or unticks it), and it can be deleted. */
function TickCell({ o, viaAccess }: { o: Order; viaAccess: boolean }) {
  if (isAuto(o)) return <span className={ACCESS_CHIP}>Access given on the site</span>;
  const done = o.status === "DELIVERED" || viaAccess;
  const manual = o.razorpayPaymentId.startsWith("manual-");
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <form action={markOrderDeliveredAction}>
        <input type="hidden" name="id" value={o.id} />
        {o.status === "DELIVERED" && <input type="hidden" name="status" value="PAID" />}
        <button
          type="submit"
          disabled={viaAccess && o.status !== "DELIVERED"}
          aria-label={done ? "Given, tap to untick" : "Pending, tap to tick as given"}
          className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${done ? "border-green-600/40 bg-green-600/10 text-green-700" : "border-border text-muted hover:border-accent hover:text-accent"}`}
        >
          <span aria-hidden className={`flex size-4 items-center justify-center rounded-full text-[10px] leading-none ${done ? "bg-green-600 text-white" : "border border-current"}`}>{done ? "✓" : ""}</span>
          {done ? (viaAccess && o.status !== "DELIVERED" ? "Access given" : `Given${o.deliveredAt ? ` ${day(o.deliveredAt)}` : ""}`) : "Pending"}
        </button>
      </form>
      {manual && (
        <form action={deleteManualOrderAction}>
          <input type="hidden" name="id" value={o.id} />
          <button type="submit" className="text-xs text-muted hover:text-red-500">Delete</button>
        </form>
      )}
    </div>
  );
}

/** "Payment received" for one purchase, kept apart from whether access has been given. */
function PayCell({ o }: { o: Order }) {
  const meta = parseOrderMeta(o.adminNote);
  const unpaid = meta.unpaid;
  const part = !unpaid && meta.paid != null && meta.paid < o.amount;
  if (isAuto(o) || !isManual(o)) return <span className="text-[11px] font-medium text-green-700">Paid ✓</span>; // recorded by Razorpay / site access
  return (
    <form action={setOrderPaidAction} className="mt-0.5">
      <input type="hidden" name="id" value={o.id} />
      <input type="hidden" name="paid" value={unpaid || part ? "yes" : "no"} />
      <button
        type="submit"
        aria-label={unpaid ? "Payment not received, tap to mark received" : part ? "Part paid, tap to mark fully paid" : "Payment received, tap to undo"}
        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${unpaid ? "border-red-500/40 bg-red-500/10 text-red-600" : part ? "border-amber-500/40 bg-amber-500/10 text-amber-700" : "border-green-600/40 bg-green-600/10 text-green-700"}`}
      >
        {unpaid ? "Unpaid" : part ? `Paid ₹${meta.paid} · rest ₹${o.amount - (meta.paid ?? 0)}` : "Paid ✓"}
      </button>
    </form>
  );
}

function DeliveryCell({ o, kids, viaAccess, doneKids }: { o: Order; kids: Order[]; viaAccess: boolean; doneKids: number }) {
  if (kids.length > 0) {
    const done = doneKids;
    return (
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${done === kids.length ? "bg-green-600/10 text-green-700" : "bg-amber-500/10 text-amber-700"}`}>
        {done} of {kids.length} subjects delivered
      </span>
    );
  }
  if (isAuto(o)) return <span className={ACCESS_CHIP}>Access unlocked on the site</span>;
  if (viaAccess && o.status !== "DELIVERED") return <span className={ACCESS_CHIP}>Access given on the site</span>;
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
function OrderForm({ o, skey, programmes, askPhone, preset }: { o?: Order; skey?: string; programmes: string[]; askPhone?: boolean; preset?: Preset }) {
  const manual = o?.razorpayPaymentId.startsWith("manual-");
  return (
    <div className="mt-2 rounded-xl border border-border bg-background p-3">
      <form action={o ? updateOrderAction : addOrderAction} className="grid gap-3 sm:grid-cols-2">
        {o ? <input type="hidden" name="id" value={o.id} /> : !askPhone && <input type="hidden" name="skey" value={skey} />}
        {preset && <input type="hidden" name="under" value={preset.under} />}
        {askPhone && (
          <>
            <label className={label}>
              Student&apos;s Gmail
              <input name="gmail" type="email" placeholder="name@gmail.com" className={field} />
            </label>
            <label className={label}>
              WhatsApp number (if you have it)
              <input name="phone" inputMode="tel" placeholder="98765 43210" className={field} />
            </label>
            <label className={`${label} sm:col-span-2`}>
              Student&apos;s name (optional)
              <input name="name" placeholder="e.g. Riya Sharma" className={field} />
            </label>
          </>
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
          Course (optional)
          <input name="programme" list="delivery-programmes" defaultValue={o?.programme ?? preset?.programme ?? ""} placeholder="e.g. B.Com (P)" className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>
            Semester (optional)
            <input name="semester" type="number" min={1} max={8} defaultValue={o?.semester || preset?.semester || ""} className={field} />
          </label>
          <label className={label}>
            Paid (₹)
            <input name="amount" type="number" min={0} defaultValue={o?.amount ?? (preset ? 0 : 49)} className={field} />
          </label>
        </div>
        <input type="hidden" name="hasPaid" value="1" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="paid" defaultChecked={o ? !isUnpaid(o) : true} /> Payment received
        </label>
        {!o && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="delivered" /> Access granted
          </label>
        )}
        <div className="flex items-center gap-3 sm:col-span-2">
          <button type="submit" className={saveBtn}>{o ? "Save changes" : "Add"}</button>
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

/** One line: type a subject name (or several, separated by commas) and press Enter. Optionally saved as already given. */
function QuickAdd({ skey, under, placeholder = "Add subject: type the name, press Enter" }: { skey?: string; under?: string; placeholder?: string }) {
  return (
    <form action={quickAddSubjectsAction} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {under ? <input type="hidden" name="under" value={under} /> : <input type="hidden" name="skey" value={skey} />}
      <input name="subjects" required placeholder={placeholder} aria-label="Subject name" autoComplete="off" className={`${field} min-w-0 flex-1 basis-48 py-1.5`} />
      <label className="flex items-center gap-1 text-xs text-muted">
        <input type="checkbox" name="delivered" /> Access given
      </label>
      <button type="submit" className="rounded-lg border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10">Add</button>
    </form>
  );
}

function PackSubjects({ pack, hasKids }: { pack: Order; hasKids: boolean }) {
  return (
    <div className="mt-1.5 flex flex-col gap-1.5">
      {!hasKids && (
        <form action={fillPackFromSyllabusAction}>
          <input type="hidden" name="id" value={pack.id} />
          <button type="submit" className="rounded-lg border border-accent/40 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10">
            Fill in the DSC subjects from the syllabus
          </button>
        </form>
      )}
      <QuickAdd under={pack.id} placeholder="Add subject to this semester" />
    </div>
  );
}

function readyText(o: Order, gmail: string) {
  const what = o.plan === "semester" ? (o.semester ? `Semester ${o.semester} notes` : "semester notes") : `notes for ${o.subject}`;
  const ctx = [o.programme, semText(o)].filter(Boolean).join(", ");
  return `Hi! Your ${what}${ctx ? ` (${ctx})` : ""} are ready. Open https://www.dupyq.online/login and sign in with your Gmail${gmail ? ` (${gmail})` : ""}, then go to My notes to read them. Reply here if you need any help.`;
}

/** Unlock the subject for the student's Gmail, then message them on WhatsApp to log in. */
function NotesReady({ o, gmail, wa }: { o: Order; gmail: string; wa: string }) {
  const own = parseOrderMeta(o.adminNote).gmail;
  return (
    <details className="mt-1">
      <summary className={linkBtn}>{o.status === "DELIVERED" ? "Notes ready ✓" : "Notes ready…"}</summary>
      <div className="mt-2 rounded-xl border border-border bg-background p-3">
        <form action={giveNotesAccessAction} className="flex flex-col gap-2">
          <input type="hidden" name="id" value={o.id} />
          <label className={label}>
            Student&apos;s Gmail (they sign in with it)
            <input name="email" type="email" required defaultValue={own || gmail} placeholder="name@gmail.com" className={field} />
          </label>
          <button type="submit" className="self-start rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90">
            Unlock for this Gmail
          </button>
        </form>
        {wa ? (
        <a
          href={`https://wa.me/${wa}?text=${encodeURIComponent(readyText(o, own || gmail))}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          <WhatsappLogo size={14} weight="fill" /> Message: notes are ready, log in
        </a>
        ) : (
          <p className="mt-2 text-xs text-muted">Add their WhatsApp number (Edit student) to message them from here.</p>
        )}
      </div>
    </details>
  );
}

type Student = {
  key: string; // phone, or "mail:<gmail>" for a student known only by Gmail
  phone: string; // "" when we only have a Gmail
  wa: string; // number to message on WhatsApp: their phone, else the extra number from Edit student
  rows: { o: Order; child: boolean; kids: Order[] }[];
  counted: Order[];
  delivered: number;
  total: number;
  received: number; // rupees whose payment has been received
  due: number; // rupees still to receive (price - paid)
  editablePay: boolean; // has a hand-entered purchase, so the payment line can be typed in the overview
  hasPack: boolean;
  type: string; // Individual / Multiple subjects / Full semester
  last: Date;
  profile: Profile | null;
  gmail: string;
  unlocked: number | null; // subjects unlocked for that Gmail; null = no Gmail
  check: { name: string; given: boolean }[]; // what they bought vs what their Gmail can open
  extra: string[]; // unlocked on the site but not among their purchases
};

const payStatus = (s: Student) => (s.due === 0 ? "Paid" : s.received === 0 ? "Unpaid" : "Part paid");

/** Name, numbers and access status of one student, with a small form to change them. */
function StudentHeader({ s, profilesReady }: { s: Student; profilesReady: boolean }) {
  const p = s.profile;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{p?.name || <span className="font-normal text-muted">No name yet</span>}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
          {s.phone ? (
            <a href={`https://wa.me/${s.phone}`} target="_blank" rel="noreferrer" className="tabular-nums hover:underline">{formatLeadPhone(s.phone)}</a>
          ) : (
            !p?.altPhone && <span>No WhatsApp number yet</span>
          )}
          {p?.altPhone && (
            <a href={`https://wa.me/${p.altPhone}`} target="_blank" rel="noreferrer" className="tabular-nums hover:underline">{s.phone ? "also " : ""}{formatLeadPhone(p.altPhone)}</a>
          )}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="break-all text-muted">{s.gmail || "No Gmail yet"}</span>
          {s.unlocked ? (
            <span className="rounded-full bg-green-600/10 px-2 py-0.5 font-medium text-green-700">Access given · {s.unlocked} subject{s.unlocked === 1 ? "" : "s"}</span>
          ) : (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700">No access given yet</span>
          )}
        </p>
        <details className="mt-1">
          <summary className={linkBtn}>Check access</summary>
          <div className="mt-2 max-w-md rounded-xl border border-border bg-background p-3 text-xs">
            {!s.gmail && <p className="mb-2 text-amber-700">No Gmail on record yet, so the site can&apos;t be checked. Add it in Edit student.</p>}
            <table className="w-full">
              <thead className="text-left text-[11px] uppercase tracking-wide text-muted">
                <tr><th className="pb-1 font-medium">Subject purchased</th><th className="pb-1 text-right font-medium">Access</th></tr>
              </thead>
              <tbody>
                {s.check.map((c, i) => (
                  <tr key={i} className="border-t border-border/60">
                    <td className="py-1 pr-2">{c.name}</td>
                    <td className="py-1 text-right">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${c.given ? "bg-green-600/10 text-green-700" : "bg-amber-500/10 text-amber-700"}`}>{c.given ? "Granted" : "Pending"}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {s.extra.length > 0 && (
              <p className="mt-2 text-muted">Also unlocked on the site, not in purchases: {s.extra.join(", ")}.</p>
            )}
          </div>
        </details>
      </div>
      <details className="w-full sm:w-auto">
        <summary className={linkBtn}>Edit student</summary>
        <div className="mt-2 rounded-xl border border-border bg-background p-3 sm:w-80">
          {!profilesReady && (
            <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
              Saving these needs a one-time database update (add_notes_student) that has not been applied yet.
            </p>
          )}
          <form action={saveStudentAction} className="flex flex-col gap-2">
            <input type="hidden" name="key" value={s.key} />
            <label className={label}>
              Name
              <input name="name" defaultValue={p?.name ?? ""} placeholder="e.g. Riya Sharma" className={field} />
            </label>
            <label className={label}>
              {s.phone ? "Another number (parent / second phone)" : "WhatsApp number"}
              <input name="altPhone" inputMode="tel" defaultValue={localNumber(p?.altPhone ?? null)} placeholder="98765 43210" className={field} />
            </label>
            <label className={label}>
              Gmail they sign in with
              <input name="gmail" type="email" defaultValue={s.gmail} readOnly={s.key.startsWith("mail:")} placeholder="name@gmail.com" className={field} />
            </label>
            <button type="submit" className={`${saveBtn} self-start`}>Save student</button>
          </form>
        </div>
      </details>
    </div>
  );
}

export default async function DeliveryTrackerPage({ searchParams }: { searchParams: Promise<{ show?: string; msg?: string; q?: string }> }) {
  const { show, msg, q: rawQ = "" } = await searchParams;
  const q = rawQ.trim().toLowerCase();
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

  const site = await websiteSales();
  orders = [...orders, ...site.orders].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

  // Student details live in their own table; a database without it yet still shows every order.
  const profiles = new Map<string, Profile>();
  let profilesReady = true;
  try {
    for (const r of await prisma.notesStudent.findMany()) profiles.set(r.phone, r);
  } catch (err) {
    profilesReady = false;
    console.error("notes students not read (migration add_notes_student applied?):", err);
  }

  // One group per student: their phone, or (when we only have a Gmail) that Gmail. A whole-semester order is followed
  // by the subjects listed under it.
  const phoneOfGmail = new Map<string, string>();
  for (const o of orders) {
    const g = parseOrderMeta(o.adminNote).gmail.toLowerCase();
    if (o.phone && g) phoneOfGmail.set(g, o.phone);
  }
  for (const [k, p] of profiles) if (/^\d+$/.test(k) && p.gmail) phoneOfGmail.set(p.gmail.toLowerCase(), k);
  const keyOf = (o: Order) => {
    if (o.phone) return o.phone;
    const g = parseOrderMeta(o.adminNote).gmail.toLowerCase();
    return g ? phoneOfGmail.get(g) ?? `mail:${g}` : `order:${o.id}`;
  };
  const byPhone = new Map<string, Order[]>();
  for (const o of orders) byPhone.set(keyOf(o), [...(byPhone.get(keyOf(o)) ?? []), o]);
  const built: Omit<Student, "unlocked" | "delivered" | "check" | "extra">[] = [...byPhone.entries()].map(([key, rawList]) => {
    // A subject you typed in yourself wins over the same subject listed automatically from site access.
    const typed = rawList.filter((o) => !isAuto(o));
    const same = (a: Order, b: Order) => !!a.subjectSlug && !!b.subjectSlug && (a.subjectSlug === b.subjectSlug || a.subjectSlug.startsWith(`${b.subjectSlug}-`) || b.subjectSlug.startsWith(`${a.subjectSlug}-`));
    const list = rawList.filter((o) => !isAuto(o) || !typed.some((t) => same(t, o)));
    const ids = new Set(list.map((o) => o.id));
    // Subjects the site has unlocked for a student who paid for a whole semester are listed under that semester (the
    // only paid one, or the one for the same semester when there are several); otherwise they stay on their own.
    const packs = list.filter((o) => o.plan === "semester" && !isAuto(o) && !isUnpaid(o));
    const parentOf = new Map<string, string>();
    for (const o of list) {
      if (!isAuto(o) || !packs.length) continue;
      const pick = packs.length === 1 ? packs[0] : packs.find((pk) => pk.semester && pk.semester === o.semester);
      if (pick) parentOf.set(o.id, pick.id);
    }
    const underOf = (o: Order) => parseOrderMeta(o.adminNote).under || parentOf.get(o.id) || "";
    const childOf = (o: Order) => list.filter((k) => underOf(k) === o.id);
    const isChild = (o: Order) => ids.has(underOf(o));
    const rows = list.filter((o) => !isChild(o)).flatMap((o) => {
      const kids = childOf(o);
      return [{ o, child: false, kids }, ...kids.map((k) => ({ o: k, child: true, kids: [] as Order[] }))];
    });
    // A pack that has subjects listed under it is counted through those subjects, not twice.
    const counted = rows.filter((r) => !(r.o.plan === "semester" && r.kids.length > 0)).map((r) => r.o);
    const profile = profiles.get(key) ?? null;
    const phone = /^\d+$/.test(key) ? key : "";
    const gmail = profile?.gmail || (key.startsWith("mail:") ? key.slice(5) : "") || [...list].reverse().map((o) => parseOrderMeta(o.adminNote).gmail).find(Boolean) || "";
    return {
      key, phone, wa: phone || profile?.altPhone || "", rows, profile, gmail,
      counted,
      total: counted.length,
      received: list.reduce((n, o) => n + recvOf(o), 0),
      due: list.reduce((n, o) => n + (o.amount - recvOf(o)), 0),
      editablePay: list.some((o) => isManual(o) && !isAuto(o) && !parseOrderMeta(o.adminNote).under),
      hasPack: list.some((o) => o.plan === "semester" && !isAuto(o)),
      type: list.some((o) => o.plan === "semester") ? "Full semester" : counted.length > 1 ? "Multiple subjects" : "Individual",
      last: list[list.length - 1].paidAt,
    };
  });

  // Access = subjects unlocked on the website for the student's Gmail.
  const unlockedBy = new Map<string, Set<string>>();
  const emails = [...new Set(built.map((s) => s.gmail).filter(Boolean))];
  if (emails.length) {
    try {
      for (const p of await prisma.purchase.findMany({ where: { email: { in: emails }, status: "APPROVED" }, select: { email: true, items: true } })) {
        const set = unlockedBy.get(p.email) ?? new Set<string>();
        p.items.forEach((k) => set.add(k));
        unlockedBy.set(p.email, set);
      }
    } catch (err) {
      console.error("access not read:", err);
    }
  }
  // A subject whose notes are already unlocked for the student's Gmail counts as given, even if nobody ticked it.
  // Orders typed by hand rarely carry the exact programme slug, so a subject also counts when its name matches one the
  // Gmail has unlocked ("game-theory" matches "game-theory-and-strategic-interactions").
  const unlockedSubject = (set: Set<string>, o: Order) =>
    set.has(`${o.programmeSlug}/${o.subjectSlug}`) ||
    (!!o.subjectSlug && [...set].some((k) => { const sl = k.split("/")[1] ?? ""; return sl === o.subjectSlug || sl.startsWith(`${o.subjectSlug}-`) || o.subjectSlug.startsWith(`${sl}-`); }));
  const viaAccess = new Set<string>();
  for (const s of built) {
    const set = s.gmail ? unlockedBy.get(s.gmail.toLowerCase()) : undefined;
    if (set) for (const o of s.counted) if (o.plan === "subject" && o.status !== "DELIVERED" && unlockedSubject(set, o)) viaAccess.add(o.id);
  }
  const all: Student[] = built
    .map((s) => ({
      ...s,
      delivered: s.counted.filter((o) => o.status === "DELIVERED" || viaAccess.has(o.id)).length,
      unlocked: s.gmail ? (unlockedBy.get(s.gmail.toLowerCase())?.size ?? 0) : null,
      check: s.counted.map((o) => ({ name: orderPlanLabel(o), given: o.status === "DELIVERED" || viaAccess.has(o.id) })),
      extra: s.gmail
        ? [...(unlockedBy.get(s.gmail.toLowerCase()) ?? [])]
            .filter((k) => !s.counted.some((o) => unlockedSubject(new Set([k]), o)))
            .map((k) => site.info.get(k)?.subject ?? prettySlug(k.split("/")[1] ?? k))
        : [],
    }));
  const digits = q.replace(/\D/g, "");
  const matches = (s: Student) =>
    !q ||
    [s.profile?.name, s.gmail, s.profile?.altPhone, ...s.counted.map((o) => o.subject)].some((v) => v?.toLowerCase().includes(q)) ||
    (digits.length >= 4 && [s.phone, s.profile?.altPhone].some((v) => v?.includes(digits)));
  const students = all
    .filter((s) => (!pendingOnly || s.delivered < s.total) && matches(s))
    .sort((a, b) => Number(b.delivered < b.total) - Number(a.delivered < a.total) || b.last.getTime() - a.last.getTime());

  const programmes = [...new Set(orders.map((o) => o.programme).filter(Boolean))].sort();
  const totalBought = all.reduce((n, s) => n + s.total, 0);
  const totalDelivered = all.reduce((n, s) => n + s.delivered, 0);
  const totalReceived = all.reduce((n, s) => n + s.received, 0);
  const totalDue = all.reduce((n, s) => n + s.due, 0);
  const tint = (s: Student) => (s.delivered === s.total ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30");
  const tab = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"}`;

  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/admin/leads" className="text-sm text-muted hover:text-foreground">&larr; Leads</Link>
      <h1 className="mt-2 text-2xl font-semibold">Delivery tracker</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Every student who paid, what they bought, what you have sent so far, and whether they have access.</p>

      {msg && <p className="mt-4 max-w-2xl rounded-lg bg-green-600/10 px-4 py-3 text-sm text-foreground">{msg.slice(0, 300)}</p>}

      <dl className="mt-4 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Students", byPhone.size],
          ["Subjects bought", totalBought],
          ["Access given", totalDelivered],
          ["Access pending", totalBought - totalDelivered],
          ["Payments received", `₹${totalReceived}`],
          ["Payments due", `₹${totalDue}`],
        ].map(([label, n]) => (
          <div key={label} className="rounded-xl border border-border bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{n}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Link href={`/admin/leads/delivery${q ? `?q=${encodeURIComponent(rawQ)}` : ""}`} className={tab(!pendingOnly)}>All students</Link>
        <Link href={`/admin/leads/delivery?show=pending${q ? `&q=${encodeURIComponent(rawQ)}` : ""}`} className={tab(pendingOnly)}>Access pending</Link>
        <form className="ml-auto flex w-full gap-2 sm:w-auto">
          {pendingOnly && <input type="hidden" name="show" value="pending" />}
          <input name="q" defaultValue={rawQ} placeholder="Search name, Gmail, mobile or subject" className={`${field} sm:w-72`} />
          <button type="submit" className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground">Search</button>
        </form>
      </div>

      <details className="mt-4 max-w-xl">
        <summary className={linkBtn}>+ Add a student / purchase</summary>
        <OrderForm askPhone programmes={programmes} />
      </details>

      {students.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{q ? `No student matches "${rawQ}".` : pendingOnly ? "Nothing left to give access to." : "No paid orders yet."}</p>
      ) : (
        <>
          {/* All students at a glance: type the purchase type, total price and amount paid once per student */}
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Student</th>
                  <th className="px-3 py-2.5 text-left font-medium">Purchase type</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">Total ₹</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">Paid ₹</th>
                  <th className="px-3 py-2.5 text-left font-medium">Rest</th>
                  <th className="px-3 py-2.5 text-left font-medium">Access</th>
                  <th className="w-16 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const f = `pay-${i}`;
                  const price = s.received + s.due;
                  const cell = "rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-60";
                  return (
                    <tr key={s.key} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <form id={f} action={saveStudentPaymentAction}><input type="hidden" name="skey" value={s.key} /></form>
                        <a href={`#st-${i}`} className="font-medium text-foreground hover:underline">{s.profile?.name || (s.phone ? formatLeadPhone(s.phone) : s.gmail)}</a>
                        <span className="block break-all text-xs text-muted">{[s.gmail, s.phone && s.profile?.name ? formatLeadPhone(s.phone) : ""].filter(Boolean).join(" · ")}</span>
                      </td>
                      <td className="px-3 py-2">
                        <select form={f} name="type" defaultValue={s.hasPack ? "semester" : "subjects"} disabled={!s.editablePay} aria-label="Purchase type" className={cell}>
                          <option value="subjects">Individual / multiple subjects</option>
                          <option value="semester">Full semester</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input form={f} name="price" type="number" min={0} defaultValue={price} disabled={!s.editablePay} aria-label="Total price" className={`${cell} w-24 text-right tabular-nums`} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input form={f} name="paid" type="number" min={0} defaultValue={s.received} disabled={!s.editablePay} aria-label="Amount paid" className={`${cell} w-24 text-right tabular-nums`} />
                      </td>
                      <td className="px-3 py-2">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.due === 0 ? "bg-green-600/10 text-green-700" : s.received === 0 ? "bg-red-500/10 text-red-600" : "bg-amber-500/10 text-amber-700"}`}>
                          {s.due === 0 ? "Paid in full" : `₹${s.due} due`}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <a href={`#st-${i}`} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${s.delivered === s.total ? "bg-green-600/10 text-green-700" : "bg-amber-500/10 text-amber-700"}`}>
                          {s.delivered}/{s.total} given · Check
                        </a>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {s.editablePay ? (
                          <button form={f} type="submit" className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground hover:opacity-90">Save</button>
                        ) : (
                          <span className="text-[11px] text-muted" title="Recorded automatically (Razorpay / site access)">auto</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Desktop: syllabus-style table */}
          <div className="mt-4 hidden overflow-x-auto rounded-2xl border border-border sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead className="bg-surface-muted text-[11px] uppercase tracking-wide text-muted">
                <tr>
                  <th colSpan={2} className="px-3 py-2.5 text-left font-medium">Subject bought</th>
                  <th className="w-16 border-l border-border px-2 py-2.5 text-center font-medium">Sem</th>
                  <th className="w-20 border-l border-border px-2 py-2.5 text-center font-medium">Paid</th>
                  <th className="w-24 border-l border-border px-2 py-2.5 text-center font-medium">Date</th>
                  <th className="w-60 border-l border-border px-3 py-2.5 text-left font-medium">Delivered</th>
                </tr>
              </thead>
              {students.map((s, i) => (
                <tbody key={s.key} id={`st-${i}`} className="scroll-mt-4 border-t border-border">
                  <tr>
                    <th rowSpan={s.rows.length + 2} scope="rowgroup" className={`w-12 border-r border-border p-0 ${tint(s)}`}>
                      <a
                        href={s.wa ? `https://wa.me/${s.wa}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="mx-auto block w-fit max-h-56 rotate-180 overflow-hidden whitespace-nowrap py-6 text-xs font-medium tabular-nums text-foreground [writing-mode:vertical-rl] hover:underline"
                      >
                        {s.phone ? formatLeadPhone(s.phone) : s.profile?.name || s.gmail} · {s.delivered}/{s.total}
                      </a>
                    </th>
                    <td colSpan={5} className="border-b border-border/60 bg-surface-muted/40 px-3 py-2.5">
                      <StudentHeader s={s} profilesReady={profilesReady} />
                    </td>
                  </tr>
                  {s.rows.map(({ o, child, kids }) => (
                    <tr key={o.id} className="border-t border-border/60">
                      <td className={`py-2 pr-3 ${child ? "pl-8" : "pl-3"}`}>
                        <span className="font-medium text-foreground">{child && <span className="mr-1 text-muted">↳</span>}{orderPlanLabel(o)}</span>
                        {o.programme && <span className="block text-xs text-muted">{o.programme}</span>}
                        {!isAuto(o) && <EditRow o={o} programmes={programmes} />}
                        {o.plan === "semester" && !isAuto(o) && <PackSubjects pack={o} hasKids={kids.length > 0} />}
                      </td>
                      <td className="border-l border-border/60 px-2 py-2 text-center text-muted">{o.semester || "—"}</td>
                      <td className="border-l border-border/60 px-2 py-2 text-center tabular-nums">{child && !o.amount ? <span className="text-muted">in pack</span> : !o.amount ? <span className="text-muted">{isAuto(o) ? (parseOrderMeta(o.adminNote).text === "Given by admin" ? "free" : "same payment") : "—"}</span> : `₹${o.amount}`}{!child && !!o.amount && <div><PayCell o={o} /></div>}</td>
                      <td className="border-l border-border/60 px-2 py-2 text-center text-muted">{day(o.paidAt)}</td>
                      <td className="border-l border-border/60 px-3 py-2">
                        {child ? <TickCell o={o} viaAccess={viaAccess.has(o.id)} /> : <DeliveryCell o={o} kids={kids} viaAccess={viaAccess.has(o.id)} doneKids={kids.filter((k) => k.status === "DELIVERED" || viaAccess.has(k.id)).length} />}
                        {!isAuto(o) && <NotesReady o={o} gmail={s.gmail} wa={s.wa} />}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/60">
                    <td colSpan={5} className="px-3 py-2"><QuickAdd skey={s.key} /></td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>

          {/* Phone: one card per student (a wide table is unusable at 390px) */}
          <ul className="mt-4 flex flex-col gap-3 sm:hidden">
            {students.map((s, i) => (
              <li key={s.key} id={`st-${i}`} className="scroll-mt-4 overflow-hidden rounded-xl border border-border bg-surface">
                <div className={`px-4 py-3 ${tint(s)}`}>
                  <StudentHeader s={s} profilesReady={profilesReady} />
                  <p className="mt-2 text-xs text-muted">{s.type} · {s.delivered}/{s.total} access given · {payStatus(s)} ₹{s.received + s.due}</p>
                </div>
                <ul className="divide-y divide-border">
                  {s.rows.map(({ o, child, kids }) => (
                    <li key={o.id} className={`py-3 pr-4 ${child ? "pl-8" : "pl-4"}`}>
                      <p className="text-sm font-medium">{child && <span className="mr-1 text-muted">↳</span>}{orderPlanLabel(o)}</p>
                      <p className="text-xs text-muted">{[where(o), !o.amount ? (child ? "in pack" : "") : `₹${o.amount}`, day(o.paidAt)].filter(Boolean).join(" · ")}</p>
                      {!child && !!o.amount && <div className="mt-1"><PayCell o={o} /></div>}
                      <div className="mt-2">
                        {child ? <TickCell o={o} viaAccess={viaAccess.has(o.id)} /> : <DeliveryCell o={o} kids={kids} viaAccess={viaAccess.has(o.id)} doneKids={kids.filter((k) => k.status === "DELIVERED" || viaAccess.has(k.id)).length} />}
                        {!isAuto(o) && <NotesReady o={o} gmail={s.gmail} wa={s.wa} />}
                      </div>
                      {!isAuto(o) && <EditRow o={o} programmes={programmes} />}
                      {o.plan === "semester" && !isAuto(o) && <PackSubjects pack={o} hasKids={kids.length > 0} />}
                    </li>
                  ))}
                  <li className="px-4 py-3"><QuickAdd skey={s.key} /></li>
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
