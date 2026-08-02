"use client";

import { useState } from "react";
import { ArrowsMerge } from "@phosphor-icons/react/dist/ssr";
import { mergeDriveSubjectsAction } from "@/lib/actions";

type Side = { id: string; name: string; fileCount: number };

export function MergeDriveSubjects({ a, b }: { a: Side; b: Side }) {
  const [merging, setMerging] = useState(false);

  // Keep whichever side already has more files — it's the one other years'
  // syncs already converged on, so it's the safer side to keep growing.
  const keep = a.fileCount >= b.fileCount ? a : b;
  const drop = keep === a ? b : a;

  async function merge() {
    setMerging(true);
    try {
      const formData = new FormData();
      formData.set("fromId", drop.id);
      formData.set("intoId", keep.id);
      await mergeDriveSubjectsAction(formData);
      window.location.reload();
    } finally {
      setMerging(false);
    }
  }

  return (
    <button
      type="button"
      disabled={merging}
      onClick={merge}
      title={`Merge "${drop.name}" into "${keep.name}"`}
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
    >
      <ArrowsMerge size={13} weight="bold" />
      {merging ? "Merging…" : `Merge into "${keep.name}"`}
    </button>
  );
}
