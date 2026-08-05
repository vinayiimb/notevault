import type { Metadata } from "next";
import Link from "next/link";
import {
  ArticleNyTimes,
  ChatCircleText,
  Compass,
  Exam,
  FileArchive,
  Wrench,
} from "@phosphor-icons/react/dist/ssr";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

export const metadata: Metadata = {
  title: "Free Delhi University Student Resources",
  description:
    "Every free DU PYQ Online resource in one place — course browsing, the full previous-year paper archive, exam sessions, study tools, and exam-prep guides.",
  alternates: { canonical: "/resources" },
  openGraph: {
    title: "Free Delhi University Student Resources",
    description:
      "Every free DU PYQ Online resource in one place — course browsing, the full previous-year paper archive, exam sessions, study tools, and exam-prep guides.",
  },
};

const RESOURCES = [
  {
    href: "/courses",
    title: "Course-wise previous year papers",
    description: "Browse every Delhi University programme and jump straight to its papers by semester.",
    icon: Compass,
  },
  {
    href: "/pyq-notes",
    title: "Full paper & notes archive",
    description: "The complete, searchable archive — every course, semester, and subject in one place.",
    icon: FileArchive,
  },
  {
    href: "/exam-sessions",
    title: "Examination-session archive",
    description: "Question papers grouped by exam session, with a Google Drive folder for every course.",
    icon: Exam,
  },
  {
    href: "/tools",
    title: "Study tools & notes",
    description: "Turn notes and PYQs into flashcards, revision drills, and written-answer practice.",
    icon: Wrench,
  },
  {
    href: "/tools/exam-kit",
    title: "DU Exam Kit",
    description: "Build recall drills and exam practice from material you already trust.",
    icon: Wrench,
  },
  {
    href: "/blog",
    title: "Blog & study guides",
    description: "Practical guides on using previous-year papers and planning semester revision.",
    icon: ArticleNyTimes,
  },
  {
    href: "/feedback",
    title: "Report a missing paper",
    description: "Can't find a paper, or spotted an issue? Let us know and we'll look into it.",
    icon: ChatCircleText,
  },
] as const;

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Resources", url: "/resources" },
        ]}
      />

      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <Compass size={18} weight="bold" /> Resources
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Free Delhi University Student Resources
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Everything DU PYQ Online offers, in one place — free to use, no account required.
        </p>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map((resource) => {
          const Icon = resource.icon;
          return (
            <Link
              key={resource.href}
              href={resource.href}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-2xs transition hover:border-accent/50 hover:shadow-sm"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon size={22} weight="bold" />
              </span>
              <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground group-hover:text-accent">
                {resource.title}
              </h2>
              <p className="mt-2 flex-1 text-sm leading-6 text-muted">{resource.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
