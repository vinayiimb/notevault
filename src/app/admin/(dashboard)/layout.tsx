import Link from "next/link";
import { redirect } from "next/navigation";
import { CurrencyInr, Files, Flag, Gear, GraduationCap, NotePencil, SignOut } from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";



export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface p-4">
        <Link href="/admin/subject-notes" className="flex items-center gap-2 px-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GraduationCap size={16} weight="bold" />
          </span>
          DU PYQ Online
        </Link>

        {/* Only Subject Notes, Papers archive + Settings are enabled for now — every other
            admin section is parked (see middleware.ts's ADMIN_ALLOWED_PREFIXES)
            until it's actually needed again, so the sidebar only shows what
            actually works instead of dead links that redirect away. */}
        <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
          <Link
            href="/admin/subject-notes"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <NotePencil size={16} />
            Subject Notes
          </Link>
          <Link
            href="/admin/papers-archive"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Files size={16} />
            Papers archive
          </Link>
          <Link
            href="/admin/features"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Flag size={16} />
            Features
          </Link>
          <Link
            href="/admin/payments"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <CurrencyInr size={16} />
            Payments
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Gear size={16} />
            Settings
          </Link>
        </nav>

        <div className="mt-auto border-t border-border pt-3">
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
    </div>
  );
}
