export type PrepLevel = "NOT_STARTED" | "BASIC" | "AVERAGE" | "STRONG";
export type TargetLevel = "PASS" | "GOOD_SCORE" | "TOP_SCORE";
export type PlanStrategy = "BALANCED" | "PYQ_FOCUSED" | "SYLLABUS_FIRST" | "WEAK_TOPICS_FIRST" | "LAST_MINUTE" | "SMART_DU";
export type TaskType = "LEARN" | "REVISE" | "SOLVE_PYQS" | "PRACTICE" | "ATTEMPT_PAPER" | "MOCK_TEST";
export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "SKIPPED" | "RESCHEDULED";

export interface SerializedPlanSubject {
  subjectId: string;
  subjectName: string;
  examDate: string; // ISO
  examTime: string | null;
  preparationLevel: PrepLevel;
  targetLevel: TargetLevel;
}

export interface SerializedTask {
  id: string;
  subjectId: string;
  subjectName: string;
  topic: string | null;
  type: TaskType;
  title: string;
  scheduledDate: string; // ISO
  estimatedMinutes: number;
  priority: number;
  status: TaskStatus;
  resourceUrl: string;
}

export interface SerializedPlan {
  id: string;
  programId: string;
  termId: string;
  hoursWeekday: number;
  hoursWeekend: number;
  preferredTimes: string[];
  studyDays: string[];
  strategy: PlanStrategy;
  subjects: SerializedPlanSubject[];
  tasks: SerializedTask[];
}

export interface WizardProgram {
  id: string;
  name: string;
  slug: string;
  terms: {
    id: string;
    name: string;
    order: number;
    subjects: { id: string; name: string }[];
  }[];
}
