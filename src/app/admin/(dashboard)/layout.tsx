import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClockCounterClockwise,
  FileArchive,
  FileArrowUp,
  FileText,
  Files,
  FolderOpen,
  Gear,
  GraduationCap,
  GridFour,
  House,
  MagnifyingGlass,
  Shuffle,
  SignOut,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { logoutAction } from "@/lib/actions";
import { getSession } from "@/lib/auth";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-[100dvh]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-surface p-4">
        <Link href="/admin" className="flex items-center gap-2 px-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <GraduationCap size={16} weight="bold" />
          </span>
          NoteVault
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-1 text-sm">
          <Link
            href="/admin"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <House size={16} />
            Overview
          </Link>
          <Link
            href="/admin/programs"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <GraduationCap size={16} />
            Programs
          </Link>
          <Link
            href="/admin/restore"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <FileArrowUp size={16} />
            Restore
          </Link>
          <Link
            href="/admin/bulk-upload"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <FileArchive size={16} />
            Bulk upload
          </Link>
          <Link
            href="/admin/consolidated-upload"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Stack size={16} />
            Consolidated upload
          </Link>
          <Link
            href="/admin/folder-upload"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <FolderOpen size={16} />
            Folder upload
          </Link>
          <Link
            href="/admin/batches"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <ClockCounterClockwise size={16} />
            Upload batches
          </Link>
          <Link
            href="/admin/resources"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Files size={16} />
            PDF library
          </Link>
          <Link
            href="/admin/coverage"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <GridFour size={16} />
            PYQ coverage
          </Link>
          <Link
            href="/admin/import-pyq-metadata"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <FileText size={16} />
            OCR metadata
          </Link>
          <Link
            href="/admin/ocr-reformat"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <FileText size={16} />
            AI OCR reformat
          </Link>
          <Link
            href="/admin/unsorted"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <Shuffle size={16} />
            Unsorted subjects
          </Link>
          <Link
            href="/admin/subject-issues"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <MagnifyingGlass size={16} />
            Subject issues
          </Link>
          <Link
            href="/admin/failed-uploads"
            className="flex items-center gap-2 rounded-lg px-2 py-2 text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
          >
            <WarningCircle size={16} />
            Failed uploads
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
          <p className="truncate px-2 text-xs text-muted">{session.email}</p>
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

      <div className="flex-1 bg-background">{children}</div>
    </div>
  );
}
