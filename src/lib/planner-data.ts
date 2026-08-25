import { prisma } from "@/lib/prisma";

// Same deterministic year-parsing rule as src/components/subjects/exam-weightage.tsx —
// only real 4-digit years count, no invented figures.
function parseYears(raw: string | null): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((y) => y.trim())
    .filter((y) => /^\d{4}$/.test(y))
    .map(Number);
}

export type TopicFrequency = {
  topic: string;
  years: number[];
  frequency: number; // 0..1, share of the subject's recent papers this topic appeared in
};

export type SubjectInsight = {
  subjectId: string;
  subjectName: string;
  availableYears: number[]; // years with an actual PYQ resource or tagged question
  resourceCount: number;
  questionCount: number;
  // Only ever non-empty for subjects that already have admin-tagged Question.topics —
  // most subjects won't, and that's fine: task generation falls back to subject/paper-year
  // granularity when this is empty rather than fabricating unit/topic data.
  topicFrequency: TopicFrequency[];
};

const RECENT_PAPER_WINDOW = 4;

export async function getPlannerSubjectInsight(subjectId: string): Promise<SubjectInsight> {
  const subject = await prisma.subject.findUniqueOrThrow({
    where: { id: subjectId },
    select: {
      id: true,
      name: true,
      resources: { where: { type: "PYQ" }, select: { year: true } },
      questions: { select: { topics: true, years: true } },
    },
  });

  const resourceYears = subject.resources.map((r) => r.year).filter((y): y is number => y != null);
  const questionYears = subject.questions.flatMap((q) => parseYears(q.years));
  const availableYears = Array.from(new Set([...resourceYears, ...questionYears])).sort((a, b) => b - a);
  const recentYears = availableYears.slice(0, RECENT_PAPER_WINDOW);

  const topicYears = new Map<string, Set<number>>();
  for (const q of subject.questions) {
    if (q.topics.length === 0) continue;
    const years = parseYears(q.years);
    for (const topic of q.topics) {
      const set = topicYears.get(topic) ?? new Set<number>();
      for (const y of years) set.add(y);
      topicYears.set(topic, set);
    }
  }

  const topicFrequency: TopicFrequency[] = Array.from(topicYears.entries())
    .map(([topic, yearsSet]) => {
      const years = Array.from(yearsSet).sort((a, b) => b - a);
      const hitsInRecent = recentYears.length ? years.filter((y) => recentYears.includes(y)).length : 0;
      const frequency = recentYears.length ? hitsInRecent / recentYears.length : 0;
      return { topic, years, frequency };
    })
    .sort((a, b) => b.frequency - a.frequency);

  return {
    subjectId: subject.id,
    subjectName: subject.name,
    availableYears,
    resourceCount: subject.resources.length,
    questionCount: subject.questions.length,
    topicFrequency,
  };
}

// ---- Scoring & task generation (spec §18/§19/§13) ------------------------

export type PlanInput = {
  hoursWeekday: number;
  hoursWeekend: number;
  studyDays: string[]; // day codes: "sun".."sat"
  strategy:
    | "BALANCED"
    | "PYQ_FOCUSED"
    | "SYLLABUS_FIRST"
    | "WEAK_TOPICS_FIRST"
    | "LAST_MINUTE"
    | "SMART_DU";
};

export type PlanSubjectInput = {
  subjectId: string;
  subjectName: string;
  examDate: Date;
  preparationLevel: "NOT_STARTED" | "BASIC" | "AVERAGE" | "STRONG";
  targetLevel: "PASS" | "GOOD_SCORE" | "TOP_SCORE";
};

export type GeneratedTask = {
  subjectId: string;
  topic: string | null;
  type: "LEARN" | "REVISE" | "SOLVE_PYQS" | "PRACTICE" | "ATTEMPT_PAPER" | "MOCK_TEST";
  title: string;
  scheduledDate: Date;
  estimatedMinutes: number;
  priority: number; // 0-100
  resourceUrl: string;
};

const DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
const SESSION_SIZES = [90, 60, 45, 25] as const;
const MAX_HEAVY_TASKS_PER_DAY = 3; // spec §19 — a "heavy" task is >=45min
const MAX_PLANNING_HORIZON_DAYS = 45;

const PREP_WEAKNESS: Record<PlanSubjectInput["preparationLevel"], number> = {
  NOT_STARTED: 1,
  BASIC: 0.66,
  AVERAGE: 0.33,
  STRONG: 0.1,
};

function daysBetween(from: Date, to: Date) {
  const ms = new Date(to.toDateString()).getTime() - new Date(from.toDateString()).getTime();
  return Math.round(ms / 86_400_000);
}

function examPhase(daysUntilExam: number): "far" | "mid" | "near" | "final-week" | "final-day" {
  if (daysUntilExam <= 0) return "final-day";
  if (daysUntilExam <= 7) return "final-week";
  if (daysUntilExam <= 14) return "near";
  if (daysUntilExam <= 30) return "mid";
  return "far";
}

function examProximityScore(daysUntilExam: number) {
  if (daysUntilExam <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - daysUntilExam / 60));
}

function pyqFrequencyScore(insight: SubjectInsight) {
  if (insight.topicFrequency.length > 0) {
    const avg = insight.topicFrequency.reduce((s, t) => s + t.frequency, 0) / insight.topicFrequency.length;
    return avg;
  }
  // No tagged topics — approximate from how many distinct PYQ years are available at all.
  return Math.max(0, Math.min(1, insight.availableYears.length / RECENT_PAPER_WINDOW));
}

function syllabusImportanceScore(insight: SubjectInsight, maxResourceCount: number) {
  if (maxResourceCount <= 0) return 0.5;
  return Math.max(0, Math.min(1, insight.resourceCount / maxResourceCount));
}

const STRATEGY_WEIGHTS: Record<PlanInput["strategy"], { exam: number; pyq: number; weak: number; syllabus: number; revision: number }> = {
  SMART_DU: { exam: 0.3, pyq: 0.25, weak: 0.2, syllabus: 0.15, revision: 0.1 },
  BALANCED: { exam: 0.2, pyq: 0.2, weak: 0.2, syllabus: 0.2, revision: 0.2 },
  PYQ_FOCUSED: { exam: 0.2, pyq: 0.45, weak: 0.15, syllabus: 0.1, revision: 0.1 },
  SYLLABUS_FIRST: { exam: 0.15, pyq: 0.15, weak: 0.15, syllabus: 0.45, revision: 0.1 },
  WEAK_TOPICS_FIRST: { exam: 0.2, pyq: 0.15, weak: 0.45, syllabus: 0.1, revision: 0.1 },
  LAST_MINUTE: { exam: 0.45, pyq: 0.3, weak: 0.15, syllabus: 0.05, revision: 0.05 },
};

function subjectWeight(
  strategy: PlanInput["strategy"],
  daysUntilExam: number,
  insight: SubjectInsight,
  prep: PlanSubjectInput["preparationLevel"],
  maxResourceCount: number
) {
  const w = STRATEGY_WEIGHTS[strategy];
  const exam = examProximityScore(daysUntilExam);
  const pyq = pyqFrequencyScore(insight);
  const weak = PREP_WEAKNESS[prep];
  const syllabus = syllabusImportanceScore(insight, maxResourceCount);
  const revision = 0; // no completion history yet at generation time
  return exam * w.exam + pyq * w.pyq + weak * w.weak + syllabus * w.syllabus + revision * w.revision;
}

function snapSessionMinutes(remainingBudget: number): number | null {
  for (const size of SESSION_SIZES) {
    if (size <= remainingBudget) return size;
  }
  return null;
}

function subjectUrl(subjectId: string) {
  return `/subjects/${subjectId}`;
}

