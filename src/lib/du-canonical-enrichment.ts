import "server-only";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

type CanonicalMapping = {
  raw_subject: string;
  upc?: string;
  canonical_programme: string;
  canonical_subject: string;
  category: string;
  semester: string;
  match_method: string;
  status: string;
};

type CanonicalData = {
  mappings: CanonicalMapping[];
  summary: { programmes: number; subjects: number; categories: number; categories_list: string[] };
};

let canonicalMappingData: CanonicalData | null = null;
const canonicalProgrammes = new Set<string>();

import canonicalRaw from "../../public/data/du-canonical-mapping.json";

// Each mapping's raw_subject normalized ONCE. The previous implementation
// re-lowercased/trimmed/substring'd every one of the ~23k mappings for every
// single paper (tens of millions of throwaway strings per archive build),
// which outran the garbage collector and OOM-killed the whole server — one
// visit to /pyq-notes was enough.
type PreparedMapping = { mapping: CanonicalMapping; rawNorm: string; rawPrefix30: string };
let prepared: PreparedMapping[] = [];
const byUpc = new Map<string, PreparedMapping[]>();
let indexBuilt = false;

// The mapping file is static, so a given (subject, semester, upc) always
// resolves to the same mapping — remembered so each distinct subject is
// scanned at most once per process instead of once per paper per request.
const matchMemo = new Map<string, CanonicalMapping | null>();

function buildMappingIndex() {
  if (indexBuilt) return;
  indexBuilt = true;

  if (!canonicalMappingData) {
    try {
      canonicalMappingData = canonicalRaw as unknown as CanonicalData;
    } catch (err) {
      console.warn("Failed to load canonical mapping JSON:", err);
      canonicalMappingData = { mappings: [], summary: { programmes: 0, subjects: 0, categories: 0, categories_list: [] } };
    }
  }

  prepared = canonicalMappingData.mappings.map((mapping) => {
    const rawNorm = (mapping.raw_subject || "").toLowerCase().trim();
    return { mapping, rawNorm, rawPrefix30: rawNorm.substring(0, 30) };
  });

  for (const p of prepared) {
    if (p.mapping.upc) {
      const list = byUpc.get(p.mapping.upc);
      if (list) list.push(p);
      else byUpc.set(p.mapping.upc, [p]);
    }
    canonicalProgrammes.add(p.mapping.canonical_programme);
  }
}

// Same matching rules as before (UPC first, then two-way 30-char substring
// overlap, preferring the same semester) — only the cost changed.
function findCanonicalMappingSync(paper: CatalogPaper): CanonicalMapping | null {
  buildMappingIndex();

  const normalizedSubject = (paper.subject || "").toLowerCase().trim();
  const memoKey = `${paper.upc ?? ""}\u0000${paper.semester ?? ""}\u0000${normalizedSubject}`;
  const memoized = matchMemo.get(memoKey);
  if (memoized !== undefined) return memoized;

  let result: CanonicalMapping | null = null;

  const upcMatches = paper.upc ? byUpc.get(paper.upc) : undefined;
  if (upcMatches && upcMatches.length > 0) {
    const prefix40 = normalizedSubject.substring(0, 40);
    const bySubject = upcMatches.find((p) => p.rawNorm.includes(prefix40));
    result = (bySubject ?? upcMatches[0]).mapping;
  } else if (normalizedSubject.length > 3) {
    const subjectPrefix30 = normalizedSubject.substring(0, 30);
    let firstMatch: CanonicalMapping | null = null;
    let sameSemester: CanonicalMapping | null = null;
    for (const p of prepared) {
      if (Math.min(normalizedSubject.length, p.rawNorm.length) < 5) continue;
      if (normalizedSubject.includes(p.rawPrefix30) || p.rawNorm.includes(subjectPrefix30)) {
        if (!firstMatch) firstMatch = p.mapping;
        if (p.mapping.semester === paper.semester) {
          sameSemester = p.mapping;
          break;
        }
      }
    }
    result = sameSemester ?? firstMatch;
  }

  matchMemo.set(memoKey, result);
  return result;
}

/**
 * Find the best canonical mapping for a paper based on subject, course, semester, and UPC.
 * Returns the mapping or null if no match found.
 */
export async function findCanonicalMapping(paper: CatalogPaper) {
  return findCanonicalMappingSync(paper);
}

/**
 * Enrich a paper with canonical mapping information.
 * If no match is found, marks it as UNMATCHED.
 */
export async function enrichPaperWithCanonical(paper: CatalogPaper): Promise<CatalogPaper> {
  return enrichPaperSync(paper);
}

function enrichPaperSync(paper: CatalogPaper): CatalogPaper {
  const mapping = findCanonicalMappingSync(paper);

  if (!mapping) {
    return {
      ...paper,
      canonicalMappingStatus: "UNMATCHED",
    };
  }

  return {
    ...paper,
    canonicalProgramme: mapping.canonical_programme,
    canonicalSubject: mapping.canonical_subject,
    canonicalCategory: mapping.category,
    canonicalSemester: mapping.semester,
    canonicalUPC: mapping.upc || undefined,
    canonicalMatchMethod: mapping.match_method,
    canonicalMappingStatus: (mapping.status as "MATCHED" | "CODE_MATCHED" | "ALIAS_MATCHED") || "UNMATCHED",
  };
}

/**
 * Enrich multiple papers in batch.
 */
export async function enrichPapersWithCanonical(papers: CatalogPaper[]): Promise<CatalogPaper[]> {
  return papers.map(enrichPaperSync);
}

/**
 * Get all canonical programmes in sorted order.
 */
export async function getCanonicalProgrammes(): Promise<string[]> {
  buildMappingIndex();
  return Array.from(canonicalProgrammes).sort();
}

/**
 * Get metadata about the canonical mapping.
 */
export async function getCanonicalMappingMetadata() {
  buildMappingIndex();
  return {
    totalMappings: canonicalMappingData?.mappings.length || 0,
    programmes: canonicalMappingData?.summary.programmes || 0,
    subjects: canonicalMappingData?.summary.subjects || 0,
    categories: canonicalMappingData?.summary.categories || 0,
    categories_list: canonicalMappingData?.summary.categories_list || [],
  };
}
