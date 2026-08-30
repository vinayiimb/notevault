/**
 * du-pyp-seo.ts — the SEO page + sitemap data layer for DU Previous Year Papers.
 *
 * Sits on top of `du-pyp-data.ts` (which reads the static
 * `du-question-bank-full-mapped.json` + Ramanujan catalog — no database) and
 * turns those rows into a stable, crawlable URL hierarchy:
 *
 *   /papers/[programmeSlug]                    — Level 1, a DU programme
 *   /papers/[programmeSlug]/[subjectSlug]      — Level 2, a subject within it
 *   /paper-code/[code]                         — Level 3, a UPC / Unique Paper Code
 *   /paper/[slug]                              — Level 4, one genuine question paper
 *
 * Everything here is derived deterministically from real data attributes.
 * No fabricated descriptions, ratings, dates, or claims.
 *
 * Slugs are produced by the shared `slugify()` (lib/utils) so they match the
 * rest of the app and stay stable across builds. Where the raw data yields a
 * slug collision (near-duplicate programme names, case-variant subject names)
 * the colliding nodes are *consolidated* onto one page rather than generating
 * duplicate URLs.
 */
import "server-only";
import { getAllDuPypPapers, type DuPypPaper, type DuExamPaper } from "@/lib/du-pyp-data";
import { slugify } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

export interface SeoSubject {
  slug: string;
  /** Canonical display name (the cleanest raw variant seen for this slug). */
  name: string;
  /** All raw name variants consolidated onto this subject. */
  nameVariants: string[];
  semesters: string[];
  paperTypes: string[];
  /** UPC / Unique Paper Codes attached to this subject (may be several). */
  paperCodes: string[];
  courseNumbers: string[];
  credits: string | null;
  /** Official DU syllabus PDF, if the data has one. */
  syllabusUrl: string | null;
  papers: SeoPaper[];
  /** Distinct exam years, newest first. */
  years: string[];
}

export interface SeoProgramme {
  slug: string;
  /** Canonical display name. */
  name: string;
  nameVariants: string[];
  subjects: SeoSubject[];
  semesters: string[];
  paperTypes: string[];
  totalPapers: number;
  /** Subjects that clear the indexability bar. */
  indexableSubjectCount: number;
}

export interface SeoPaper {
  /** Stable URL slug — see `paperSlug()`. */
  slug: string;
  subjectName: string;
  subjectSlug: string;
  programmeName: string;
  programmeSlug: string;
  semesters: string[];
  paperType: string;
  paperCode: string | null;
  year: string | null;
  session: string | null;
  set: string | null;
  marks: string | null;
  college: string | null;
  /** The genuine question-paper PDF (external, on qb.exam.du.ac.in etc.). */
  fileUrl: string;
  syllabusUrl: string | null;
}

export interface SeoPaperCode {
  code: string;
  subjectNames: string[];
  /** Every (programme, subject) this code appears under. */
  placements: { programmeName: string; programmeSlug: string; subjectName: string; subjectSlug: string }[];
  semesters: string[];
  paperTypes: string[];
  credits: string | null;
  syllabusUrl: string | null;
  papers: SeoPaper[];
  years: string[];
}

/* ------------------------------------------------------------------ */
/* Indexability rules                                                  */
/* ------------------------------------------------------------------ */

/**
 * A subject page is indexable (self-canonical, in the sitemap) only when it
 * carries real, entity-specific content:
 *   - a non-empty slug (rules out names that are entirely non-latin script,
 *     which slugify() reduces to ""),
 *   - a resolvable programme,
 *   - at least one genuine question paper.
 * Subjects that fail this still render (reachable via internal links) but are
 * served `noindex` and kept out of the sitemap until they become useful.
 */
export function isSubjectIndexable(s: SeoSubject): boolean {
  return s.slug.length > 0 && s.papers.length > 0;
}

