import { getSeoProgrammes, isProgrammeIndexable } from "@/lib/du-pyp-seo";
import { NotesPrompt } from "./notes-prompt";

/** For PYQ hub pages that aren't about one course: the student picks their course in the form. */
export async function NotesPromptAnyCourse() {
  const programmes = await getSeoProgrammes().catch(() => []);
  const courses = programmes
    .filter(isProgrammeIndexable)
    .map((p) => ({ slug: p.slug, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return <NotesPrompt source="pyq-page" courses={courses} />;
}
