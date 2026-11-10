export const dynamic = "force-dynamic";
import Link from "next/link";
import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { addOrderAction, addPackSubjectsAction, deleteManualOrderAction, fillPackFromSyllabusAction, giveNotesAccessAction, markOrderDeliveredAction, saveStudentAction, updateOrderAction } from "@/lib/note-lead-actions";
import { formatLeadPhone } from "@/lib/note-leads";
import { NOTES_DELIVERY_HOURS, orderPlanLabel } from "@/lib/notes-orders";
import { buildOrderMeta, parseOrderMeta } from "@/lib/order-meta";
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

async function websiteSales(): Promise<Order[]> {
  try {
    const [rows, catalog] = await Promise.all([
      prisma.purchase.findMany({ where: { status: "APPROVED" }, orderBy: { createdAt: "asc" } }),
      getNotesCatalog(),
    ]);
    const info = new Map<string, { programme: string; subject: string; semester: number }>();
    for (const c of catalog) for (const x of c.subjects) info.set(`${c.slug}/${x.slug}`, { programme: c.name, subject: x.name, semester: x.semester ?? 0 });
    return rows.flatMap((p) => {
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
  } catch (err) {
    console.error("website purchases not read:", err);
    return [];
  }
}

const semText = (o: { semester: number }) => (o.semester ? `Sem ${o.semester}` : "");
const where = (o: Order) => [o.programme, semText(o)].filter(Boolean).join(" · ");
const localNumber = (p: string | null) => (p ?? "").replace(/^91/, "");

const ACCESS_CHIP = "rounded-full bg-green-600/10 px-2 py-0.5 text-xs font-medium text-green-700";

/** A subject inside a whole-semester order: one tap ticks it as given (or unticks it), and it can be deleted. */
function TickCell({ o, viaAccess }: { o: Order; viaAccess: boolean }) {
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

function DeliveryCell({ o, kids, viaAccess }: { o: Order; kids: Order[]; viaAccess: boolean }) {
  if (kids.length > 0) {
    const done = kids.filter((k) => k.status === "DELIVERED").length;
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
        {!o && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="delivered" /> Already delivered
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

/** Type all the subjects of a whole-semester order at once, one per line. */
function PackSubjects({ pack, hasKids }: { pack: Order; hasKids: boolean }) {
  return (
    <>
      {!hasKids && (
        <form action={fillPackFromSyllabusAction} className="mt-1">
          <input type="hidden" name="id" value={pack.id} />
          <button type="submit" className="rounded-lg border border-accent/40 bg-accent/5 px-2.5 py-1 text-xs font-medium text-accent hover:bg-accent/10">
            Fill in the DSC subjects from the syllabus
          </button>
        </form>
      )}
    <details className="mt-1">
      <summary className={linkBtn}>+ Add subjects of this semester</summary>
      <form action={addPackSubjectsAction} className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-background p-3">
        <input type="hidden" name="under" value={pack.id} />
        <label className={label}>
          Type each subject on its own line (numbers like &ldquo;1.&rdquo; are fine)
          <textarea name="subjects" required rows={5} placeholder={"1. Financial Accounting\n2. Business Law\n3. Microeconomics"} className={field} />
        </label>
        <button type="submit" className={`${saveBtn} self-start`}>Add subjects</button>
      </form>
    </details>
    </>
  );
}

function AddRow({ skey, programmes, preset, text = "+ Add subject" }: { skey: string; programmes: string[]; preset?: Preset; text?: string }) {
  return (
    <details>
      <summary className={linkBtn}>{text}</summary>
      <OrderForm skey={skey} programmes={programmes} preset={preset} />
    </details>
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
  paid: number;
  last: Date;
  profile: Profile | null;
  gmail: string;
  unlocked: number | null; // subjects unlocked for that Gmail; null = no Gmail
};

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

export default async function DeliveryTrackerPage({ searchParams }: { searchParams: Promise<{ show?: string; msg?: string }> }) {
  const { show, msg } = await searchParams;
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

  orders = [...orders, ...(await websiteSales())].sort((a, b) => a.paidAt.getTime() - b.paidAt.getTime());

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
  const built: Omit<Student, "unlocked" | "delivered">[] = [...byPhone.entries()].map(([key, rawList]) => {
    // A subject you typed in yourself wins over the same subject listed automatically from site access.
    const typed = rawList.filter((o) => !isAuto(o));
    const same = (a: Order, b: Order) => !!a.subjectSlug && !!b.subjectSlug && (a.subjectSlug === b.subjectSlug || a.subjectSlug.startsWith(`${b.subjectSlug}-`) || b.subjectSlug.startsWith(`${a.subjectSlug}-`));
    const list = rawList.filter((o) => !isAuto(o) || !typed.some((t) => same(t, o)));
    const ids = new Set(list.map((o) => o.id));
    const childOf = (o: Order) => list.filter((k) => parseOrderMeta(k.adminNote).under === o.id);
    const isChild = (o: Order) => ids.has(parseOrderMeta(o.adminNote).under);
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
      paid: list.reduce((n, o) => n + o.amount, 0),
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
    }));
  const students = all
    .filter((s) => !pendingOnly || s.delivered < s.total)
    .sort((a, b) => Number(b.delivered < b.total) - Number(a.delivered < a.total) || b.last.getTime() - a.last.getTime());

  const programmes = [...new Set(orders.map((o) => o.programme).filter(Boolean))].sort();
  const totalBought = all.reduce((n, s) => n + s.total, 0);
  const totalDelivered = all.reduce((n, s) => n + s.delivered, 0);
  const tint = (s: Student) => (s.delivered === s.total ? "bg-green-50 dark:bg-green-950/30" : "bg-amber-50 dark:bg-amber-950/30");
  const tab = (active: boolean) => `rounded-full border px-3 py-1.5 text-sm ${active ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"}`;

  return (
    <div className="px-4 py-5 sm:p-8">
      <Link href="/admin/leads" className="text-sm text-muted hover:text-foreground">&larr; Leads</Link>
      <h1 className="mt-2 text-2xl font-semibold">Delivery tracker</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">Every student who paid, what they bought, what you have sent so far, and whether they have access.</p>

      {msg && <p className="mt-4 max-w-2xl rounded-lg bg-green-600/10 px-4 py-3 text-sm text-foreground">{msg.slice(0, 300)}</p>}

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
                  <th className="w-60 border-l border-border px-3 py-2.5 text-left font-medium">Delivered</th>
                </tr>
              </thead>
              {students.map((s) => (
                <tbody key={s.key} className="border-t border-border">
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
                      <td className="border-l border-border/60 px-2 py-2 text-center tabular-nums">{child && !o.amount ? <span className="text-muted">in pack</span> : !o.amount ? <span className="text-muted">{isAuto(o) ? (parseOrderMeta(o.adminNote).text === "Given by admin" ? "free" : "same payment") : "—"}</span> : `₹${o.amount}`}</td>
                      <td className="border-l border-border/60 px-2 py-2 text-center text-muted">{day(o.paidAt)}</td>
                      <td className="border-l border-border/60 px-3 py-2">
                        {child ? <TickCell o={o} viaAccess={viaAccess.has(o.id)} /> : <DeliveryCell o={o} kids={kids} viaAccess={viaAccess.has(o.id)} />}
                        {!isAuto(o) && <NotesReady o={o} gmail={s.gmail} wa={s.wa} />}
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t border-border/60">
                    <td colSpan={5} className="px-3 py-2"><AddRow skey={s.key} programmes={programmes} /></td>
                  </tr>
                </tbody>
              ))}
            </table>
          </div>

          {/* Phone: one card per student (a wide table is unusable at 390px) */}
          <ul className="mt-4 flex flex-col gap-3 sm:hidden">
            {students.map((s) => (
              <li key={s.key} className="overflow-hidden rounded-xl border border-border bg-surface">
                <div className={`px-4 py-3 ${tint(s)}`}>
                  <StudentHeader s={s} profilesReady={profilesReady} />
                  <p className="mt-2 text-xs text-muted">{s.total} bought · {s.delivered} delivered · ₹{s.paid}</p>
                </div>
                <ul className="divide-y divide-border">
                  {s.rows.map(({ o, child, kids }) => (
                    <li key={o.id} className={`py-3 pr-4 ${child ? "pl-8" : "pl-4"}`}>
                      <p className="text-sm font-medium">{child && <span className="mr-1 text-muted">↳</span>}{orderPlanLabel(o)}</p>
                      <p className="text-xs text-muted">{[where(o), !o.amount ? (child ? "in pack" : "") : `₹${o.amount}`, day(o.paidAt)].filter(Boolean).join(" · ")}</p>
                      <div className="mt-2">
                        {child ? <TickCell o={o} viaAccess={viaAccess.has(o.id)} /> : <DeliveryCell o={o} kids={kids} viaAccess={viaAccess.has(o.id)} />}
                        {!isAuto(o) && <NotesReady o={o} gmail={s.gmail} wa={s.wa} />}
                      </div>
                      {!isAuto(o) && <EditRow o={o} programmes={programmes} />}
                      {o.plan === "semester" && !isAuto(o) && <PackSubjects pack={o} hasKids={kids.length > 0} />}
                    </li>
                  ))}
                  <li className="px-4 py-3"><AddRow skey={s.key} programmes={programmes} /></li>
                </ul>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