function pickTopic(insight: SubjectInsight, used: Set<string>): TopicFrequency | null {
  return insight.topicFrequency.find((t) => !used.has(t.topic)) ?? null;
}

function taskForPhase(
  phase: ReturnType<typeof examPhase>,
  subject: PlanSubjectInput,
  insight: SubjectInsight,
  slotIndex: number,
  usedTopics: Set<string>
): { type: GeneratedTask["type"]; title: string; resourceUrl: string; topic: string | null } {
  const topTopic = pickTopic(insight, usedTopics);

  if (phase === "final-day") {
    const title = topTopic
      ? `Final revision — ${subject.subjectName}: ${topTopic.topic}`
      : `Final revision — ${subject.subjectName}`;
    return { type: "REVISE", title, resourceUrl: subjectUrl(subject.subjectId), topic: topTopic?.topic ?? null };
  }

  if (phase === "final-week") {
    if (slotIndex % 2 === 0) {
      const title = topTopic ? `Solve ${subject.subjectName} PYQs — ${topTopic.topic}` : `Solve ${subject.subjectName} PYQs`;
      const resourceUrl = topTopic ? `/practice?topic=${encodeURIComponent(topTopic.topic)}` : subjectUrl(subject.subjectId);
      return { type: "SOLVE_PYQS", title, resourceUrl, topic: topTopic?.topic ?? null };
    }
    return { type: "REVISE", title: `Revise ${subject.subjectName}`, resourceUrl: subjectUrl(subject.subjectId), topic: null };
  }

  if (phase === "near") {
    if (slotIndex % 3 === 2) {
      return { type: "REVISE", title: `Revise ${subject.subjectName}`, resourceUrl: subjectUrl(subject.subjectId), topic: null };
    }
    const title = topTopic ? `Solve ${subject.subjectName} PYQs — ${topTopic.topic}` : `Solve ${subject.subjectName} PYQs`;
    const resourceUrl = topTopic ? `/practice?topic=${encodeURIComponent(topTopic.topic)}` : subjectUrl(subject.subjectId);
    return { type: "SOLVE_PYQS", title, resourceUrl, topic: topTopic?.topic ?? null };
  }

  if (phase === "mid") {
    if (slotIndex % 2 === 0) {
      const title = topTopic ? `Study ${subject.subjectName} — ${topTopic.topic}` : `Study ${subject.subjectName}`;
      return { type: "LEARN", title, resourceUrl: subjectUrl(subject.subjectId), topic: topTopic?.topic ?? null };
    }
    const title = topTopic ? `Solve ${subject.subjectName} PYQs — ${topTopic.topic}` : `Solve ${subject.subjectName} PYQs`;
    const resourceUrl = topTopic ? `/practice?topic=${encodeURIComponent(topTopic.topic)}` : subjectUrl(subject.subjectId);
    return { type: "SOLVE_PYQS", title, resourceUrl, topic: topTopic?.topic ?? null };
  }

  // far
  const title = topTopic ? `Study ${subject.subjectName} — ${topTopic.topic}` : `Study ${subject.subjectName}`;
  return { type: "LEARN", title, resourceUrl: subjectUrl(subject.subjectId), topic: topTopic?.topic ?? null };
}

