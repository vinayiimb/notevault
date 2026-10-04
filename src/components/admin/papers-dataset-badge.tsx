// Which student page a paper shows on: /papers (matched to the current
// syllabus) or /papers/noncore. Pass counts for a group, or `verified` for
// one paper.
export function PapersDatasetBadge({ matched, noncore }: { matched: number; noncore: number }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {matched > 0 && (
        <span
          title="Shown on /papers (matched to the current syllabus)"
          className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-bold text-emerald-600"
        >
          Matched{noncore > 0 ? ` ${matched}` : ""}
        </span>
      )}
      {noncore > 0 && (
        <span
          title="Shown on /papers/noncore (not in the current syllabus)"
          className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[11px] font-bold text-amber-600"
        >
          Non-core{matched > 0 ? ` ${noncore}` : ""}
        </span>
      )}
    </span>
  );
}

export const DATASET_FILTERS = [
  ["", "All"],
  ["matched", "Matched"],
  ["noncore", "Non-core"],
] as const;

export function matchesDataset(set: string, matched: number, total: number) {
  if (set === "matched") return matched > 0;
  if (set === "noncore") return total - matched > 0;
  return true;
}
