"use client";

import Link from "next/link";

interface VocabItem {
  id: string;
  title: string;
  emoji: string;
  href: string;
}

const ITEMS: VocabItem[] = [
  { id: "word-battle", title: "Word Battle", emoji: "⚔️", href: "/tools/exam-kit" },
  { id: "flashcards", title: "Flashcards", emoji: "📖", href: "/tools/exam-kit" },
  { id: "word-list", title: "Word List", emoji: "📑", href: "/browse/college" },
  { id: "crossword", title: "Crossword", emoji: "🧩", href: "/tools/exam-kit" },
  { id: "phrasal-verbs", title: "Phrasal Verbs", emoji: "💬", href: "/browse/college" },
];

export function VocabBuilderGrid() {
  return (
    <section className="space-y-4">
      {/* Section Header */}
      <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
        VOCAB BUILDER
      </h3>

      {/* Grid of 5 cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="group flex flex-col items-center justify-center rounded-[16px] bg-white dark:bg-[#1A1D24] py-8 px-4 text-center shadow-[0_2px_10px_rgba(0,0,0,0.025)] dark:shadow-none hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
          >
            {/* Emoji icon */}
            <span className="text-4xl group-hover:scale-110 transition-transform duration-200">
              {item.emoji}
            </span>
            {/* Title */}
            <span className="mt-3.5 text-[13px] font-extrabold text-gray-800 dark:text-gray-200">
              {item.title}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