/**
 * Raw "programme" strings in the source data that are not real DU
 * programmes — scraper bucket labels or ambiguous multi-programme groupings.
 * Their papers still surface under the specific programmes/pools they also
 * belong to; we just don't mint a dedicated programme URL for the bucket.
 */
const NON_PROGRAMME_SLUGS = new Set([
  "another-question-papers",
  "b-com-prog-b-a-prog",
  "misc",
  "miscellaneous",
  "unknown",
  "aec",
  "aecc",
  "sec",
  "vac",
  "ge",
  "generic-elective",
  "generic-elective-ge",
]);

/**
 * Slug shapes that are course-pool / department labels rather than a
 * programme a student is admitted to. Their subjects stay reachable via
 * internal links and the subject pages remain indexable; we just don't
 * mint an indexable programme URL for the label.
 */
const NON_PROGRAMME_PATTERNS = [
  /^department-of-/,
  /-bah-bap/, // "Economics – B.A.(H)/ B.A.(P)/DSC" style buckets
  /-bahbap/,
  /-bah-ge/,
  /-bah-gesec/,
  /-bahgesec/,
  /^generic-elective/,
];

export function isProgrammeIndexable(p: SeoProgramme): boolean {
  return (
    p.slug.length > 0 &&
    !NON_PROGRAMME_SLUGS.has(p.slug) &&
    !NON_PROGRAMME_PATTERNS.some((re) => re.test(p.slug)) &&
    p.indexableSubjectCount >= 3
  );
}

export function isPaperCodeIndexable(c: SeoPaperCode): boolean {
  return /^[0-9]{4,}$/.test(c.code) && c.papers.length > 0;
}

/* ------------------------------------------------------------------ */
/* Slug helpers                                                        */
/* ------------------------------------------------------------------ */

/**
 * Deterministic per-paper slug. Built from real attributes so it is
 * human-readable, and anchored on the stable numeric id in the PDF URL
 * (e.g. .../uploads/questions/1778057936.pdf -> "1778057936") so it never
 * changes for a given paper even if surrounding metadata is cleaned up.
 */
export function paperSlug(p: {
  subjectName: string;
  programmeName: string;
  session: string | null;
  year: string | null;
  paperCode: string | null;
  fileUrl: string;
}): string {
  const stableId = stablePaperId(p.fileUrl);
  const when = [p.session, p.year]
    .filter(Boolean)
    .map((x) => slugify(String(x)))
    .filter(Boolean)
    .join("-");
  return [
    slugify(p.subjectName),
    slugify(p.programmeName),
    when,
    p.paperCode ? slugify(p.paperCode) : "",
    stableId,
  ]
    .filter(Boolean)
    .join("-")
    .replace(/-+/g, "-");
}

/**
 * A stable id for a question-paper PDF, drawn from whatever the source URL
 * carries. Same paper -> same id across builds:
 *   - qb.exam.du.ac.in/uploads/questions/1778057936.pdf  -> "1778057936"
 *   - drive.google.com/file/d/1VQfoTnwE3.../view          -> "1VQfoTnwE3..."
 *   - library.ramanujancollege.ac.in/.../AEC_-_EVS.pdf    -> hash of the URL
 */
function stablePaperId(fileUrl: string): string {
  const drive = fileUrl.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) || fileUrl.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (drive) return drive[1].toLowerCase();
  const numeric = fileUrl.match(/\/([0-9]{6,})\.(?:pdf|PDF)(?:$|\?)/) || fileUrl.match(/\/([0-9]{6,})(?:$|[?/])/);
  if (numeric) return numeric[1];
  return shortHash(fileUrl);
}

function shortHash(input: string): string {
  // Tiny non-crypto hash — only needs to be stable + collision-resistant
  // enough to disambiguate paper URLs that share every other attribute.
  let h = 5381;
  for (let i = 0; i < input.length; i++) h = (h * 33) ^ input.charCodeAt(i);
  return (h >>> 0).toString(36);
}

