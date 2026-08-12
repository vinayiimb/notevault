import "server-only";
import canonicalMappingData from "@/data/du-canonical-mapping.json";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

// Build lookup indexes on first load
const mappingIndex = new Map<string, typeof canonicalMappingData.mappings[0][]>();
const canonicalProgrammes = new Set<string>();

function buildMappingIndex() {
  if (mappingIndex.size > 0) return; // Already built

  const mappingsByKey = new Map<string, typeof canonicalMappingData.mappings[0][]>();

  for (const mapping of canonicalMappingData.mappings) {
    // Create multiple lookup keys for flexibility
    // Key 1: normalized raw subject + canonical programme (loose matching)
    const normalizedSubject = (mapping.raw_subject || "").toLowerCase().trim();
    if (normalizedSubject) {
      const key1 = `${normalizedSubject.substring(0, 50)}`;
      const existing = mappingsByKey.get(key1) || [];
      existing.push(mapping);
      mappingsByKey.set(key1, existing);
    }

    // Key 2: by UPC (most reliable)
    if (mapping.upc) {
      const key2 = `upc:${mapping.upc}`;
      const existing = mappingsByKey.get(key2) || [];
      existing.push(mapping);
      mappingsByKey.set(key2, existing);
    }

    // Track canonical programmes
    canonicalProgrammes.add(mapping.canonical_programme);
  }

  // Copy to module-level index
  for (const [key, values] of mappingsByKey) {
    mappingIndex.set(key, values);
  }
}

/**
 * Find the best canonical mapping for a paper based on subject, course, semester, and UPC.
 * Returns the mapping or null if no match found.
 */
export function findCanonicalMapping(paper: CatalogPaper) {
  buildMappingIndex();

  // Try exact UPC match first (most reliable)
  if (paper.upc) {
    const upCMatches = canonicalMappingData.mappings.filter((m) => m.upc === paper.upc);
    if (upCMatches.length > 0) {
      // Prefer matches that also match the raw subject name
      const normalizedRawSubject = (paper.subject || "").toLowerCase().trim();
      const bySubject = upCMatches.find(
        (m) =>
          (m.raw_subject || "").toLowerCase().trim().includes(normalizedRawSubject.substring(0, 40)),
      );
      return bySubject || upCMatches[0];
    }
  }

  // Try matching by normalized subject name (substring match)
  const normalizedSubject = (paper.subject || "").toLowerCase().trim();
  if (normalizedSubject.length > 3) {
    // Find mappings where raw_subject contains significant part of paper.subject
    const matches = canonicalMappingData.mappings.filter((m) => {
      const rawNorm = (m.raw_subject || "").toLowerCase().trim();
      // Check if they have significant overlap
      const minLength = Math.min(normalizedSubject.length, rawNorm.length);
      if (minLength < 5) return false; // Too short to be reliable

      // Check for substring match (either direction)
      if (normalizedSubject.includes(rawNorm.substring(0, 30))) return true;
      if (rawNorm.includes(normalizedSubject.substring(0, 30))) return true;

      return false;
    });

    if (matches.length > 0) {
      // Prefer match from same semester if available
      const sameSemester = matches.find((m) => m.semester === paper.semester);
      return sameSemester || matches[0];
    }
  }

  // No match found
  return null;
}

/**
 * Enrich a paper with canonical mapping information.
 * If no match is found, marks it as UNMATCHED.
 */
export function enrichPaperWithCanonical(paper: CatalogPaper): CatalogPaper {
  const mapping = findCanonicalMapping(paper);

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
export function enrichPapersWithCanonical(papers: CatalogPaper[]): CatalogPaper[] {
  buildMappingIndex(); // Build index once for batch
  return papers.map(enrichPaperWithCanonical);
}

/**
 * Get all canonical programmes in sorted order.
 */
export function getCanonicalProgrammes(): string[] {
  buildMappingIndex();
  return Array.from(canonicalProgrammes).sort();
}

/**
 * Get metadata about the canonical mapping.
 */
export function getCanonicalMappingMetadata() {
  buildMappingIndex();
  return {
    totalMappings: canonicalMappingData.mappings.length,
    programmes: canonicalMappingData.summary.programmes,
    subjects: canonicalMappingData.summary.subjects,
    categories: canonicalMappingData.summary.categories,
    categories_list: canonicalMappingData.summary.categories,
  };
}
