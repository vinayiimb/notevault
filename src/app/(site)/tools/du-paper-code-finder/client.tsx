"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MagnifyingGlass, CaretRight, BookOpenText } from "@phosphor-icons/react/dist/ssr";

export function DuPaperCodeClient({ initialCourses }: { initialCourses: any[] }) {
  const [query, setQuery] = useState("");

  const filteredCourses = useMemo(() => {
    if (!query.trim()) return [];
    
    const q = query.toLowerCase();
    return initialCourses.filter(c => 
      c.title.toLowerCase().includes(q) || 
      c.upcs.some((u: string) => u.toLowerCase().includes(q))
    ).slice(0, 15);
  }, [query, initialCourses]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Search Input */}
      <div className="relative shadow-sm rounded-2xl">
        <MagnifyingGlass size={24} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by UPC (e.g. 2176000004) or Title..."
          className="w-full rounded-2xl border-2 border-border bg-surface py-4 pl-12 pr-4 text-base sm:text-lg text-foreground outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft transition"
        />
      </div>

      {/* Results */}
      {query.trim() && (
        <div className="bg-surface border border-border rounded-2xl overflow-hidden shadow-sm">
          {filteredCourses.length > 0 ? (
            <div className="divide-y divide-border">
              {filteredCourses.map((c, i) => (
                <Link
                  key={c.slug + i}
                  href={`/course/${c.slug}`}
                  className="flex items-center justify-between p-4 sm:p-5 hover:bg-surface-muted transition group"
                >
                  <div className="min-w-0 pr-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center rounded bg-accent-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        {c.courseType || "General"}
                      </span>
                      <span className="text-xs font-mono font-medium text-muted">UPC: {c.upcs[0]}</span>
                    </div>
                    <h3 className="font-bold text-foreground text-base group-hover:text-brand transition truncate">
                      {c.title}
                    </h3>
                  </div>
                  <CaretRight size={20} weight="bold" className="text-muted group-hover:text-brand transition-transform group-hover:translate-x-1 shrink-0" />
                </Link>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted">
              <BookOpenText size={32} className="mx-auto mb-3 text-border" />
              <p>No courses found matching "{query}".</p>
              <p className="text-sm mt-1">Try searching by partial title or check the UPC.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
