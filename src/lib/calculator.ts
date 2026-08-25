// ── Grade table ──
export interface GradeInfo {
  grade: string;
  gradePoint: number;
  label: string;
}

const GRADE_TABLE: { min: number; info: GradeInfo }[] = [
  { min: 90, info: { grade: "O", gradePoint: 10, label: "Outstanding" } },
  { min: 80, info: { grade: "A+", gradePoint: 9, label: "Excellent" } },
  { min: 70, info: { grade: "A", gradePoint: 8, label: "Very Good" } },
  { min: 60, info: { grade: "B+", gradePoint: 7, label: "Good" } },
  { min: 55, info: { grade: "B", gradePoint: 6, label: "Above Average" } },
  { min: 50, info: { grade: "C", gradePoint: 5, label: "Average" } },
  { min: 40, info: { grade: "D", gradePoint: 4, label: "Pass" } },
  { min: 0, info: { grade: "F", gradePoint: 0, label: "Fail" } },
];

export function getGrade(pct: number): GradeInfo {
  for (const row of GRADE_TABLE) {
    if (pct >= row.min) return row.info;
  }
  return GRADE_TABLE[GRADE_TABLE.length - 1].info;
}

export function getNextGradeTarget(pct: number): { grade: string; target: number } | null {
  for (let i = GRADE_TABLE.length - 1; i >= 0; i--) {
    if (GRADE_TABLE[i].min > pct) {
      return { grade: GRADE_TABLE[i].info.grade, target: GRADE_TABLE[i].min };
    }
  }
  return null;
}

export function getAllGradeThresholds() {
  return GRADE_TABLE.map((r) => ({ min: r.min, ...r.info }));
}

// ── Pattern system ──
export interface PatternComponent {
  id: string;
  label: string;
  maxMarks: number;
}

export interface PaperPattern {
  id: string;
  label: string;
  description: string;
  components: PatternComponent[];
}

export const PATTERNS: Record<string, PaperPattern> = {
  "3-1-0": {
    id: "3-1-0",
    label: "3-1-0",
    description: "Theory + Tutorial",
    components: [
      { id: "theory", label: "Theory", maxMarks: 90 },
      { id: "ia", label: "Internal Assessment", maxMarks: 30 },
      { id: "tutorial", label: "Tutorial", maxMarks: 40 },
    ],
  },
  "3-0-1": {
    id: "3-0-1",
    label: "3-0-1",
    description: "Theory + Practical",
    components: [
      { id: "theory", label: "Theory", maxMarks: 90 },
      { id: "ia", label: "Internal Assessment", maxMarks: 30 },
      { id: "practical", label: "Practical", maxMarks: 50 },
    ],
  },
  "4-0-0": {
    id: "4-0-0",
    label: "4-0-0",
    description: "Theory Only (4 credits)",
    components: [
      { id: "theory", label: "Theory", maxMarks: 90 },
      { id: "ia", label: "Internal Assessment", maxMarks: 30 },
    ],
  },
  "2-0-0": {
    id: "2-0-0",
    label: "2-0-0",
    description: "Theory Only (2 credits)",
    components: [
      { id: "theory", label: "Theory", maxMarks: 50 },
      { id: "ia", label: "Internal Assessment", maxMarks: 25 },
    ],
  },
  "1-0-1": {
    id: "1-0-1",
    label: "1-0-1",
    description: "Theory + Practical",
    components: [
      { id: "theory", label: "Theory", maxMarks: 25 },
      { id: "practical", label: "Practical", maxMarks: 50 },
    ],
  },
  "0-0-2": {
    id: "0-0-2",
    label: "0-0-2",
    description: "Practical Only (2 credits)",
    components: [
      { id: "practical", label: "Practical", maxMarks: 50 },
    ],
  },
  "0-0-4": {
    id: "0-0-4",
    label: "0-0-4",
    description: "Practical Only (4 credits)",
    components: [
      { id: "practical", label: "Practical", maxMarks: 100 },
    ],
  },
};

// ── Marks engine ──
export interface ComponentResult {
  id: string;
  label: string;
  obtained: number;
  max: number;
  percentage: number;
  passed: boolean;
  passThreshold: number;
}

export interface CalcResult {
  components: ComponentResult[];
  totalObtained: number;
  totalMax: number;
  percentage: number;
  grade: GradeInfo;
  passed: boolean;
  failedComponents: string[];
}

export function calc(
  patternId: string,
  marks: Record<string, number>
): CalcResult {
  const pattern = PATTERNS[patternId];
  if (!pattern) throw new Error(`Unknown pattern: ${patternId}`);

  const components: ComponentResult[] = pattern.components.map((comp) => {
    const obtained = Math.min(Math.max(marks[comp.id] || 0, 0), comp.maxMarks);
    const pct = (obtained / comp.maxMarks) * 100;
    const passThreshold = Math.ceil(comp.maxMarks * 0.4);
    return {
      id: comp.id,
      label: comp.label,
      obtained,
      max: comp.maxMarks,
      percentage: pct,
      passed: obtained >= passThreshold,
      passThreshold,
    };
  });

  const totalObtained = components.reduce((s, c) => s + c.obtained, 0);
  const totalMax = components.reduce((s, c) => s + c.max, 0);
  const percentage = totalMax > 0 ? (totalObtained / totalMax) * 100 : 0;
  const failedComponents = components.filter((c) => !c.passed).map((c) => c.label);
  const overallPass = percentage >= 40 && failedComponents.length === 0;

  return {
    components,
    totalObtained,
    totalMax,
    percentage,
    grade: getGrade(percentage),
    passed: overallPass,
    failedComponents,
  };
}

// ── CGPA engine ──
export interface SubjectEntry {
  id: string;
  name: string;
  credits: number;
  gradePoint: number;
}

export function computeCGPA(subjects: SubjectEntry[]): {
  cgpa: number;
  totalCredits: number;
  weightedSum: number;
  contributions: { name: string; contribution: number; weight: number }[];
} {
  const totalCredits = subjects.reduce((s, sub) => s + sub.credits, 0);
  const weightedSum = subjects.reduce((s, sub) => s + sub.credits * sub.gradePoint, 0);
  const cgpa = totalCredits > 0 ? weightedSum / totalCredits : 0;
  const contributions = subjects.map((sub) => ({
    name: sub.name,
    contribution: totalCredits > 0 ? (sub.credits * sub.gradePoint) / totalCredits : 0,
    weight: totalCredits > 0 ? (sub.credits / totalCredits) * 100 : 0,
  }));
  return { cgpa, totalCredits, weightedSum, contributions };
}

export function simulateImprovement(
  subjects: SubjectEntry[],
  subjectId: string,
  increase: number
): number {
  const modified = subjects.map((s) =>
    s.id === subjectId ? { ...s, gradePoint: Math.min(s.gradePoint + increase, 10) } : s
  );
  return computeCGPA(modified).cgpa;
}

// ── Reverse extraction engine ──
export function reverseExtract(
  totalMax: number,
  percentage: number,
  iaMarks: number
): { obtained: number; theoryMarks: number } {
  const obtained = (totalMax * percentage) / 100;
  const theoryMarks = obtained - iaMarks;
  return { obtained: Math.round(obtained * 100) / 100, theoryMarks: Math.round(theoryMarks * 100) / 100 };
}
