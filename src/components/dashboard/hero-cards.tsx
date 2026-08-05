import Link from "next/link";
import { ArrowRight, Calendar, FileText, ListChecks } from "@phosphor-icons/react/dist/ssr";
import type { ResourceItem } from "./recent-resources";

interface HeroCardsProps {
  pyqCount: number;
  notesCount: number;
  latestPyq?: ResourceItem;
  latestNotes?: ResourceItem;
}

function HeroCard({
  label,
  icon: Icon,
  count,
  latest,
  attemptHref,
  viewAllHref,
  viewAllLabel,
}: {
  label: string;
  icon: React.ElementType;
  count: number;
  latest?: ResourceItem;
  attemptHref: string;
  viewAllHref: string;
  viewAllLabel: string;
}) {
  const dateStr = latest
    ? new Date(latest.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : null;

  return (
    <div className="relative flex-1 rounded-2xl border border-border bg-surface p-5">
      <span className="absolute right-4 top-4 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
        {count} {count === 1 ? "file" : "files"}
      </span>

      <div className="flex items-center gap-2.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <Icon size={18} weight="bold" />
        </span>
        <h3 className="font-display text-xl font-extrabold tracking-tight text-foreground">{label}</h3>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {latest ? (
          <span className="flex min-w-0 items-center gap-1.5 text-sm text-muted">
            <Calendar size={15} weight="bold" className="shrink-0" />
            <span className="shrink-0">{dateStr}:</span>
            <span className="truncate font-medium text-foreground">{latest.title}</span>
          </span>
        ) : (
          <span className="text-sm text-muted">No {label.toLowerCase()} added yet</span>
        )}
        <Link
          href={attemptHref}
          className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-brand px-3.5 text-xs font-bold text-brand-foreground transition hover:bg-brand-hover"
        >
          Open <ArrowRight size={13} weight="bold" />
        </Link>
      </div>

      <Link
        href={viewAllHref}
        className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-brand transition-colors"
      >
        {viewAllLabel} <ArrowRight size={12} weight="bold" />
      </Link>
    </div>
  );
}

export function HeroCards({ pyqCount, notesCount, latestPyq, latestNotes }: HeroCardsProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <HeroCard
        label="PYQ"
        icon={ListChecks}
        count={pyqCount}
        latest={latestPyq}
        attemptHref={latestPyq ? `/subjects/${latestPyq.subject.id}` : "/pyq-notes"}
        viewAllHref="/pyq-notes"
        viewAllLabel="View All Passages"
      />
      <HeroCard
        label="Notes"
        icon={FileText}
        count={notesCount}
        latest={latestNotes}
        attemptHref={latestNotes ? `/subjects/${latestNotes.subject.id}` : "/browse/college"}
        viewAllHref="/browse/college"
        viewAllLabel="View All Practice Sets"
      />
    </div>
  );
}
