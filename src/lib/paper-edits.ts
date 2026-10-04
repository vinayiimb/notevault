import type { CatalogPaper } from "@/lib/pyq-catalog-types";

// Per-paper edits from Admin → Papers archive (CatalogPaperOverride rows),
// layered on the static catalog files by both /papers pages and the admin.
export type PaperEdit = {
  paperId: string;
  pdfUrl: string | null;
  hidden: boolean;
  // Set = full snapshot of the paper (every field below); null = an older
  // row that only replaces pdfUrl / hides.
  course: string | null;
  subject: string | null;
  semester: string | null;
  yearRange: string | null;
  upc: string | null;
  paperType: string | null;
  verified: boolean | null;
  added: boolean;
};

export type EditedPaper = CatalogPaper & {
  hidden?: boolean;
  edited?: boolean;
  added?: boolean;
  originalUrl?: string;
};

export function paperNote(upc: string | null | undefined, paperType: string | null | undefined) {
  return [upc ? `UPC ${upc}` : "", paperType ?? ""].filter(Boolean).join(" | ") || null;
}

function snapshot(e: PaperEdit) {
  return {
    course: e.course ?? "",
    subject: e.subject || "Untitled paper",
    semester: e.semester || null,
    semesterGroup: e.semester ? `Semester ${e.semester}` : "Semester not specified",
    yearRange: e.yearRange || "Year not known",
    upc: e.upc || null,
    paperType: e.paperType || null,
    verified: Boolean(e.verified),
    note: paperNote(e.upc, e.paperType),
    ...(e.pdfUrl ? { pdfUrl: e.pdfUrl } : {}),
  };
}

/**
 * Papers as students should see them. `dataset` (true = /papers, false =
 * /papers/noncore) drops papers edited onto the other page and pulls in
 * papers edited or added onto this one; leave it out to get both (admin).
 * `keepHidden` keeps hidden papers, flagged, for the admin.
 */
export function applyPaperEdits(
  raw: CatalogPaper[],
  edits: PaperEdit[],
  { dataset, keepHidden = false }: { dataset?: boolean; keepHidden?: boolean } = {},
): EditedPaper[] {
  const byId = new Map(edits.map((e) => [e.paperId, e]));
  const inDataset = (p: CatalogPaper) => dataset === undefined || Boolean(p.verified) === dataset;
  const out: EditedPaper[] = [];
  const seen = new Set<string>();

  for (const p of raw) {
    seen.add(p.id);
    const e = byId.get(p.id);
    if (!e) {
      if (inDataset(p)) out.push(p);
      continue;
    }
    if (e.hidden && !keepHidden) continue;
    const paper: EditedPaper = e.course
      ? { ...p, ...snapshot(e) }
      : { ...p, ...(e.pdfUrl ? { pdfUrl: e.pdfUrl } : {}) };
    if (!inDataset(paper)) continue;
    out.push({ ...paper, hidden: e.hidden, edited: true, originalUrl: p.pdfUrl });
  }

  // Added papers, and papers moved here from a course / page whose file
  // isn't loaded (callers filter by course afterwards).
  for (const e of edits) {
    if (seen.has(e.paperId) || !e.course || (e.hidden && !keepHidden)) continue;
    if (!e.added && dataset === undefined) continue; // admin loads every file, so this paper is gone
    const paper: EditedPaper = {
      id: e.paperId,
      pdfUrl: e.pdfUrl ?? "",
      source: "drive",
      ...snapshot(e),
      hidden: e.hidden,
      edited: true,
      added: e.added,
      originalUrl: e.pdfUrl ?? "",
    };
    if (inDataset(paper)) out.push(paper);
  }
  return out;
}
