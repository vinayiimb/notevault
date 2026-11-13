import Link from "next/link";
import { redirect } from "next/navigation";
import { ChartBar, ChatCircleText, CurrencyInr, FileArrowUp, Files, Flag, Gear, GraduationCap, Lifebuoy, NotePencil, SignOut, UsersThree } from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LeadNotifier } from "./lead-notifier";



// Phones: a strip of pill tabs under the brand (scrolls sideways). md and up: the usual sidebar rows.
const navItem =
  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-border px-3.5 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground md:rounded-lg md:border-0 md:px-2";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  // Badge on the Leads link. A missing table (migration not applied yet) must never break the admin.
  const newLeads = await prisma.noteLead.count({ where: { status: "NEW" } }).catch(() => 0);
  const unreadFeedback = await prisma.feedback.count({ where: { read: false } }).catch(() => 0);
  const openTickets = await prisma.supportTicket.count({ where: { status: "OPEN" } }).catch(() => 0);

  return (
    <div className="theme-classic flex min-h-[100dvh] flex-col md:flex-row">
      <aside className="flex shrink-0 flex-col border-b border-border bg-surface p-3 md:w-56 md:border-b-0 md:border-r md:p-4">
        <div className="flex items-center justify-between">
          <Link href="/admin/subject-notes" className="flex items-center gap-2 px-2 font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <GraduationCap size={16} weight="bold" />
            </span>
            DU PYQ Online
          </Link>
          <form action={logoutAction} className="md:hidden">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex size-9 items-center justify-center rounded-full text-foreground/70 transition hover:bg-surface-muted hover:text-foreground"
            >
              <SignOut size={18} />
            </button>
          </form>
        </div>

        {/* Only Subject Notes, Papers archive + Settings are enabled for now — every other
            admin section is parked (see middleware.ts's ADMIN_ALLOWED_PREFIXES)
            until it's actually needed again, so the sidebar only shows what
            actually works instead of dead links that redirect away. */}
        <nav className="-mx-3 mt-2 flex gap-1.5 overflow-x-auto px-3 pb-1 text-sm [scrollbar-width:none] md:mx-0 md:mt-8 md:flex-1 md:flex-col md:gap-1 md:overflow-visible md:px-0 md:pb-0">
          <Link
            href="/admin/subject-notes"
            className={navItem}
          >
            <NotePencil size={16} />
            Subject Notes
          </Link>
          <Link
            href="/admin/papers-archive"
            className={navItem}
          >
            <Files size={16} />
            Papers archive
          </Link>
          <Link
            href="/admin/restore"
            className={navItem}
          >
            <FileArrowUp size={16} />
            OCR upload
          </Link>
          <Link
            href="/admin/pyq-analyser"
            className={navItem}
          >
            <ChartBar size={16} />
            PYQ Analyser
          </Link>
          <Link
            href="/admin/features"
            className={navItem}
          >
            <Flag size={16} />
            Features
          </Link>
          <Link
            href="/admin/leads"
            className={navItem}
          >
            <UsersThree size={16} />
            Leads
            {newLeads > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-foreground">
                {newLeads}
              </span>
            )}
          </Link>
          <Link href="/admin/feedback" className={navItem}>
            <ChatCircleText size={16} />
            Feedback
            {unreadFeedback > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-foreground">
                {unreadFeedback}
              </span>
            )}
          </Link>
          <Link href="/admin/support" className={navItem}>
            <Lifebuoy size={16} />
            Support
            {openTickets > 0 && (
              <span className="ml-auto rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-accent-foreground">
                {openTickets}
              </span>
            )}
          </Link>
          <Link
            href="/admin/payments"
            className={navItem}
          >
            <CurrencyInr size={16} />
            Payments
          </Link>
          <Link
            href="/admin/settings"
            className={navItem}
          >
            <Gear size={16} />
            Settings
          </Link>
        </nav>

        <div className="mt-auto hidden border-t border-border pt-3 md:block">
          <p className="truncate px-2 text-xs text-muted">{session?.email || "admin@notevault.du"}</p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
            >
              <SignOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0 flex-1 bg-background">{children}</div>
      <LeadNotifier />
    </div>
  );
}
