import { slugify } from "@/lib/utils";

export type NotesCatalogProgramme = {
  slug: string;
  name: string;
  subjects: { slug: string; name: string; semester: number | null }[];
};

type NoteRow = { programmeSlug: string; subjectSlug: string; subject: string; semester: number | null };
type SyllabusProgramme = { name: string; subjects: string[] };

// Pure so it can be tested: turns published CanonicalSubjectNote rows into the programme -> subjects list
// the checkout and the admin "add access" picker offer.
// Syllabus programmes only count when the subject is in canonical-programmes.json. The General Notes
// programme has no syllabus file (its subjects are whatever the admin typed), so it takes the name
// from the note row itself — before this, custom General notes never showed up and could not be granted or sold.
export function buildNotesCatalog(notes: NoteRow[], programmes: SyllabusProgramme[], general: { slug: string; name: string }): NotesCatalogProgramme[] {
  const bySlug = new Map(programmes.map((p) => [slugify(p.name), p]));
  const result = new Map<string, NotesCatalogProgramme>();
  for (const n of notes) {
    let programmeName: string | undefined;
    let subjectName: string | undefined;
    if (n.programmeSlug === general.slug) {
      programmeName = general.name;
      subjectName = n.subject;
    } else {
      const programme = bySlug.get(n.programmeSlug);
      programmeName = programme?.name;
      subjectName = programme?.subjects.find((s) => slugify(s) === n.subjectSlug);
    }
    if (!programmeName || !subjectName) continue;
    const entry = result.get(n.programmeSlug) ?? { slug: n.programmeSlug, name: programmeName, subjects: [] };
    entry.subjects.push({ slug: n.subjectSlug, name: subjectName, semester: n.semester });
    result.set(n.programmeSlug, entry);
  }
  return [...result.values()]
    .map((p) => ({ ...p, subjects: p.subjects.sort((a, b) => (a.semester ?? 99) - (b.semester ?? 99) || a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