/**
 * `slugify()` a subject/course name, then collapse an immediately-repeated
 * run of hyphen segments — some source rows carry a name that literally
 * repeats itself ("Intermediate Microeconomics I … Intermediate
 * Microeconomics I …"), which would otherwise double the slug.
 */
function subjectSlugify(name: string): string {
  const s = slugify(name);
  const parts = s.split("-").filter(Boolean);
  const n = parts.length;
  if (n >= 4 && n % 2 === 0) {
    const half = n / 2;
    if (parts.slice(0, half).join("-") === parts.slice(half).join("-")) {
      return parts.slice(0, half).join("-");
    }
  }
  return s;
}

/** Keep only real numeric Unique Paper Codes for display / linking. */
function normalizePaperCodes(codes: Iterable<string>): string[] {
  return [...new Set([...codes].filter((c) => /^[0-9]{4,}$/.test(c.trim())))].sort();
}

/** Pick the cleanest display name among raw variants that share a slug. */
function preferredName(variants: string[]): string {
  return [...variants].sort((a, b) => {
    // Prefer no trailing slash / punctuation, then Title Case-ish, then shorter.
    const trailA = /[/\\\s]$/.test(a) ? 1 : 0;
    const trailB = /[/\\\s]$/.test(b) ? 1 : 0;
    if (trailA !== trailB) return trailA - trailB;
    const upperA = a === a.toUpperCase() ? 1 : 0;
    const upperB = b === b.toUpperCase() ? 1 : 0;
    if (upperA !== upperB) return upperA - upperB;
    return a.length - b.length;
  })[0];
}

function uniqSorted(xs: (string | null | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x && x.trim().length > 0))].sort();
}

const YEAR_DESC = (a: string, b: string) => Number(b) - Number(a);

/* ------------------------------------------------------------------ */
/* Build the SEO graph (module-level cached)                           */
/* ------------------------------------------------------------------ */

interface SeoGraph {
  programmes: SeoProgramme[];
  programmeBySlug: Map<string, SeoProgramme>;
  /** key: `${programmeSlug}//${subjectSlug}` */
  subjectByKey: Map<string, SeoSubject>;
  paperCodeByCode: Map<string, SeoPaperCode>;
  paperBySlug: Map<string, SeoPaper>;
}

let graphCache: SeoGraph | null = null;

function examToSeoPapers(
  subjectName: string,
  subjectSlug: string,
  programmeName: string,
  programmeSlug: string,
  semesters: string[],
  paperType: string,
  paperCode: string | null,
  syllabusUrl: string | null,
  exams: DuExamPaper[],
): SeoPaper[] {
  const out: SeoPaper[] = [];
  for (const e of exams) {
    if (!e.link) continue;
    const base = {
      subjectName,
      subjectSlug,
      programmeName,
      programmeSlug,
      semesters,
      paperType,
      paperCode,
      year: e.year,
      session: e.session,
      set: e.set ?? null,
      marks: e.marks ?? null,
      college: e.college ?? null,
      fileUrl: e.link,
      syllabusUrl,
    };
    out.push({ ...base, slug: paperSlug(base) });
  }
  return out;
}

