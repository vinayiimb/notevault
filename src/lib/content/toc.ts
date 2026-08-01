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

// Real section headings are short titles ("I. Foundations of Financial
// Management"). Bolded numbered *body* content — a very common pattern in
// AI-generated notes ("**1. Fixed Costs: costs that don't change with
// output.**") — matches the same whole-line-bold shape but is a full
// sentence/definition, not a title. Without this check that body text gets
// promoted to a heading, vanishes from the flow, and leaks into the "On
// this page" sidebar as if it were a real section — title case only.
function looksLikeHeadingText(text: string): boolean {
  const trimmed = text.trim();
  if (/[.!?]$/.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 12) return false;
  return true;
}

export function preprocessNotesMarkdown(raw: string): string {
  // AI-generated content (and some pasted-from-Word/Docs text) comes back
  // with \r\n or bare \r line endings. Every regex below anchors on `$`,
  // which only matches end-of-string/before \n — a trailing \r left in
  // means "line" text like "## Heading\r" silently fails to match at all.
  const normalized = raw.replace(/\r\n?/g, "\n");
  return normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const roman = trimmed.match(ROMAN_HEADING);
      if (roman && looksLikeHeadingText(roman[1])) return `## ${roman[1]}`;
      const numbered = trimmed.match(NUMBERED_HEADING);
      if (numbered && looksLikeHeadingText(numbered[1])) return `### ${numbered[1]}`;
      return line;
    })
    .join("\n");
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type ContentHeading = { level: 2 | 3; text: string; slug: string };

// A single, canonical slug generator used by BOTH the server-side heading
// extraction below and NotesMarkdown's h2/h3 render overrides. Previously
// this codebase had two independently-duplicated copies of this exact
// algorithm (one in notes-renderer.tsx, one in notes-lab) that had to be
// kept in lockstep by convention alone — importing the same function in
// both places makes them structurally unable to drift apart.
export function createSlugAllocator() {
  const seen = new Map<string, number>();
  return function slugFor(text: string): string {
    let slug = slugify(text) || "section";
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    return slug;
  };
}

// Scans the raw (preprocessed) Markdown — not the rendered tree — for ## /
// ### lines, skipping fenced code blocks, using the exact slug algorithm
// NotesMarkdown's own heading components use, so anchors always agree with
// the TOC built from this list.
export function extractContentHeadings(preprocessedMarkdown: string): ContentHeading[] {
  const headings: ContentHeading[] = [];
  const slugFor = createSlugAllocator();
  let inFence = false;

  for (const line of preprocessedMarkdown.split("\n")) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const h2 = line.match(/^##\s+(.+)$/);
    const h3 = !h2 && line.match(/^###\s+(.+)$/);
    const match = h2 ?? h3;
    if (!match) continue;

    const text = match[1].replace(/[*_`]/g, "").trim();
    headings.push({ level: h2 ? 2 : 3, text, slug: slugFor(text) });
  }

  return headings;
}
