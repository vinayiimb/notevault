import Link from "next/link";

const TABS = [
  { href: "/jameco", label: "PYQ Analyser" },
  { href: "/jameco/syllabus", label: "Syllabus" },
  { href: "/jameco/cutoff", label: "Cutoffs" },
] as const;

/** Switches between the IIT JAM Economics pages. */
export function JamNav({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="IIT JAM Economics" className="mb-5 flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === active ? "page" : undefined}
          className={`shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${
            t.href === active ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