async function buildGraph(): Promise<SeoGraph> {
  const nodes: DuPypPaper[] = await getAllDuPypPapers();

  // 1. group raw subject-nodes -> consolidated SeoSubject, keyed by
  //    (programmeSlug, subjectSlug).
  const progVariants = new Map<string, Set<string>>(); // slug -> raw programme names
  const subjAcc = new Map<
    string,
    {
      programmeSlug: string;
      subjectSlug: string;
      nameVariants: Set<string>;
      semesters: Set<string>;
      paperTypes: Set<string>;
      paperCodes: Set<string>;
      courseNumbers: Set<string>;
      credits: string | null;
      syllabusUrl: string | null;
      papers: SeoPaper[];
      paperSlugs: Set<string>;
    }
  >();

  for (const n of nodes) {
    const programmeSlug = slugify(n.programme);
    const subjectSlug = subjectSlugify(n.subjectName);
    if (!programmeSlug) continue;

    if (!progVariants.has(programmeSlug)) progVariants.set(programmeSlug, new Set());
    progVariants.get(programmeSlug)!.add(n.programme);

    const key = `${programmeSlug}//${subjectSlug}`;
    let acc = subjAcc.get(key);
    if (!acc) {
      acc = {
        programmeSlug,
        subjectSlug,
        nameVariants: new Set(),
        semesters: new Set(),
        paperTypes: new Set(),
        paperCodes: new Set(),
        courseNumbers: new Set(),
        credits: null,
        syllabusUrl: null,
        papers: [],
        paperSlugs: new Set(),
      };
      subjAcc.set(key, acc);
    }
    acc.nameVariants.add(n.subjectName);
    for (const s of n.semesters) acc.semesters.add(s);
    if (n.paperType) acc.paperTypes.add(n.paperType);
    if (n.upc) acc.paperCodes.add(n.upc);
    if (n.courseNumber) acc.courseNumbers.add(n.courseNumber);
    if (!acc.credits && n.credits) acc.credits = n.credits;
    if (!acc.syllabusUrl && n.officialLink) acc.syllabusUrl = n.officialLink;

    const programmeNameForPapers = n.programme; // canonicalised again below
    const seoPapers = examToSeoPapers(
      n.subjectName,
      subjectSlug,
      programmeNameForPapers,
      programmeSlug,
      n.semesters,
      n.paperType,
      normalizePaperCodes(n.upc ? [n.upc] : [])[0] ?? null,
      n.officialLink ?? null,
      n.examPapers,
    );
    for (const p of seoPapers) {
      if (acc.paperSlugs.has(p.slug)) continue;
      acc.paperSlugs.add(p.slug);
      acc.papers.push(p);
    }
  }

  // 2. canonical programme display names.
  const programmeName = new Map<string, string>();
  for (const [slug, variants] of progVariants) {
    programmeName.set(slug, preferredName([...variants]));
  }

  // 3. finalise subjects, rewriting programme names to canonical.
  const subjectByKey = new Map<string, SeoSubject>();
  const subjectsByProgramme = new Map<string, SeoSubject[]>();
  for (const [key, acc] of subjAcc) {
    const canonProgName = programmeName.get(acc.programmeSlug)!;
    const papers = acc.papers
      .map((p) => ({ ...p, programmeName: canonProgName }))
      .sort((a, b) => YEAR_DESC(a.year ?? "0", b.year ?? "0"));
    const subject: SeoSubject = {
      slug: acc.subjectSlug,
      name: preferredName([...acc.nameVariants]),
      nameVariants: [...acc.nameVariants].sort(),
      semesters: uniqSorted([...acc.semesters]),
      paperTypes: uniqSorted([...acc.paperTypes]),
      paperCodes: normalizePaperCodes(acc.paperCodes),
      courseNumbers: uniqSorted([...acc.courseNumbers]),
      credits: acc.credits,
      syllabusUrl: acc.syllabusUrl,
      papers,
      years: uniqSorted(papers.map((p) => p.year)).sort(YEAR_DESC),
    };
    subjectByKey.set(key, subject);
    if (!subjectsByProgramme.has(acc.programmeSlug)) subjectsByProgramme.set(acc.programmeSlug, []);
    subjectsByProgramme.get(acc.programmeSlug)!.push(subject);
  }

  // 4. programmes.
  const programmes: SeoProgramme[] = [];
  const programmeBySlug = new Map<string, SeoProgramme>();
  for (const [slug, name] of programmeName) {
    const subs = (subjectsByProgramme.get(slug) ?? []).sort((a, b) => a.name.localeCompare(b.name));
    const semesters = uniqSorted(subs.flatMap((s) => s.semesters));
    const paperTypes = uniqSorted(subs.flatMap((s) => s.paperTypes));
    const totalPapers = subs.reduce((n, s) => n + s.papers.length, 0);
    const indexableSubjectCount = subs.filter(isSubjectIndexable).length;
    const prog: SeoProgramme = {
      slug,
      name,
      nameVariants: [...(progVariants.get(slug) ?? [])].sort(),
      subjects: subs,
      semesters,
      paperTypes,
      totalPapers,
      indexableSubjectCount,
    };
    programmes.push(prog);
    programmeBySlug.set(slug, prog);
  }
  programmes.sort((a, b) => a.name.localeCompare(b.name));

  // 5. paper codes (UPC), consolidated across every placement.
  const codeAcc = new Map<
    string,
    {
      subjectNames: Set<string>;
      placements: Map<string, { programmeName: string; programmeSlug: string; subjectName: string; subjectSlug: string }>;
      semesters: Set<string>;
      paperTypes: Set<string>;
      credits: string | null;
      syllabusUrl: string | null;
      papers: SeoPaper[];
      paperSlugs: Set<string>;
    }
  >();
  for (const subject of subjectByKey.values()) {
    for (const code of subject.paperCodes) {
      if (!/^[0-9]{4,}$/.test(code)) continue;
      let acc = codeAcc.get(code);
      if (!acc) {
        acc = {
          subjectNames: new Set(),
          placements: new Map(),
          semesters: new Set(),
          paperTypes: new Set(),
          credits: null,
          syllabusUrl: null,
          papers: [],
          paperSlugs: new Set(),
        };
        codeAcc.set(code, acc);
      }
      acc.subjectNames.add(subject.name);
      for (const s of subject.semesters) acc.semesters.add(s);
      for (const t of subject.paperTypes) acc.paperTypes.add(t);
      if (!acc.credits && subject.credits) acc.credits = subject.credits;
      if (!acc.syllabusUrl && subject.syllabusUrl) acc.syllabusUrl = subject.syllabusUrl;
      const p0 = subject.papers[0];
      if (p0) {
        const pk = `${p0.programmeSlug}//${subject.slug}`;
        acc.placements.set(pk, {
          programmeName: p0.programmeName,
          programmeSlug: p0.programmeSlug,
          subjectName: subject.name,
          subjectSlug: subject.slug,
        });
      }
      for (const p of subject.papers) {
        if (p.paperCode !== code) continue;
        if (acc.paperSlugs.has(p.slug)) continue;
        acc.paperSlugs.add(p.slug);
        acc.papers.push(p);
      }
    }
  }
  const paperCodeByCode = new Map<string, SeoPaperCode>();
  for (const [code, acc] of codeAcc) {
    const papers = acc.papers.sort((a, b) => YEAR_DESC(a.year ?? "0", b.year ?? "0"));
    paperCodeByCode.set(code, {
      code,
      subjectNames: [...acc.subjectNames].sort(),
      placements: [...acc.placements.values()].sort((a, b) => a.programmeName.localeCompare(b.programmeName)),
      semesters: uniqSorted([...acc.semesters]),
      paperTypes: uniqSorted([...acc.paperTypes]),
      credits: acc.credits,
      syllabusUrl: acc.syllabusUrl,
      papers,
      years: uniqSorted(papers.map((p) => p.year)).sort(YEAR_DESC),
    });
  }

  // 6. flat paper lookup.
  const paperBySlug = new Map<string, SeoPaper>();
  for (const subject of subjectByKey.values()) {
    for (const p of subject.papers) {
      if (!paperBySlug.has(p.slug)) paperBySlug.set(p.slug, p);
    }
  }

  return { programmes, programmeBySlug, subjectByKey, paperCodeByCode, paperBySlug };
}

