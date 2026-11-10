export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpenText,
  CaretRight,
  CheckCircle,
  Clock,
  DeviceMobile,
  Gift,
  Laptop,
  Receipt,
  SignOut,
  WhatsappLogo,
  XCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getStudentSession } from "@/lib/paid-notes";
import { getPortalData, type PurchaseRow } from "@/lib/student-portal";
import { listLiveDevices } from "@/lib/student-devices";
import { MAX_DEVICES } from "@/lib/student-device-policy";
import { signOutDeviceAction, studentLogoutAction } from "@/lib/paid-notes-actions";
import { shortDate, timeAgo } from "@/lib/time-ago";

export const metadata: Metadata = {
  title: "My notes",
  robots: { index: false },
};

const HELP_WHATSAPP = "919376180015";
const TABS = [
  { id: "notes", label: "My notes" },
  { id: "purchases", label: "Purchases" },
  { id: "devices", label: "Devices" },
] as const;
type TabId = (typeof TABS)[number]["id"];

function firstName(email: string) {
  const word = email.split("@")[0].split(/[._\-\d+]+/).find(Boolean) ?? "there";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// The student dashboard: signed-in students read their notes here (the public
// /notes pages only ever show the free preview), see what they've bought and
// manage the (max 2) devices they're signed in on.
export default async function AccountPage({ searchParams }: { searchParams: Promise<{ tab?: string; error?: string }> }) {
  const session = await getStudentSession();
  if (!session) redirect("/login?next=/account");
  const { email, deviceId } = session;
  const { tab: tabParam, error } = await searchParams;
  const tab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "notes";

  const [portal, devices] = await Promise.all([
    getPortalData(email),
    listLiveDevices(email, deviceId).catch(() => []), // table missing before the migration
  ]);
  const counts: Record<TabId, number> = { notes: portal.ownedCount, purchases: portal.purchases.length, devices: devices.length };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:px-6 sm:pt-12">
      {/* Greeting */}
      <header className="flex items-center gap-3.5">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-lg font-semibold text-white shadow-[0_8px_20px_rgb(0_113_227/0.28)] sm:size-14 sm:text-xl"
        >
          {firstName(email).charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[1.6rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[2rem]">
            Hi, {firstName(email)}
          </h1>
          <p className="truncate text-sm text-muted">{email}</p>
        </div>
        <form action={studentLogoutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            className="flex min-h-10 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3.5 text-sm font-semibold text-foreground transition hover:bg-foreground/[0.1]"
          >
            <SignOut size={16} weight="bold" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </form>
      </header>

      {/* Numbers */}
      <dl className="mt-5 grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat label="Notes" value={String(portal.ownedCount)} />
        <Stat label="Spent" value={`₹${portal.totalPaid}`} />
        <Stat label="Devices" value={`${devices.length}/${MAX_DEVICES}`} />
      </dl>

      {portal.pendingCount > 0 && (
        <p className="mt-3 flex items-start gap-2.5 rounded-[18px] bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <Clock size={18} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            {portal.pendingCount} payment{portal.pendingCount > 1 ? "s" : ""} waiting for verification — usually done within a few hours.
            Your notes appear here the moment it&apos;s approved.
          </span>
        </p>
      )}

      {/* Sections */}
      <nav aria-label="Account sections" className="mt-5 grid grid-cols-3 gap-1 rounded-full bg-foreground/[0.06] p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={t.id === "notes" ? "/account" : `/account?tab=${t.id}`}
            scroll={false}
            aria-current={tab === t.id ? "page" : undefined}
            className={`flex min-h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition sm:text-sm ${
              tab === t.id ? "bg-surface text-foreground shadow-[var(--shadow-tile)]" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
            <span className={`tabular-nums ${tab === t.id ? "text-brand" : "text-muted/70"}`}>{counts[t.id]}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-5">
        {tab === "notes" && <NotesTab groups={portal.groups} expired={portal.expired} />}
        {tab === "purchases" && <PurchasesTab purchases={portal.purchases} />}
        {tab === "devices" && <DevicesTab devices={devices} error={error} />}
      </div>

      <a
        href={`https://wa.me/${HELP_WHATSAPP}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 flex items-center justify-center gap-2 text-sm font-medium text-muted transition hover:text-foreground"
      >
        <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" />
        Need help? Message us on WhatsApp
      </a>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-surface-muted px-3.5 py-3 sm:px-5 sm:py-4">
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-0.5 text-[1.35rem] font-semibold leading-tight tracking-[-0.02em] sm:text-[1.65rem]">{value}</dd>
    </div>
  );
}

const expiryText = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
const SOON_MS = 30 * 86_400_000;

function NotesTab({ groups, expired }: { groups: Awaited<ReturnType<typeof getPortalData>>["groups"]; expired: Awaited<ReturnType<typeof getPortalData>>["expired"] }) {
  if (groups.length === 0 && expired.length === 0) {
    return (
      <section className="rounded-[28px] bg-surface p-7 text-center shadow-[var(--shadow-tile)] sm:p-10">
        <span className="mx-auto flex size-14 items-center justify-center rounded-[18px] bg-brand/10 text-brand">
          <BookOpenText size={28} weight="fill" />
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-[-0.02em]">No notes yet</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[15px] leading-snug text-muted">
          Notes you buy open right here. If you paid with a different Gmail, sign in with that one.
        </p>
        <Link
          href="/paid-notes"
          className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[16px] font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.985]"
        >
          See notes — from ₹99 <ArrowRight size={16} weight="bold" />
        </Link>
      </section>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {groups.length === 0 && (
        <p className="rounded-[22px] bg-surface-muted p-6 text-center text-[15px] text-muted">Your notes have expired — renew below to read them again.</p>
      )}
      {groups.map((g) => (
        <section key={g.programmeSlug} aria-label={g.programme}>
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.07em] text-muted">{g.programme}</h2>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {g.notes.map((n) => (
              <li key={n.key}>
                <Link
                  href={`/account/notes/${n.programmeSlug}/${n.subjectSlug}`}
                  className="group flex min-h-[4.5rem] items-center gap-3.5 rounded-[22px] bg-surface p-3.5 shadow-[var(--shadow-tile)] transition duration-300 ease-[var(--ease-apple)] hover:shadow-[var(--shadow-tile-hover)] active:scale-[0.99]"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand/10 text-brand">
                    <BookOpenText size={22} weight="fill" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{n.subject}</span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {n.semester ? `Semester ${n.semester}` : null}
                      {n.semester && n.expiresAt ? " · " : null}
                      {n.expiresAt && (
                        <span className={n.expiresAt.getTime() - Date.now() < SOON_MS ? "font-semibold text-amber-700 dark:text-amber-300" : ""}>
                          Valid till {expiryText(n.expiresAt)}
                        </span>
                      )}
                    </span>
                  </span>
                  <CaretRight size={16} weight="bold" className="shrink-0 text-muted transition group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {expired.length > 0 && (
        <section aria-label="Expired notes">
          <h2 className="px-1 text-xs font-semibold uppercase tracking-[0.07em] text-muted">Expired</h2>
          <ul className="mt-2 grid gap-2.5 sm:grid-cols-2">
            {expired.map((n) => (
              <li key={n.key}>
                <Link
                  href={`/paid-notes/checkout?plan=1&add=${encodeURIComponent(n.key)}`}
                  className="flex min-h-[4.5rem] items-center gap-3.5 rounded-[22px] bg-surface-muted p-3.5 transition hover:bg-foreground/[0.07]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground/80">{n.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Expired {expiryText(n.expiredAt)}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-brand">Renew</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <Link
        href="/paid-notes"
        className="flex min-h-14 items-center justify-between gap-3 rounded-[22px] bg-surface-muted px-5 text-[15px] font-semibold text-brand transition hover:bg-foreground/[0.07]"
      >
        Get more subjects
        <ArrowRight size={16} weight="bold" />
      </Link>
    </div>
  );
}

const STATUS = {
  APPROVED: { label: "Paid", icon: CheckCircle, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  PENDING: { label: "Verifying", icon: Clock, tone: "text-amber-700 dark:text-amber-300 bg-amber-500/10" },
  REJECTED: { label: "Not verified", icon: XCircle, tone: "text-red-600 dark:text-red-400 bg-red-500/10" },
} as const;

function PurchasesTab({ purchases }: { purchases: PurchaseRow[] }) {
  if (purchases.length === 0) {
    return <p className="rounded-[22px] bg-surface-muted p-6 text-center text-[15px] text-muted">No purchases yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2.5">
      {purchases.map((p) => {
        const st = STATUS[p.status];
        const Icon = p.via === "Gift" ? Gift : Receipt;
        return (
          <li key={p.id} className="rounded-[22px] bg-surface p-4 shadow-[var(--shadow-tile)] sm:p-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-foreground/[0.06] text-muted">
                <Icon size={20} weight="fill" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-semibold leading-tight tracking-[-0.02em]">{p.amount === 0 ? "Free access" : `₹${p.amount}`}</p>
                <p className="text-xs text-muted">
                  {p.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })} · {p.via}
                </p>
              </div>
              <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${st.tone}`}>
                <st.icon size={14} weight="fill" />
                {st.label}
              </span>
            </div>
            <p className="mt-3 text-sm leading-snug text-foreground/85">
              {p.items.length ? p.items.map((i) => i.name).join(" · ") : <span className="text-muted">(subjects removed)</span>}
            </p>
            {p.reference && <p className="mt-1.5 break-all font-mono text-[11px] text-muted">Ref {p.reference}</p>}
          </li>
        );
      })}
    </ul>
  );
}

function DevicesTab({ devices, error }: { devices: Awaited<ReturnType<typeof listLiveDevices>>; error?: string }) {
  return (
    <section>
      <p className="px-1 text-[15px] leading-snug text-muted">
        Your account works on up to {MAX_DEVICES} devices — say your phone and your laptop. To use a new one, sign out of one of these.
        Opened a link from WhatsApp? Open it in Chrome or Safari, or the in-app browser counts as a separate device.
      </p>
      {error && <p className="mt-3 rounded-[18px] bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {devices.length === 0 ? (
        <p className="mt-4 rounded-[22px] bg-surface-muted p-6 text-center text-[15px] text-muted">
          No devices are being tracked for this session.
        </p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {devices.map((d) => {
            const Icon = /iPhone|Android|iPad/.test(d.label) ? DeviceMobile : Laptop;
            return (
              <li key={d.id} className="flex items-center gap-3.5 rounded-[22px] bg-surface p-3.5 shadow-[var(--shadow-tile)]">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand/10 text-brand">
                  <Icon size={22} weight="fill" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold">{d.label}</p>
                  <p className="text-xs text-muted">{d.current ? `This device · signed in ${shortDate(d.since)}` : `Signed in ${shortDate(d.since)} · used ${timeAgo(d.lastSeen)}`}</p>
                </div>
                {d.current ? (
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">This device</span>
                ) : (
                  <form action={signOutDeviceAction}>
                    <input type="hidden" name="id" value={d.id} />
                    <button
                      type="submit"
                      className="min-h-10 shrink-0 rounded-full bg-foreground/[0.07] px-4 text-sm font-semibold text-foreground transition hover:bg-foreground/[0.12]"
                    >
                      Sign out
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
