export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Lifebuoy } from "@phosphor-icons/react/dist/ssr";
import { getStudentSession } from "@/lib/paid-notes";
import { getStudentActivity } from "@/lib/student-activity";
import { feathersFor } from "@/lib/feathers";
import { shortDate, timeAgo } from "@/lib/time-ago";
import { STATUS_LABEL, TICKET_KINDS, listMyTickets, parseKind, type TicketRow, type TicketStatus } from "@/lib/support";
import { AccountShell } from "@/components/account-shell";
import { TicketForm } from "@/components/account/ticket-form";

export const metadata: Metadata = { title: "Help & tickets", robots: { index: false } };

const STATUS_STYLE: Record<TicketStatus, string> = {
  OPEN: "bg-amber-500/10 text-amber-800",
  IN_PROGRESS: "bg-brand/10 text-brand",
  RESOLVED: "bg-emerald-500/10 text-emerald-700",
};

function firstName(email: string) {
  const word = email.split("@")[0].split(/[._\-\d+]+/).find(Boolean) ?? "there";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

// Tell us a problem, report an error, or suggest something. The owner answers in
// Admin → Support and the reply appears under the ticket here.
export default async function SupportPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const session = await getStudentSession();
  if (!session) redirect("/login?next=/account/support");
  const { email } = session;
  const { kind } = await searchParams;

  const [tickets, activity] = await Promise.all([listMyTickets(email), getStudentActivity(email)]);
  const feathers = feathersFor(activity?.totalSeconds ?? 0, activity?.activeDays ?? 0);

  return (
    <AccountShell name={firstName(email)} email={email} streak={activity?.streak ?? 0} feathers={feathers} current="/account/support">
      <div className="mx-auto w-full max-w-[1100px] px-4 pb-16 pt-5 sm:px-8 sm:pt-7">
        <h1 className="font-display text-[1.6rem] font-semibold tracking-[-0.03em] sm:text-[2rem]">Help &amp; tickets</h1>
        <p className="mt-1 max-w-2xl text-[15px] text-muted">
          Facing a problem, found a mistake in a note, or have an idea? Tell us here — we read every ticket and reply on this page.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_1fr] lg:items-start">
          <TicketForm initialKind={parseKind(kind) ?? "PROBLEM"} />

          <section aria-label="Your tickets">
            <h2 className="text-sm font-semibold uppercase tracking-[0.07em] text-muted">Your tickets</h2>
            {tickets === null ? (
              <p className="mt-3 rounded-[18px] bg-foreground/[0.05] p-4 text-sm text-muted">Tickets are being switched on — check back soon.</p>
            ) : tickets.length === 0 ? (
              <div className="mt-3 flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-foreground/[0.15] p-8 text-center">
                <Lifebuoy size={28} className="text-muted" />
                <p className="text-sm text-muted">Nothing raised yet. Your tickets and our replies will show up here.</p>
              </div>
            ) : (
              <ul className="mt-3 flex flex-col gap-3">
                {tickets.map((t) => (
                  <TicketCard key={t.id} t={t} />
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AccountShell>
  );
}

function TicketCard({ t }: { t: TicketRow }) {
  const kindLabel = TICKET_KINDS.find((k) => k.id === t.kind)?.label ?? t.kind;
  const created = t.createdAt.toISOString();
  return (
    <li className="rounded-[22px] bg-surface p-4 shadow-[var(--shadow-tile)] sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2.5 py-1 font-semibold ${STATUS_STYLE[t.status]}`}>{STATUS_LABEL[t.status]}</span>
        <span className="text-muted">{kindLabel}</span>
        <span className="ml-auto text-muted">
          {timeAgo(created)} · {shortDate(created)}
        </span>
      </div>
      <h3 className="mt-2 text-[15px] font-semibold leading-snug">{t.subject}</h3>
      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground/80">{t.message}</p>
      {t.screenshotUrl && (
        <a href={t.screenshotUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block overflow-hidden rounded-xl border border-foreground/[0.1]">
          <Image src={t.screenshotUrl} alt="Your screenshot" width={160} height={100} unoptimized loading="lazy" className="h-[100px] w-[160px] object-cover" />
        </a>
      )}
      {t.reply && (
        <div className="mt-3 rounded-[16px] bg-brand/[0.07] p-3.5">
          <p className="text-xs font-semibold text-brand">Reply from DU PYQ{t.repliedAt ? ` · ${shortDate(t.repliedAt.toISOString())}` : ""}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{t.reply}</p>
        </div>
      )}
    </li>
  );
}
