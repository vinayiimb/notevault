import { getSeoProgrammes, isProgrammeIndexable, isSubjectIndexable } from "@/lib/du-pyp-seo";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

/** Full machine-readable index for AI crawlers: every programme → every subject page. */
export async function GET() {
  const progs = (await getSeoProgrammes()).filter(isProgrammeIndexable).sort((a, b) => a.name.localeCompare(b.name));
  const lines = [
    "# DU PYQ Online — full index",
    "",
    `> Free archive of Delhi University (DU) previous year question papers. Every link below is a crawlable HTML page listing papers by exam year with paper code (UPC) and paper type (DSC/DSE/GE/AEC/SEC/VAC). Each paper links to its original PDF; no login.`,
    "",
    "## UGCF paper-type hubs",
    ...[
      ["skill-enhancement-courses", "Skill Enhancement Courses (SEC)"],
      ["value-addition-courses", "Value Addition Courses (VAC)"],
      ["ability-enhancement-courses", "Ability Enhancement Courses (AEC)"],
      ["generic-electives", "Generic Electives (GE)"],
    ].map(([path, name]) => `- [${name}](${SITE_URL}/${path})`),
    "",
  ];
  for (const p of progs) {
    const subjects = p.subjects.filter(isSubjectIndexable).sort((a, b) => a.name.localeCompare(b.name));
    lines.push(`## ${p.name}`, `[${p.name} — all papers](${SITE_URL}/papers/${p.slug}): ${p.totalPapers} papers, ${subjects.length} subjects`);
    for (const s of subjects) {
      const years = s.years.length > 1 ? `${s.years[s.years.length - 1]}–${s.years[0]}` : (s.years[0] ?? "");
      const meta = [s.paperTypes[0], s.paperCodes[0] && `code ${s.paperCodes[0]}`, years, `${s.papers.length} papers`].filter(Boolean);
      lines.push(`- [${s.name}](${SITE_URL}/papers/${p.slug}/${s.slug}): ${meta.join(", ")}`);
    }
    lines.push("");
  }
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