async function graph(): Promise<SeoGraph> {
  if (graphCache) return graphCache;
  graphCache = await buildGraph();
  return graphCache;
}

/* ------------------------------------------------------------------ */
/* Public lookups (used by pages + sitemaps)                           */
/* ------------------------------------------------------------------ */

export async function getSeoProgrammes(): Promise<SeoProgramme[]> {
  return (await graph()).programmes;
}

export async function getSeoProgramme(slug: string): Promise<SeoProgramme | null> {
  return (await graph()).programmeBySlug.get(slug) ?? null;
}

export async function getSeoSubject(
  programmeSlug: string,
  subjectSlug: string,
): Promise<{ programme: SeoProgramme; subject: SeoSubject } | null> {
  const g = await graph();
  const programme = g.programmeBySlug.get(programmeSlug);
  const subject = g.subjectByKey.get(`${programmeSlug}//${subjectSlug}`);
  if (!programme || !subject) return null;
  return { programme, subject };
}

export async function getSeoPaperCode(code: string): Promise<SeoPaperCode | null> {
  return (await graph()).paperCodeByCode.get(code) ?? null;
}

/* ------------------------------------------------------------------ */
/* Programme × semester (Level 1.5) — /papers/[prog]/semester-[n]      */
/* Targets the "du [course] sem [n] pyq" query shape.                  */
/* ------------------------------------------------------------------ */

