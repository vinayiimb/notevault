import canonicalMappingData from "@/data/du-canonical-mapping.json";

/**
 * Normalize raw course strings to canonical DU programme names
 * Handles variations in course naming (abbreviations, punctuation, etc.)
 */

// Build a lookup of all programme variations from canonical mapping
const getProgrammeVariations = () => {
  const variations = new Map<string, string>();
  const canonicalProgrammes = new Set<string>();

  for (const mapping of canonicalMappingData.mappings) {
    const canonical = mapping.canonical_programme;
    canonicalProgrammes.add(canonical);

    // Add the canonical name itself as a variation
    variations.set(canonical.toLowerCase().trim(), canonical);

    // Add common variations (remove special chars, abbreviations, etc.)
    const normalized = canonical
      .toLowerCase()
      .replace(/[().,]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    variations.set(normalized, canonical);

    // Add without "programme"/"program"
    const withoutProg = canonical.replace(/\s+programme?$/i, "").toLowerCase().trim();
    variations.set(withoutProg, canonical);
  }

  return { variations, canonicalProgrammes: Array.from(canonicalProgrammes) };
};

const { variations: programmeVariations, canonicalProgrammes } = getProgrammeVariations();

/**
 * Map a raw course string to its canonical DU programme
 * Returns null if no match found
 */
export function normalizeCourseName(rawCourse: string): string | null {
  if (!rawCourse) return null;

  const normalized = rawCourse.toLowerCase().trim();

  // Direct match
  if (programmeVariations.has(normalized)) {
    return programmeVariations.get(normalized) || null;
  }

  // Normalized match (remove special chars)
  const cleanNormalized = normalized
    .replace(/[().,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (programmeVariations.has(cleanNormalized)) {
    return programmeVariations.get(cleanNormalized) || null;
  }

  // Fuzzy substring match - check if raw contains any canonical programme
  for (const [variation, canonical] of programmeVariations) {
    if (normalized.includes(variation) && variation.length > 5) {
      return canonical;
    }
  }

  // Try reverse - check if any canonical programme is contained in the raw string
  for (const prog of canonicalProgrammes) {
    const progNorm = prog.toLowerCase().replace(/[().,]/g, "").replace(/\s+/g, " ");
    if (normalized.includes(progNorm)) {
      return prog;
    }
  }

  return null;
}

/**
 * Get all 118 canonical DU programmes with paper counts
 */
export function getCanonicalProgrammesWithCounts(papers: Array<{ course: string; canonicalProgramme?: string }>): Array<{
  programme: string;
  paperCount: number;
  percentage: number;
}> {
  const counts = new Map<string, number>();

  for (const paper of papers) {
    const canonical = paper.canonicalProgramme || normalizeCourseName(paper.course);
    if (canonical) {
      counts.set(canonical, (counts.get(canonical) || 0) + 1);
    }
  }

  const total = papers.length;
  return Array.from(counts.entries())
    .map(([programme, count]) => ({
      programme,
      paperCount: count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.paperCount - a.paperCount); // Sort by paper count descending
}

/**
 * Get list of all 118 canonical programmes
 */
export function getAllCanonicalProgrammes(): string[] {
  return canonicalProgrammes.sort();
}
