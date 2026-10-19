// Mock tests for /jameco/mock, built from the same solved papers as the analyser.
// Client-safe. Attempts live in the browser (localStorage), so no login or DB.

import { checkAnswer, type JamQuestion, type JamType } from "@/lib/jam-economics";

export type MockKind = "full" | "section" | "topic";

export type MockTest = {
  id: string;
  kind: MockKind;
  title: string;
  year?: string;
  unit?: string;
  topic?: string;
  questionIds: string[];
  marks: number;
  minutes: number;
};

/** JAM EN sections: A = MCQ, B = MSQ, C = NAT. */
export const SECTIONS: { id: string; type: JamType; label: string }[] = [
  { id: "a", type: "MCQ", label: "Section A · MCQ" },
  { id: "b", type: "MSQ", label: "Section B · MSQ" },
  { id: "c", type: "NAT", label: "Section C · NAT" },
];

const TYPE_ORDER: Record<JamType, number> = { MCQ: 0, MSQ: 1, NAT: 2 };

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function buildMockTests(questions: JamQuestion[]): MockTest[] {
  const make = (id: string, kind: MockKind, title: string, qs: JamQuestion[], extra: Partial<MockTest>): MockTest => {
    const marks = qs.reduce((n, q) => n + q.marks, 0);
    // JAM gives 180 minutes for 100 marks; shorter tests get the same 1.8 min per mark.
    return { id, kind, title, questionIds: qs.map((q) => q.id), marks, minutes: Math.round(marks * 1.8), ...extra };
  };
  const years = [...new Set(questions.map((q) => q.year))].sort().reverse();
  const tests = years.flatMap((year) => {
    const paper = questions.filter((q) => q.year === year).sort((a, b) => a.number - b.number);
    return [
      make(`full-${year}`, "full", `JAM ${year} · Full length`, paper, { year }),
      ...SECTIONS.map((s) => make(`${year}-section-${s.id}`, "section", `JAM ${year} · ${s.label}`, paper.filter((q) => q.type === s.type), { year })),
    ];
  });
  const topics = new Map(questions.map((q) => [q.topic, q.unit]));
  for (const [topic, unit] of topics) {
    const qs = questions
      .filter((q) => q.topic === topic)
      .sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || b.year.localeCompare(a.year) || a.number - b.number);
    tests.push(make(`topic-${slugify(topic)}`, "topic", topic, qs, { unit, topic }));
  }
  return tests;
}

export type MockResponse = { picked: string[]; nat: string };
export type MockResult = "correct" | "wrong" | "skipped" | "bonus";

export const hasAnswer = (q: Pick<JamQuestion, "type">, r?: MockResponse) =>
  !!r && (q.type === "NAT" ? r.nat.trim() !== "" : r.picked.length > 0);

/** JAM marking: a wrong MCQ loses ⅓ of its marks, MSQ/NAT have no negatives, "marks to all" scores for everyone. */
export function markQuestion(q: Pick<JamQuestion, "type" | "key" | "marks">, r?: MockResponse): { result: MockResult; marks: number } {
  if (q.key === "all") return { result: "bonus", marks: q.marks };
  if (!r || !hasAnswer(q, r)) return { result: "skipped", marks: 0 };
  return checkAnswer(q, q.type === "NAT" ? r.nat : r.picked)
    ? { result: "correct", marks: q.marks }
    : { result: "wrong", marks: q.type === "MCQ" ? -q.marks / 3 : 0 };
}

export function scoreMock(questions: JamQuestion[], responses: Record<string, MockResponse | undefined>) {
  const s = { score: 0, max: 0, correct: 0, wrong: 0, skipped: 0 };
  for (const q of questions) {
    const m = markQuestion(q, responses[q.id]);
    s.score += m.marks;
    s.max += q.marks;
    if (m.result === "wrong") s.wrong++;
    else if (m.result === "skipped") s.skipped++;
    else s.correct++;
  }
  s.score = Math.round(s.score * 100) / 100;
  return s;
}

export type MockAttempt = {
  id: string;
  testId: string;
  kind: MockKind;
  title: string;
  at: number;
  usedSec: number;
  score: number;
  max: number;
  correct: number;
  wrong: number;
  skipped: number;
  responses: Record<string, MockResponse & { time: number }>;
};

const ATTEMPTS_KEY = "jam-mock:attempts:v1";

export function readAttempts(): MockAttempt[] {
  try {
    return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Insert or replace by id (topic tests re-save after every answer). */
export function saveAttempt(a: MockAttempt) {
  try {
    // ponytail: newest 100 attempts kept in this browser; move to the DB if logged-in history is wanted.
    localStorage.setItem(ATTEMPTS_KEY, JSON.stringify([a, ...readAttempts().filter((x) => x.id !== a.id)].slice(0, 100)));
  } catch {}
}
