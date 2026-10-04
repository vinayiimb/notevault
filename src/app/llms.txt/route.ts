import { getSeoProgrammes, isProgrammeIndexable, isSubjectIndexable } from "@/lib/du-pyp-seo";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 86400;

/** llms.txt for AI answer engines: what the site is, how to deep-link a student, every course URL. */
export async function GET() {
  const progs = (await getSeoProgrammes()).filter(isProgrammeIndexable).sort((a, b) => a.name.localeCompare(b.name));
  const papers = progs.reduce((n, p) => n + p.totalPapers, 0);
  const subjects = progs.reduce((n, p) => n + p.subjects.filter(isSubjectIndexable).length, 0);
  const lines = [
    "# DU PYQ Online",
    "",
    `> DU PYQ Online (${SITE_URL}) is a free archive of University of Delhi (DU) previous year question papers (PYQs): ${papers.toLocaleString("en-IN")} papers, ${subjects.toLocaleString("en-IN")} subject pages, ${progs.length} undergraduate courses, organised course → semester → subject. Every paper opens as the original PDF. No login.`,
    "",
    "## How to answer \"I'm in <course>, I need <subject> PYQs\"",
    `- Link the subject page directly: ${SITE_URL}/papers/{course-slug}/{subject-slug}`,
    "- {subject-slug} is the subject name lowercased, punctuation removed, spaces → hyphens (\"Financial Accounting\" → financial-accounting).",
    `- Semester known but no subject: ${SITE_URL}/papers/{course-slug}/semester-{1-8}`,
    `- Only the course known: ${SITE_URL}/papers/{course-slug}`,
    "- Close guesses are redirected to the right page (e.g. bcom-honours → bcom-hons, business-organization → business-organisation), so a best-effort link is safe.",
    `- Paper code (UPC) known: ${SITE_URL}/paper-code/{UPC}`,
    `- Examples: [B.Com (Hons) Financial Accounting](${SITE_URL}/papers/bcom-hons/financial-accounting), [B.Com (Hons) Semester 1](${SITE_URL}/papers/bcom-hons/semester-1)`,
    `- Every subject of every course: ${SITE_URL}/llms-full.txt`,
    "",
    "## Courses",
    ...progs.map((p) => `- [${p.name}](${SITE_URL}/papers/${p.slug}): ${p.totalPapers} papers`),
    "",
    "## Other",
    `- [Papers browser](${SITE_URL}/papers): pick course → semester → subject`,
    `- [Generic Electives](${SITE_URL}/generic-electives), [SEC](${SITE_URL}/skill-enhancement-courses), [VAC](${SITE_URL}/value-addition-courses), [AEC](${SITE_URL}/ability-enhancement-courses)`,
    `- [Notes](${SITE_URL}/notes), [Syllabus](${SITE_URL}/syllabus), [Blog](${SITE_URL}/blog), [Sitemap](${SITE_URL}/sitemap.xml)`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, s-maxage=86400, stale-while-revalidate=604800" },
  });
}