/** Semester numbers 1–8 map to the Roman-numeral tags used in the data. */
const SEM_NUM_TO_ROMAN: Record<number, string> = {
  1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII",
};

export interface SeoProgrammeSemester {
  programme: SeoProgramme;
  /** 1–8 */
  semester: number;
  roman: string;
  /** Indexable subjects taught in this semester of this programme. */
  subjects: SeoSubject[];
  paperTypes: string[];
  totalPapers: number;
  years: string[];
  /** Mean indexable-subject count across this programme's semesters 1–6. */
  programmeAvgSemesterSize: number;
}

/**
 * A programme-semester page is indexable when:
 *   - its parent programme is indexable,
 *   - it has >= 3 indexable subjects and >= 5 real papers, AND
 *   - it isn't a data-noise straggler: its subject count is at least ~30% of
 *     the programme's typical semester size. This is what separates a real
 *     4-year-programme Semester 7/8 (a dozen subjects, like sems 1–6) from a
 *     handful of mislabelled rows leaking a plausible-but-fake page.
 */
export function isProgrammeSemesterIndexable(s: SeoProgrammeSemester): boolean {
  if (!isProgrammeIndexable(s.programme)) return false;
  if (s.subjects.length < 3 || s.totalPapers < 5) return false;
  const floor = Math.max(3, s.programmeAvgSemesterSize * 0.3);
  return s.subjects.length >= floor;
}

export async function getSeoProgrammeSemester(
  programmeSlug: string,
  semester: number,
): Promise<SeoProgrammeSemester | null> {
  const roman = SEM_NUM_TO_ROMAN[semester];
  if (!roman) return null;
  const programme = (await graph()).programmeBySlug.get(programmeSlug);
  if (!programme) return null;

  const subjectsInRoman = (r: string) =>
    programme.subjects.filter((s) => isSubjectIndexable(s) && s.semesters.includes(r));

  const subjects = subjectsInRoman(roman).sort((a, b) => a.name.localeCompare(b.name));

  // Baseline = mean indexable-subject count over sems I–VI (the part every
  // DU UG programme has).
  const baseCounts = ["I", "II", "III", "IV", "V", "VI"].map((r) => subjectsInRoman(r).length);
  const nonEmpty = baseCounts.filter((n) => n > 0);
  const programmeAvgSemesterSize =
    nonEmpty.length > 0 ? nonEmpty.reduce((a, b) => a + b, 0) / nonEmpty.length : subjects.length;

  const paperTypes = uniqSorted(subjects.flatMap((s) => s.paperTypes));
  const totalPapers = subjects.reduce((n, s) => n + s.papers.length, 0);
  const years = uniqSorted(subjects.flatMap((s) => s.years)).sort(YEAR_DESC);

  return { programme, semester, roman, subjects, paperTypes, totalPapers, years, programmeAvgSemesterSize };
}

