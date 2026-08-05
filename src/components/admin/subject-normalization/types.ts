export type NormalizationStats = {
  totalRawSubjects: number;
  suggestedGroups: number;
  alreadyNormalized: number;
  unreviewedSuggestions: number;
  lowConfidenceSuggestions: number;
  recentlyMerged: number;
};

export type SuggestionMember = {
  id: string;
  name: string;
  upc?: string | null;
  paperType?: string | null;
  _count: { resources: number; questions: number };
};

export type SuggestionRow = {
  id: string;
  termId: string;
  suggestedName: string;
  subjectIds: string[];
  confidenceScore: number;
  explanation: string;
  relationship: "EXACT_DUPLICATE" | "SPELLING_VARIATION" | "ABBREVIATION" | "RENAMED_SYLLABUS" | "RELATED_BUT_SEPARATE";
  safeToMerge: boolean;
  warnings: string[];
  source: "IMPORT" | "ADMIN" | "AI";
  status: "PENDING" | "APPROVED" | "REJECTED" | "IGNORED" | "MERGED";
  createdAt: string;
  term: { id: string; name: string; program: { id: string; name: string } };
  members: SuggestionMember[];
};

export type ProgramWithTerms = {
  id: string;
  name: string;
  terms: { id: string; name: string; order: number }[];
};

export type MergeLogRow = {
  id: string;
  previousCanonicalSubjectId: string;
  newCanonicalSubjectId: string;
  affectedResourceIds: string[];
  affectedQuestionIds: string[];
  administrator: string;
  confidenceScore: number | null;
  reason: string | null;
  isAiAssisted: boolean;
  createdAt: string;
  undoneAt: string | null;
  undoneBy: string | null;
};

export type MergePreview = {
  canonicalSubjectId: string;
  canonicalName: string;
  memberSubjectIds: string[];
  affectedResourceCount: number;
  affectedQuestionCount: number;
  urlsAffected: string[];
  aliasesToCreate: { rawName: string; normalizedName: string }[];
  slugConflict: boolean;
};
