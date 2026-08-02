"use client";

import Link from "next/link";
import { ArrowRight, BookmarkSimple, Trash } from "@phosphor-icons/react";
import { useSavedItems } from "@/lib/dashboard-store";

export function SavedResources() {
  const { saved, removeSavedItem } = useSavedItems();

  return (
    <section id="saved" className="space-y-4" aria-labelledby="saved-resources-title">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="saved-resources-title" className="text-lg font-bold font-display text-foreground">
            Saved Material & Bookmarks
          </h2>
          <p className="text-xs text-muted">Your bookmarked subjects and study files</p>
        </div>
        {saved.length > 0 && (
          <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-bold text-amber-600 dark:text-amber-400">
            {saved.length} Saved
          </span>
        )}
      </div>

      {saved.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center space-y-2">
          <div className="flex size-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <BookmarkSimple size={22} weight="bold" />
          </div>
          <p className="text-sm font-bold text-foreground">No saved resources</p>
          <p className="text-xs text-muted max-w-xs">
            Save notes, PYQs and subjects to find them quickly here during exam revision.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {saved.slice(0, 4).map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-all hover:border-amber-500/40 hover:shadow-md space-y-3"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                    <BookmarkSimple size={12} weight="fill" />
                    {item.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSavedItem(item.id)}
                    title="Remove bookmark"
                    className="text-muted hover:text-red-500 transition-colors"
                  >
                    <Trash size={15} weight="bold" />
                  </button>
                </div>

                <h3 className="line-clamp-2 text-sm font-bold text-foreground">
                  {item.title}
                </h3>
              </div>

              <Link
                href={item.url}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl bg-surface-muted px-3 text-xs font-semibold text-foreground hover:bg-brand hover:text-brand-foreground transition-colors"
              >
                <span>Open Item</span>
                <ArrowRight size={13} weight="bold" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
