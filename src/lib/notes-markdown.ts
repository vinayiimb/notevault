// Admin-pasted notes tend to mark section headings by bolding a whole line
// ("**I. Foundations of Financial Management**") rather than using real
// markdown headers — that's how they render cleanly wherever they were
// drafted (Docs, ChatGPT, etc). react-markdown would otherwise just show
// these as a bold paragraph, indistinguishable from inline emphasis inside
// a bullet. This promotes only whole-line-bold text to a real heading:
// roman numerals ("I.", "II.") become H2 (major sections), plain numbers
// ("1.", "2.") become H3 (subsections) — inline bold within a sentence or
// bullet is left untouched.
const ROMAN_HEADING = /^\*\*([IVXLCDM]+\.\s.+)\*\*$/;
const NUMBERED_HEADING = /^\*\*(\d+\.\s.+)\*\*$/;

export function preprocessNotesMarkdown(raw: string): string {
  // AI-generated content (and some pasted-from-Word/Docs text) comes back
  // with \r\n or bare \r line endings. Every regex below anchors on `$`,
  // which only matches end-of-string/before \n — a trailing \r left in
  // means "line" text like "## Heading\r" silently fails to match at all.
  // Normalizing once here keeps every downstream consumer (both this
  // function's own heading-promotion and extractNotesHeadings, which runs
  // on this function's output) working on plain \n-terminated lines.
  const normalized = raw.replace(/\r\n?/g, "\n");
  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const roman = trimmed.match(ROMAN_HEADING);
      if (roman) return `## ${roman[1]}`;
      const numbered = trimmed.match(NUMBERED_HEADING);
      if (numbered) return `### ${numbered[1]}`;
      return line;
    })
    .join("\n");
}

export type NotesHeading = { level: 2 | 3; text: string; slug: string };

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Table of contents entries, in document order — the same order
// NotesRenderer's h2/h3 components render in, so slugs line up with the
// anchors it assigns without needing to re-derive them from rendered React
// children.
export function extractNotesHeadings(preprocessedMarkdown: string): NotesHeading[] {
  const headings: NotesHeading[] = [];
  const seen = new Map<string, number>();

  for (const line of preprocessedMarkdown.split("\n")) {
    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = !h2 && line.match(/^###\s+(.+)$/);
    const match = h2 ?? h3;
    if (!match) continue;

    const text = match[1].trim();
    let slug = slugify(text) || "section";
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;

    headings.push({ level: h2 ? 2 : 3, text, slug });
  }

  return headings;
}