/** Which semester numbers this programme actually has indexable content for. */
export async function getProgrammeSemesterNumbers(programmeSlug: string): Promise<number[]> {
  const programme = (await graph()).programmeBySlug.get(programmeSlug);
  if (!programme) return [];
  const romans = new Set(
    programme.subjects.filter(isSubjectIndexable).flatMap((s) => s.semesters),
  );
  return Object.entries(SEM_NUM_TO_ROMAN)
    .filter(([, roman]) => romans.has(roman))
    .map(([n]) => Number(n))
    .sort((a, b) => a - b);
}

export async function getSeoPaper(slug: string): Promise<SeoPaper | null> {
  return (await graph()).paperBySlug.get(slug) ?? null;
}

/** Related subjects within the same programme (same semester first). */
export async function getRelatedSubjects(
  programmeSlug: string,
  subjectSlug: string,
  limit = 6,
): Promise<SeoSubject[]> {
  const g = await graph();
  const programme = g.programmeBySlug.get(programmeSlug);
  if (!programme) return [];
  const self = g.subjectByKey.get(`${programmeSlug}//${subjectSlug}`);
  const selfSems = new Set(self?.semesters ?? []);
  const candidates = programme.subjects.filter(
    (s) => s.slug !== subjectSlug && isSubjectIndexable(s),
  );
  candidates.sort((a, b) => {
    const aShare = a.semesters.some((s) => selfSems.has(s)) ? 0 : 1;
    const bShare = b.semesters.some((s) => selfSems.has(s)) ? 0 : 1;
    if (aShare !== bShare) return aShare - bShare;
    return b.papers.length - a.papers.length;
  });
  return candidates.slice(0, limit);
}

/** Programmes that share subject names with this one — "related programmes". */
export async function getRelatedProgrammes(slug: string, limit = 6): Promise<SeoProgramme[]> {
  const g = await graph();
  const self = g.programmeBySlug.get(slug);
  if (!self) return [];
  const selfSubjects = new Set(self.subjects.map((s) => s.slug));
  const scored = g.programmes
    .filter((p) => p.slug !== slug && isProgrammeIndexable(p))
    .map((p) => ({
      p,
      overlap: p.subjects.reduce((n, s) => n + (selfSubjects.has(s.slug) ? 1 : 0), 0),
    }))
    .filter((x) => x.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap);
  return scored.slice(0, limit).map((x) => x.p);
}

/* ------------------------------------------------------------------ */
/* Sitemap feeds                                                       */
/* ------------------------------------------------------------------ */

export interface SitemapUrl {
  path: string;
  lastModified?: Date;
}

/**
 * The data has no per-row timestamps, so `lastModified` is intentionally
 * omitted for JSON-derived URLs rather than faked with `new Date()`. The
 * sitemap file falls back to the data file's own mtime for these.
 */
export async function getIndexableProgrammeUrls(): Promise<SitemapUrl[]> {
  const progs = await getSeoProgrammes();
  return progs.filter(isProgrammeIndexable).map((p) => ({ path: `/papers/${p.slug}` }));
}

export async function getIndexableSubjectUrls(): Promise<SitemapUrl[]> {
  const progs = await getSeoProgrammes();
  const urls: SitemapUrl[] = [];
  for (const p of progs) {
    if (!isProgrammeIndexable(p)) continue;
    for (const s of p.subjects) {
      if (isSubjectIndexable(s)) urls.push({ path: `/papers/${p.slug}/${s.slug}` });
    }
  }
  return urls;
}

