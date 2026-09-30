// Illustrative B.Com semesters 1–2 (not a real student's grades), shaped
// exactly like the AI's reply to MARKSHEET_PROMPT. Company Law is a
// deliberate anomaly and HRM a deliberate tutorial gap, to show both checks.
const paper = (
  upc: string, title: string, type: string, semester: number, credits: number,
  gradeL: string | null, gradeT: string | null, gradeP: string | null, finalGrade: string, gradePoint: number,
) => ({ upc, title, type, semester, credits, gradeL, gradeT, gradeP, finalGrade, gradePoint, creditPoints: credits * gradePoint, status: null });

export const SAMPLE_MARKSHEET = JSON.stringify(
  {
    programme: "Bachelor of Commerce",
    examSession: "Sample",
    papers: [
      paper("2035001004", "ENGLISH LANGUAGE THROUGH LITERATURE-I", "GEL", 1, 4, "A", "A+", null, "A", 8),
      paper("2051001002", "HINDI AUPCHARIK LEKHAN - B", "AEC", 1, 2, "B+", null, null, "B+", 7),
      paper("2412091101", "BUSINESS ORGANISATION AND MANAGEMENT", "DSC", 1, 4, "B+", "A", null, "B+", 7),
      paper("2412091102", "BUSINESS LAWS", "DSC", 1, 4, "A+", "A", null, "A+", 9),
      paper("2412091103", "FINANCIAL ACCOUNTING", "DSC", 1, 4, "B+", null, "A+", "A", 8),
      paper("6136000002", "SUSTAINABLE ECOTOURISM AND ENTREPRENEURSHIP", "SEC", 1, 2, null, null, "A+", "A+", 9),
      paper("6967000008", "FINANCIAL LITERACY", "VAC", 1, 2, "A", null, "O", "A+", 9),
      paper("2055091002", "HINDI BHASHA AUR SAHITYA", "GEL", 2, 4, "B+", "B+", null, "B+", 7),
      paper("2181001001", "ENVIRONMENTAL SCIENCE: THEORY INTO PRACTICE - I", "AEC", 2, 2, "A", null, "A", "A", 8),
      paper("2412091201", "CORPORATE ACCOUNTING", "DSC", 2, 4, "A", "A+", null, "A", 8),
      paper("2412091202", "COMPANY LAW", "DSC", 2, 4, "B", "B", null, "C", 5),
      paper("2412091203", "HUMAN RESOURCE MANAGEMENT", "DSC", 2, 4, "A+", "C", null, "A", 8),
      paper("3126000001", "IT SKILLS AND DATA ANALYSIS - I", "SEC", 2, 2, null, null, "O", "O", 10),
      paper("6967000006", "ETHICS AND CULTURE", "VAC", 2, 2, "A+", null, "A+", "A+", 9),
    ],
    semesters: [
      { semester: 1, totalCredits: 22, totalCreditPoints: 178, sgpa: 8.09, cgpa: null, result: null },
      { semester: 2, totalCredits: 22, totalCreditPoints: 166, sgpa: 7.55, cgpa: 7.82, result: "PASSED" },
    ],
  },
  null,
  2,
);
