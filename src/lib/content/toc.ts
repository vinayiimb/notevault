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

// Bare bullet markers ("•", "◦", "‣", or "-"/"*" used as a plain-text
// bullet rather than markdown syntax) from content pasted out of an AI
// chat or Word/Docs, which the source never wrote as a real markdown list.
const BULLET_LINE = /^[•◦‣]\s+(.+)$/;

// A short, unpunctuated, title-case-ish line immediately followed by a run
// of bullets is almost always an implicit section header ("Core
// Objectives" right before a block of "• ..." lines) — the same shape as
// looksLikeHeadingText, just without the source ever bolding it.
function looksLikeImplicitHeading(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 60) return false;
  if (/[.!?:]$/.test(trimmed)) return false;
  if (BULLET_LINE.test(trimmed)) return false;
  if (trimmed.split(/\s+/).length > 6) return false;
  return true;
}

// Lines that must stay adjacent to their neighbors of the same kind — a
// table's rows, or fence markers — because inserting a blank line between
// them breaks the block (splits one table into several, or ends up inside
// a fence). Headings and list items are NOT included here: a blank line
// after either is always safe (markdown ignores extra blank lines) and is
// often necessary (ending a list before the next prose paragraph).
function breaksIfSeparated(trimmed: string): boolean {
  return trimmed === "" || trimmed.startsWith("|") || /^```/.test(trimmed);
}

// AI-chat and pasted-from-Docs text uses single newlines to separate what
// are structurally distinct paragraphs/headings/bullets — markdown only
// treats a blank line as a block boundary, so without this the whole thing
// collapses into one unbroken paragraph (the actual bug: bullets render as
// literal "•" characters inline, headings never separate from body text).
// This only touches plain prose lines; markdown that already uses real
// block syntax (headings, "- "/"* " lists, tables, code fences, blank-line
// paragraphs) is structurally unaffected — isStructuralLine exempts both
// the current and the previous line from getting a break forced in.
function insertParagraphBreaks(lines: string[]): string[] {
  const out: string[] = [];
  let inCodeFence = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const enteringOrLeavingFence = /^```/.test(trimmed);

    if (!inCodeFence && !enteringOrLeavingFence) {
      const bulletMatch = trimmed.match(BULLET_LINE);
      if (bulletMatch) {
        // Ensure a blank line *before* the first bullet in a run so the
        // preceding line (heading or intro sentence) doesn't get pulled
        // into the same paragraph as the list.
        if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
        out.push(`- ${bulletMatch[1]}`);
        continue;
      }
      if (looksLikeImplicitHeading(trimmed) && lines[i + 1]?.trim().match(BULLET_LINE)) {
        if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
        out.push(`### ${trimmed}`);
        out.push("");
        continue;
      }

      // A non-blank prose line following another non-blank prose line is
      // two separate paragraphs in the source's intent — insert the blank
      // line markdown needs to actually break them apart — unless either
      // line must stay glued to its neighbor (a table row, or a fence
      // marker), in which case forcing a blank line would break it apart.
      const prev = out[out.length - 1];
      if (
        trimmed !== "" &&
        prev !== undefined &&
        prev.trim() !== "" &&
        !breaksIfSeparated(prev.trim()) &&
        !breaksIfSeparated(trimmed)
      ) {
        out.push("");
      }
    }

    out.push(line);
    if (enteringOrLeavingFence) inCodeFence = !inCodeFence;
  }

  return out;
}

export function preprocessNotesMarkdown(raw: string): string {
  // AI-generated content (and some pasted-from-Word/Docs text) comes back
  // with \r\n or bare \r line endings. Every regex below anchors on `$`,
  // which only matches end-of-string/before \n — a trailing \r left in
  // means "line" text like "## Heading\r" silently fails to match at all.
  const normalized = raw.replace(/\r\n?/g, "\n");
  const headingsPass = normalized
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      const roman = trimmed.match(ROMAN_HEADING);
      if (roman && looksLikeHeadingText(roman[1])) return `## ${roman[1]}`;
      const numbered = trimmed.match(NUMBERED_HEADING);
      if (numbered && looksLikeHeadingText(numbered[1])) return `### ${numbered[1]}`;
      return line;
    });

  return insertParagraphBreaks(headingsPass).join("\n");
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