export async function getIndexablePaperCodeUrls(): Promise<SitemapUrl[]> {
  const g = await graph();
  const urls: SitemapUrl[] = [];
  for (const c of g.paperCodeByCode.values()) {
    if (isPaperCodeIndexable(c)) urls.push({ path: `/paper-code/${c.code}` });
  }
  return urls;
}

export async function getIndexableProgrammeSemesterUrls(): Promise<SitemapUrl[]> {
  const progs = await getSeoProgrammes();
  const urls: SitemapUrl[] = [];
  for (const p of progs) {
    if (!isProgrammeIndexable(p)) continue;
    for (const n of await getProgrammeSemesterNumbers(p.slug)) {
      const ps = await getSeoProgrammeSemester(p.slug, n);
      if (ps && isProgrammeSemesterIndexable(ps)) {
        urls.push({ path: `/papers/${p.slug}/semester-${n}` });
      }
    }
  }
  return urls;
}

/**
 * A paper page is indexable iff the subject it belongs to is — i.e. it sits
 * under a real programme with a non-empty subject slug. That keeps the paper
 * layer consistent with the subject layer (no indexable leaf under a
 * noindex branch).
 */
export function isPaperIndexable(g: SeoGraph, p: SeoPaper): boolean {
  const programme = g.programmeBySlug.get(p.programmeSlug);
  const subject = g.subjectByKey.get(`${p.programmeSlug}//${p.subjectSlug}`);
  return !!programme && !!subject && isProgrammeIndexable(programme) && isSubjectIndexable(subject);
}

export async function getIndexablePaperUrls(): Promise<SitemapUrl[]> {
  const g = await graph();
  const urls: SitemapUrl[] = [];
  for (const p of g.paperBySlug.values()) {
    if (isPaperIndexable(g, p)) urls.push({ path: `/paper/${p.slug}` });
  }
  return urls;
}

/** Is this paper slug eligible for indexing? (page-level noindex decision) */
export async function isPaperSlugIndexable(slug: string): Promise<boolean> {
  const g = await graph();
  const p = g.paperBySlug.get(slug);
  return !!p && isPaperIndexable(g, p);
}

/** One-shot stats for the audit / validation report. */
export async function getSeoCoverageStats() {
  const g = await graph();
  const programmes = g.programmes;
  const indexableProgrammes = programmes.filter(isProgrammeIndexable);
  const allSubjects = [...g.subjectByKey.values()];
  const indexableSubjects = allSubjects.filter(isSubjectIndexable);
  const skippedEmptySlug = allSubjects.filter((s) => s.slug.length === 0).length;
  const skippedNoPapers = allSubjects.filter((s) => s.slug.length > 0 && s.papers.length === 0).length;
  const paperCodes = [...g.paperCodeByCode.values()];
  const subjectsInIndexableProgrammes = indexableProgrammes.flatMap((p) =>
    p.subjects.filter(isSubjectIndexable),
  ).length;
  const indexablePapers = [...g.paperBySlug.values()].filter((p) => isPaperIndexable(g, p)).length;
  const programmeSemesterUrls = await getIndexableProgrammeSemesterUrls();
  return {
    programmes: {
      total: programmes.length,
      indexable: indexableProgrammes.length,
    },
    programmeSemesters: {
      inSitemap: programmeSemesterUrls.length,
    },
    subjects: {
      total: allSubjects.length,
      indexable: indexableSubjects.length,
      inSitemap: subjectsInIndexableProgrammes,
      skippedEmptySlug,
      skippedNoPapers,
    },
    paperCodes: {
      total: paperCodes.length,
      indexable: paperCodes.filter(isPaperCodeIndexable).length,
    },
    papers: {
      total: g.paperBySlug.size,
      inSitemap: indexablePapers,
    },
    sitemapTotal:
      indexableProgrammes.length +
      programmeSemesterUrls.length +
      subjectsInIndexableProgrammes +
      paperCodes.filter(isPaperCodeIndexable).length +
      indexablePapers,
  };
}