// Deterministic, DB-driven schedule builder — no AI. Walks each study day from
// today up to the plan's horizon (capped, and never past the last exam date),
// splits that day's available minutes across subjects proportional to their
// priority score, and snaps each subject's share into fixed session sizes
// (spec §19), capped at MAX_HEAVY_TASKS_PER_DAY across the whole day.
export function scoreAndGenerateTasks(
  plan: PlanInput,
  subjects: PlanSubjectInput[],
  insights: Map<string, SubjectInsight>,
  today: Date = new Date()
): GeneratedTask[] {
  if (subjects.length === 0) return [];

  const maxResourceCount = Math.max(...subjects.map((s) => insights.get(s.subjectId)?.resourceCount ?? 0), 1);
  const lastExamDate = subjects.reduce((max, s) => (s.examDate > max ? s.examDate : max), subjects[0].examDate);
  const horizonDays = Math.min(MAX_PLANNING_HORIZON_DAYS, Math.max(1, daysBetween(today, lastExamDate) + 1));

  const tasks: GeneratedTask[] = [];
  const usedTopicsBySubject = new Map<string, Set<string>>();

  for (let dayOffset = 0; dayOffset < horizonDays; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dayCode = DAY_CODES[date.getDay()];
    if (!plan.studyDays.includes(dayCode)) continue;

    const isWeekend = dayCode === "sat" || dayCode === "sun";
    let dailyBudget = (isWeekend ? plan.hoursWeekend : plan.hoursWeekday) * 60;
    if (dailyBudget <= 0) continue;

    const activeToday = subjects.filter((s) => daysBetween(date, s.examDate) >= 0);
    if (activeToday.length === 0) continue;

    const weights = activeToday.map((s) => {
      const insight = insights.get(s.subjectId)!;
      const daysUntilExam = daysBetween(date, s.examDate);
      return {
        subject: s,
        insight,
        daysUntilExam,
        phase: examPhase(daysUntilExam),
        weight: subjectWeight(plan.strategy, daysUntilExam, insight, s.preparationLevel, maxResourceCount),
      };
    });
    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0) || 1;

    // Highest-priority subject first so it claims a full session before minutes run out.
    weights.sort((a, b) => b.weight - a.weight);

    let heavyTasksToday = 0;
    for (const w of weights) {
      if (dailyBudget < 25) break;
      const subjectShare = Math.round(dailyBudget * (w.weight / totalWeight));
      let remainingForSubject = Math.min(subjectShare, dailyBudget);
      let slotIndex = 0;
      const usedTopics = usedTopicsBySubject.get(w.subject.subjectId) ?? new Set<string>();

      while (remainingForSubject >= 25 && dailyBudget >= 25) {
        const size = snapSessionMinutes(Math.min(remainingForSubject, dailyBudget));
        if (size === null) break;
        if (size >= 45 && heavyTasksToday >= MAX_HEAVY_TASKS_PER_DAY) break;

        const built = taskForPhase(w.phase, w.subject, w.insight, slotIndex, usedTopics);
        if (built.topic) usedTopics.add(built.topic);

        tasks.push({
          subjectId: w.subject.subjectId,
          topic: built.topic,
          type: built.type,
          title: built.title,
          scheduledDate: date,
          estimatedMinutes: size,
          priority: Math.round(w.weight * 100),
          resourceUrl: built.resourceUrl,
        });

        remainingForSubject -= size;
        dailyBudget -= size;
        if (size >= 45) heavyTasksToday++;
        slotIndex++;
      }

      usedTopicsBySubject.set(w.subject.subjectId, usedTopics);
    }
  }

  return tasks;
}

// §23 "What should I study now?" — same scoring, just the single top task
// among everything still TODO for today or overdue.
export function pickStudyNowTask(tasks: GeneratedTask[], today: Date = new Date()): GeneratedTask | null {
  const startOfToday = new Date(today.toDateString());
  const eligible = tasks.filter((t) => new Date(t.scheduledDate.toDateString()) <= startOfToday);
  if (eligible.length === 0) return null;
  return eligible.reduce((best, t) => (t.priority > best.priority ? t : best), eligible[0]);
}

// ---- Reads used by the /planner server component --------------------------

export async function getActivePlanForStudent(studentId: string) {
  return prisma.studyPlan.findFirst({
    where: { studentId, status: "ACTIVE" },
    include: {
      subjects: { include: { subject: { select: { id: true, name: true, slug: true } } } },
      tasks: { orderBy: { scheduledDate: "asc" }, include: { subject: { select: { id: true, name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}
