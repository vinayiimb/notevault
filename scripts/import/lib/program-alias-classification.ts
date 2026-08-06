// Shared classification data for Phase 2E — hand-reviewed 2026-08-06 against
// the 118 real Program slugs derived from src/lib/content/master-syllabus-data.ts.
// See docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md for methodology.
//
// Consumed by:
//   scripts/import/tools/classify-rejections.ts (per-row rejection report)
//   scripts/import/tools/build-alias-mappings.ts (data/import-mappings/program-aliases.json)
export type ProgramAliasCategory =
  | "programme-name variation"
  | "missing programme"
  | "invalid source data"
  | "malformed row";

export type ProgramSlugClassification = {
  category: ProgramAliasCategory;
  targetProgramSlug: string | null;
  rationale: string;
  confidence: number; // 0-1
  autoSafe: boolean; // safe to propose as a pending alias for human approval
  manualReviewRequired: boolean; // needs investigation before even proposing
};

export const PROGRAM_ALIAS_CLASSIFICATION: Record<string, ProgramSlugClassification> = {
  // --- programme-name variation: single, high-confidence target ---
  "bcom-h": { category: "programme-name variation", targetProgramSlug: "bcom-hons", rationale: "\"B.Com. (H)\" is the standard DU abbreviation for B.Com. (Hons.).", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "bcom-programme": { category: "programme-name variation", targetProgramSlug: "bcom-p", rationale: "\"B.Com. (Programme)\" matches the catalogue's \"bcom-p\" entry (Programme abbreviated to P).", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "ba-h-economics": { category: "programme-name variation", targetProgramSlug: "ba-hons-economics", rationale: "\"B.A. (H) Economics\" = B.A. (Hons.) Economics.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "ba-h-political-science": { category: "programme-name variation", targetProgramSlug: "ba-hons-political-science", rationale: "\"B.A. (H) Political Science\" = B.A. (Hons.) Political Science.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "ba-h-sociology": { category: "programme-name variation", targetProgramSlug: "ba-hons-socialogy", rationale: "\"B.A. (H) Sociology\" = B.A. (Hons.) Sociology. Target program name carries a pre-existing catalogue typo (\"Socialogy\") — the alias intentionally points at the typo'd slug, not a corrected one, so it resolves to the real row.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "ba-h-hindi": { category: "programme-name variation", targetProgramSlug: "ba-hons-hindi", rationale: "\"B.A. (H) Hindi\" = B.A. (Hons.) Hindi (distinct from the longer \"...Hindi Patrakarita Evam Jansanchar\" programme, which is a different, unambiguous target).", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "ba-h-sanskrit": { category: "programme-name variation", targetProgramSlug: "ba-hons-sanskrit", rationale: "\"B.A. (H) Sanskrit\" = B.A. (Hons.) Sanskrit.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "ba-h-skt": { category: "programme-name variation", targetProgramSlug: "ba-hons-sanskrit", rationale: "\"SKT\" is a common DU abbreviation for Sanskrit; same target as ba-h-sanskrit.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "bsc-h-botany": { category: "programme-name variation", targetProgramSlug: "bsc-hons-botany", rationale: "\"B.Sc. (H) Botany\" = B.Sc. (Hons.) Botany.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "bsc-h-chemistry": { category: "programme-name variation", targetProgramSlug: "bsc-hons-chemistry", rationale: "\"B.Sc. (H) Chemistry\" = B.Sc. (Hons.) Chemistry.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "bsc-h-mathematics": { category: "programme-name variation", targetProgramSlug: "bsc-hons-mathematics", rationale: "\"B.Sc. (H) Mathematics\" = B.Sc. (Hons.) Mathematics.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "bsc-h-physics": { category: "programme-name variation", targetProgramSlug: "bsc-hons-physics", rationale: "\"B.Sc. (H) Physics\" = B.Sc. (Hons.) Physics.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "bsc-h-zoology": { category: "programme-name variation", targetProgramSlug: "bsc-hons-zoology", rationale: "\"B.Sc. (H) Zoology\" = B.Sc. (Hons.) Zoology.", confidence: 0.9, autoSafe: true, manualReviewRequired: false },
  "all-sec": { category: "programme-name variation", targetProgramSlug: "university-wide-skill-enhancement-course-pool", rationale: "\"ALL SEC\" is DU's Skill Enhancement Course pool.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "all-vac": { category: "programme-name variation", targetProgramSlug: "university-wide-value-addition-course-pool", rationale: "\"ALL VAC\" is DU's Value Addition Course pool.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "all-vac-value-added-courses": { category: "programme-name variation", targetProgramSlug: "university-wide-value-addition-course-pool", rationale: "Same pool as all-vac, spelled out in full.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "all-aec": { category: "programme-name variation", targetProgramSlug: "university-wide-ability-enhancement-course-pool", rationale: "\"ALL AEC\" is DU's Ability Enhancement Course pool.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "all-aecc": { category: "programme-name variation", targetProgramSlug: "university-wide-ability-enhancement-course-pool", rationale: "\"ALL AECC\" (older AEC-Compulsory naming) maps to the same ability-enhancement pool.", confidence: 0.85, autoSafe: true, manualReviewRequired: false },
  "all-aecaecc": { category: "programme-name variation", targetProgramSlug: "university-wide-ability-enhancement-course-pool", rationale: "\"ALL AEC/AECC\" combines both spellings for the same pool.", confidence: 0.75, autoSafe: true, manualReviewRequired: false },

  // --- programme-name variation but with an unresolved ambiguity: propose, but hold for review ---
  "ba-h-english": { category: "programme-name variation", targetProgramSlug: "ba-hons-english", rationale: "\"B.A. (H) English\" plausibly targets \"ba-hons-english\", but the catalogue also has a near-duplicate \"b-a-hons-english\" Program (different slug from a spacing variant of the same course name) — a genuine duplicate-Program data-quality issue upstream, not something this alias should paper over automatically.", confidence: 0.55, autoSafe: false, manualReviewRequired: true },
  "ba-h-history": { category: "programme-name variation", targetProgramSlug: "history-honours", rationale: "\"B.A. (H) History\" plausibly targets \"history-honours\", but that Program's slug breaks the \"ba-hons-*\" naming convention every other Honours programme follows — worth confirming it's the same programme and not a differently-scoped catalogue entry before approving.", confidence: 0.7, autoSafe: false, manualReviewRequired: true },

  // --- missing programme: no matching Program exists, and none should be auto-created ---
  "ba-programme": { category: "missing programme", targetProgramSlug: null, rationale: "\"B.A. (Programme)\" has no single catalogue counterpart — the real catalogue models BA Programme per-major (ba-prog-economics-as-major, ba-prog-history-as-major, ...), not as one generic Program. Needs a manual decision: create an umbrella Program, or split this session's rows by major (not possible from the source data as given).", confidence: 0.2, autoSafe: false, manualReviewRequired: true },
  "all-ge": { category: "missing programme", targetProgramSlug: null, rationale: "Generic Elective (GE) papers aren't modeled as their own Program in the catalogue — GE credit is drawn from individual honours departments. No deterministic target exists.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "all-dse": { category: "missing programme", targetProgramSlug: null, rationale: "Discipline Specific Elective (DSE) papers belong to individual departments, not a generic pool. No deterministic target exists.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "all-common-group-programme": { category: "missing programme", targetProgramSlug: null, rationale: "\"ALL COMMON GROUP PROGRAMME\" is a bundled concept (likely Programme-students' shared AEC/SEC/VAC papers) with no single existing Program row.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "all-common-prog-group": { category: "missing programme", targetProgramSlug: null, rationale: "Same bundled concept as all-common-group-programme, different source spelling.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "all-common-prog-group-aec": { category: "missing programme", targetProgramSlug: null, rationale: "AEC-specific variant of the same bundled \"common programme group\" concept — no existing Program row.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },

  // --- invalid source data: the `course` field itself spans 2+ real programmes ---
  "bsc-life-sciencesphy-sc": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc. Life Sciences+PHY SC.\" conflates two programme families (Life Sciences and Physical Sciences) into one source folder name — cannot be split deterministically without the original per-paper programme metadata.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "bsc-prog-life-sciencesphy-sc": { category: "invalid source data", targetProgramSlug: null, rationale: "Same bundling problem as bsc-life-sciencesphy-sc, Programme (not Hons) variant.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "bscprog-physical-sciencelife-science": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc.Prog. Physical science+Life Science\" conflates two programme families in one folder name.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "bscprog-physical-scienceba": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc.Prog. Physical science/B.A.\" conflates B.Sc. Programme and B.A. — two different programme families.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
  "babsc-prog": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.A/B.Sc. Prog\" explicitly conflates two programme families with a slash in the source folder name.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
  "bsc-hprog": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc. (H)+Prog.\" conflates Honours and Programme, two structurally different programme types, in one folder name.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
  "bscprog-physical-science": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc.Prog. Physical science\" is a bundle folder; the real catalogue only has narrower slices (...-computer-science, ...-electronics, ...-mathematical-sciences) with no generic bucket to fall back to.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "bsc-phy-sc": { category: "invalid source data", targetProgramSlug: null, rationale: "Same bundle-folder problem as bscprog-physical-science, abbreviated spelling.", confidence: 0.15, autoSafe: false, manualReviewRequired: true },
  "ba-h-all-subjects": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.A. (H) ALL SUBJECTS\" is a bundle spanning every BA Honours department at once — not resolvable to one Program.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
  "bsc-h-all-subjects": { category: "invalid source data", targetProgramSlug: null, rationale: "\"B.Sc. (H) ALL SUBJECTS\" is a bundle spanning every BSc Honours department at once — not resolvable to one Program.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },

  // --- malformed row: the `course` field contains folder/note text, not a programme name ---
  "question-papers-mix-research-methodology": { category: "malformed row", targetProgramSlug: null, rationale: "\"Question papers mix+ Research Methodology\" is a Google Drive folder label, not a programme name — leaked into the course field at the source-data layer (see prisma/seed-historical-exam-sessions.ts).", confidence: 0.05, autoSafe: false, manualReviewRequired: true },
  "question-papers-mixall-dates-folder": { category: "malformed row", targetProgramSlug: null, rationale: "\"Question papers mix(All dates folder)\" is a Google Drive folder label, not a programme name.", confidence: 0.05, autoSafe: false, manualReviewRequired: true },
  "ba-h-hindi-note-all-in-one-file": { category: "malformed row", targetProgramSlug: null, rationale: "\"B.A. (H) Hindi (Note:- all in one file)\" — an admin annotation leaked into the course field; the underlying programme (ba-hons-hindi) is otherwise unambiguous, but the row needs source cleanup, not an alias, since deterministicSlug() over the annotated text will never match.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
  "ba-h-sanskrit-note-all-in-one-file": { category: "malformed row", targetProgramSlug: null, rationale: "Same annotation-leak problem as ba-h-hindi-note-all-in-one-file, for Sanskrit.", confidence: 0.1, autoSafe: false, manualReviewRequired: true },
};
