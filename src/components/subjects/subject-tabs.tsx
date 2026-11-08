"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Target, FileQuestion, PenTool } from "lucide-react";

// Segmented control under the subject title. Client-side only so the
// current tab can be highlighted from the URL.
export function SubjectTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const tabs = [
    { name: "Overview", href: `/subject/${slug}`, icon: BookOpen },
    { name: "PYQs", href: `/subject/${slug}/pyq`, icon: FileText },
    { name: "Notes", href: `/subject/${slug}/notes`, icon: PenTool },
    { name: "Important Questions", href: `/subject/${slug}/important-questions`, icon: Target },
    { name: "Mock Tests", href: `/subject/${slug}/mock-test`, icon: FileQuestion },
  ];

  return (
    <nav aria-label="Subject sections" className="-mx-5 mt-7 overflow-x-auto px-5 pb-1 sm:-mx-10 sm:mt-8 sm:px-10">
      <div className="flex w-max gap-2">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.name}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[14px] font-medium transition-colors duration-300 ${
                active
                  ? "bg-brand text-brand-foreground"
                  : "bg-surface text-muted ring-1 ring-border/70 hover:text-foreground"
              }`}
            >
              <tab.icon className="size-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
