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
  return raw
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
