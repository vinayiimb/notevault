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

export type RelationCounts = {
  resources: number;
  questions: number;
  driveSubjects: number;
  examDates: number;
  noteThemes: number;
  matchMemories: number;
  subjectNotes: number;
  subjectAnalysis: number;
  childSubjects: number;
};

export type ManualMergeSubjectRow = {
  id: string;
  name: string;
  slug: string;
  upc: string | null;
  mergedIntoId: string | null;
  term: { id: string; name: string; program: { id: string; name: string } };
  _count: { questions: number; subjectAliases: number };
  pyqCount: number;
  notesCount: number;
};

export type MergePreview = {
  canonicalSubjectId: string;
  canonicalName: string;
  memberSubjectIds: string[];
  before: RelationCounts;
  totalLinkedRecordsBefore: number;
  totalLinkedRecordsAfterExpected: number;
  expectedDataLoss: number;
  urlsAffected: string[];
  aliasesToCreate: { rawName: string; normalizedName: string }[];
  slugConflict: boolean;
  conflicts: string[];
  blocked: boolean;
};
