"use server";

import Groq from "groq-sdk";
import { z } from "zod";
import {
  StructuredNoteSchema,
  CalloutTypeSchema,
  type StructuredNote,
  type NoteSection,
  type Visual,
} from "@/lib/note-schema";

// Switched to Groq (the user doesn't have an Anthropic key yet, but does
// have a Groq one). Groq's chat completions API supports the same kind of
// strict JSON-schema structured output Anthropic's SDK gave us, generated
// here from the Zod schema via Zod v4's native z.toJSONSchema() — so every
// function below is unchanged; only this transport layer differs.
//
// Strict schema adherence (response_format: json_schema, strict: true) is
// only supported on openai/gpt-oss-20b and openai/gpt-oss-120b as of Groq's
// current docs (console.groq.com/docs/structured-outputs) — other models
// (e.g. llama-3.3-70b-versatile) reject the request outright. Using the
// 120b model for quality; override with GROQ_MODEL if desired.
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
// Kept deliberately small: the free/on-demand Groq tier caps a single
// request (prompt + this completion budget, combined) at 8000 tokens total —
// go over and the request is rejected outright, not just throttled.
const MAX_TOKENS = 2000;

export type AiResult<T> = { ok: true; data: T } | { ok: false; error: string };

function getClient(): Groq | null {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

/**
 * Reflows one bounded OCR fragment into exam-ready Markdown. This is kept
 * separate from the small structured-output helpers above because a paper
 * fragment may legitimately be several thousand tokens long.
 */
export async function reformatOcrChunk(
  source: string,
  context: { paperTitle: string; chunkNumber: number; chunkCount: number },
): Promise<AiResult<string>> {
  const client = getClient();
  if (!client) return { ok: false, error: "GROQ_API_KEY is not configured in production." };

  const system = `You are an expert editor preparing Delhi University previous-year question papers for students.
You receive OCR text from an original paper. Rebuild its presentation as clean Markdown, but preserve the paper itself.
Never summarize, answer, merge, reorder, or omit content. Preserve every question, sub-question, option, mark value, equation, symbol, instruction, and metadata line.
Repair only obvious OCR spacing/capitalization errors when the intended text is unambiguous. If a word, formula, or symbol is uncertain, keep the source wording rather than guessing.
Use this structure when the source supports it: a short metadata block, ## Question N headings, ### (a)/(b)/(c) subheadings, bullet lists for explicitly listed items, blockquotes for instructions, and --- at printed page transitions.
Return Markdown only: no preface, no commentary, no code fence, and no answers.`;
  const user = `Paper: ${context.paperTitle}
Fragment ${context.chunkNumber} of ${context.chunkCount}. The fragment can begin or end in the middle of a question; preserve its exact order and do not invent a missing boundary.

SOURCE OCR FRAGMENT
-------------------
${source}
-------------------

Return the fully preserved, better-structured Markdown for this fragment.`;

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4000,
      temperature: 0.1,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    const finishReason = response.choices[0]?.finish_reason;
    if (!content) return { ok: false, error: "The OCR editor returned an empty fragment." };
    if (finishReason && finishReason !== "stop") {
      return { ok: false, error: `The OCR editor stopped early (${finishReason}).` };
    }
    if (content.length < Math.max(160, Math.floor(source.length * 0.24))) {
      return { ok: false, error: "The OCR editor returned too little text; the source was not changed." };
    }
    return { ok: true, data: content };
  } catch (err) {
    if (err instanceof Groq.RateLimitError) return { ok: false, error: "AI is rate-limited right now." };
    if (err instanceof Groq.APIConnectionError) return { ok: false, error: "Could not reach the OCR editor." };
    if (err instanceof Groq.APIError) return { ok: false, error: `OCR editor failed: ${err.message}` };
    return { ok: false, error: "OCR editor failed unexpectedly." };
  }
}

async function callStructured<S extends z.ZodType>(
  schema: S,
  system: string,
  userContent: string
): Promise<AiResult<z.infer<S>>> {
  const client = getClient();
  if (!client) {
    return {
      ok: false,
      error: "AI features aren't configured yet. Add GROQ_API_KEY to your .env.local file to enable this.",
    };
  }

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "response",
          schema: z.toJSONSchema(schema, { target: "draft-7" }) as Record<string, unknown>,
          strict: true,
        },
      },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return { ok: false, error: "The AI response was empty. Try again." };
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch {
      return { ok: false, error: "The AI response could not be parsed. Try again." };
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      return { ok: false, error: "The AI response didn't match the expected format. Try again." };
    }
    return { ok: true, data: parsed.data };
  } catch (err) {
    if (err instanceof Groq.AuthenticationError) {
      return { ok: false, error: "AI request failed: the API key is invalid." };
    }
    if (err instanceof Groq.RateLimitError) {
      return { ok: false, error: "AI is rate-limited right now. Try again shortly." };
    }
    if (err instanceof Groq.APIConnectionError) {
      return { ok: false, error: "Couldn't reach the AI service — check your network connection and try again." };
    }
    if (err instanceof Groq.APIError) {
      if (/tokens per minute|request too large/i.test(err.message)) {
        return {
          ok: false,
          error: "That request is too large for the current plan's limits — try with shorter notes or fewer papers.",
        };
      }
      return { ok: false, error: `AI request failed: ${err.message}` };
    }
    return { ok: false, error: "AI request failed unexpectedly." };
  }
}

function basePrompt(notes: string, subject?: string) {
  return (
    "You are helping a commerce/business student prepare for exams." +
    (subject ? ` Subject: ${subject}.` : "") +
    ` Base everything strictly on these notes:\n\n---\n${notes.slice(0, 6000)}\n---`
  );
}

// ---------- Flashcards ----------

const FlashcardsSchema = z.object({
  cards: z
    .array(
      z.object({
        front: z.string().describe("Short question or term"),
        back: z.string().describe("Concise answer, max 40 words"),
      })
    )
    .length(10),
});
export type Flashcards = z.infer<typeof FlashcardsSchema>;

export async function generateFlashcards(notes: string, subject?: string) {
  return callStructured(
    FlashcardsSchema,
    "You write exam flashcards for a commerce/business student, strictly grounded in the notes given.",
    basePrompt(notes, subject) +
      "\n\nCreate exactly 10 flashcards covering the most exam-important concepts."
  );
}

// ---------- MCQ Quiz ----------

const QuizSchema = z.object({
  questions: z
    .array(
      z.object({
        q: z.string(),
        options: z.array(z.string()).length(4),
        answer: z.number().int().min(0).max(3).describe("0-based index of the correct option"),
        why: z.string().describe("One-line explanation, max 25 words"),
      })
    )
    .length(8),
});
export type Quiz = z.infer<typeof QuizSchema>;

export async function generateQuiz(notes: string, subject?: string) {
  return callStructured(
    QuizSchema,
    "You write university-exam-style multiple-choice questions, strictly grounded in the notes given.",
    basePrompt(notes, subject) +
      "\n\nCreate exactly 8 multiple-choice questions. Each has 4 options with exactly one correct."
  );
}

// ---------- Fill in the blanks ----------

const BlanksSchema = z.object({
  blanks: z
    .array(
      z.object({
        sentence: z.string().describe("Sentence containing ____ where the answer goes"),
        answer: z.string().describe("The missing word or short phrase"),
      })
    )
    .length(6),
});
export type Blanks = z.infer<typeof BlanksSchema>;

export async function generateBlanks(notes: string, subject?: string) {
  return callStructured(
    BlanksSchema,
    "You write fill-in-the-blank recall drills, strictly grounded in the notes given.",
    basePrompt(notes, subject) +
      '\n\nCreate exactly 6 fill-in-the-blank sentences testing key terms. Each sentence contains "____" where the answer goes.'
  );
}

// ---------- Concept Map ----------

const ConceptMapSchema = z.object({
  concepts: z
    .array(z.string())
    .min(5)
    .max(10)
    .describe("5-10 core concepts/terms found in the notes"),
});
export type ConceptMap = z.infer<typeof ConceptMapSchema>;

export async function generateConceptList(notes: string, subject?: string) {
  return callStructured(
    ConceptMapSchema,
    "You identify the core, connectable concepts in a student's theory notes.",
    basePrompt(notes, subject) +
      "\n\nExtract 5 to 10 core concepts or terms from these notes that a student could be asked to relate to one another (e.g. two theories, two institutions, a cause and an effect)."
  );
}

const ConceptGradeSchema = z.object({
  level: z
    .enum(["superficial", "partial", "deep"])
    .describe("How well the student's connection demonstrates understanding"),
  feedback: z.string().describe("1-3 sentences of feedback on the student's answer"),
  modelConnection: z.string().describe("A strong model answer connecting the two concepts, grounded in the notes"),
});
export type ConceptGrade = z.infer<typeof ConceptGradeSchema>;

export async function gradeConceptConnection(
  notes: string,
  conceptA: string,
  conceptB: string,
  studentAnswer: string,
  subject?: string
) {
  return callStructured(
    ConceptGradeSchema,
    "You grade a student's one-sentence explanation of how two concepts relate, strictly against the source notes. Be encouraging but honest; a superficial restatement of both terms without a real relationship is 'superficial', a correct but thin link is 'partial', and an answer that captures mechanism/causation/contrast accurately is 'deep'.",
    basePrompt(notes, subject) +
      `\n\nConcept A: ${conceptA}\nConcept B: ${conceptB}\n\nStudent's explanation of how they relate: "${studentAnswer}"\n\nGrade this connection.`
  );
}

// ---------- Skeleton Answer Practice ----------

const SkeletonQuestionSchema = z.object({
  question: z.string().describe("A classic university long-answer / essay question, worth 10-15 marks"),
});
export type SkeletonQuestion = z.infer<typeof SkeletonQuestionSchema>;

export async function generateSkeletonQuestion(notes: string, subject?: string) {
  return callStructured(
    SkeletonQuestionSchema,
    "You write classic long-answer university exam questions (10-15 marks), strictly grounded in the notes given.",
    basePrompt(notes, subject) + "\n\nGenerate one long-answer essay question based on this material."
  );
}

const SkeletonGradeSchema = z.object({
  structureScore: z
    .enum(["weak", "workable", "strong"])
    .describe("Overall quality of the essay structure the student proposed"),
  missedPerspective: z
    .string()
    .nullable()
    .describe("A major perspective or counter-argument the student's skeleton misses, or null if none"),
  logicFeedback: z.string().describe("1-3 sentences on whether the argument holds together"),
  modelSkeleton: z.object({
    thesis: z.string(),
    headings: z.array(z.string()).length(3),
    citations: z.array(z.string()).length(3).describe("One scholar, case, or article per heading"),
  }),
});
export type SkeletonGrade = z.infer<typeof SkeletonGradeSchema>;

export async function gradeSkeletonAnswer(
  notes: string,
  question: string,
  thesis: string,
  headings: string[],
  citations: string[],
  subject?: string
) {
  return callStructured(
    SkeletonGradeSchema,
    "You are a strict but fair examiner grading the STRUCTURE of a proposed essay answer, not full prose. Critique whether the thesis is defensible, whether the three headings actually support it, and whether the cited scholar/case/article per heading is apt given the notes.",
    basePrompt(notes, subject) +
      `\n\nQuestion: ${question}\n\nStudent's thesis: ${thesis}\nStudent's three headings: ${headings.join(" | ")}\nStudent's citation per heading: ${citations.join(" | ")}\n\nCritique this skeleton and provide a model skeleton.`
  );
}

// ---------- Devil's Advocate ----------

const DevilsAdvocateSchema = z.object({
  counterArgument: z
    .string()
    .describe("A well-reasoned counter-argument to the student's statement, grounded in the notes where possible"),
});
export type DevilsAdvocate = z.infer<typeof DevilsAdvocateSchema>;

export async function generateCounterArgument(notes: string, statement: string, subject?: string) {
  return callStructured(
    DevilsAdvocateSchema,
    "You are a devil's advocate debate partner for a student studying theory. Take the opposite stance to whatever the student asserts and argue it seriously and specifically, using the academic material where it's relevant.",
    basePrompt(notes, subject) + `\n\nThe student's position: "${statement}"\n\nArgue the opposing view.`
  );
}

// ---------- Paper Analysis: compiled notes + most-repeated Qs + prediction ----------

const RepeatedQuestionItemSchema = z.object({
  questionText: z.string(),
  topic: z.string().describe("Short topic/chapter label this question belongs to"),
  yearsAppeared: z
    .array(z.string())
    .describe("Years or paper labels this question (or a close variant) appeared in"),
  repeatCount: z.number().int().min(1),
  marks: z.number().int().nullable(),
});

const PaperAnalysisSchema = z.object({
  compiledNotes: z
    .string()
    .describe(
      "Well-organised markdown study notes covering every topic these papers actually test. Use concise headings, comparison tables where useful, an explicit analysis section, and a fenced chart block (type, title, labels, values) only when the papers contain a real quantitative pattern"
    ),
  mostRepeated: z
    .array(RepeatedQuestionItemSchema)
    .describe(
      "Questions (or near-duplicate variants) that appear across multiple of the given papers, ranked most-repeated first"
    ),
  predictedPaper: z
    .array(
      z.object({
        questionText: z.string(),
        reasoning: z
          .string()
          .describe("Why this question is likely to reappear, citing the pattern observed"),
        marks: z.number().int().nullable(),
      })
    )
    .describe(
      "A predicted set of questions likely to appear in the next exam, based on the repetition pattern across the given papers"
    ),
});
export type PaperAnalysis = z.infer<typeof PaperAnalysisSchema>;

export async function analyzeSubjectPapers(
  subjectName: string,
  papers: { label: string; text: string }[]
) {
  const combined = papers
    .map((p, i) => `\n\n===== PAPER ${i + 1}: ${p.label} =====\n${p.text.slice(0, 1800)}`)
    .join("");

  return callStructured(
    PaperAnalysisSchema,
    "You are an expert exam-pattern analyst for Indian university (Delhi University) previous-year question papers. You read multiple years of the same subject's papers, identify questions (or close variants) that repeat across years, compile the material into organised study notes, and predict which questions are likely to reappear based on the repetition pattern. Be specific and grounded — never invent facts not present in the papers.",
    `Subject: ${subjectName}\n\nHere are ${papers.length} previous year question papers for this subject:${combined}\n\nAnalyze these papers: identify the most repeated questions across years, compile organised markdown study notes covering everything these papers test, and predict a likely paper for the next exam based on the repetition pattern. In compiledNotes, include a clear \"Pattern analysis\" section and use markdown tables for comparisons. When there is a genuine count-by-year, count-by-unit, or repeat-frequency pattern, include one chart using exactly this syntax:\n\n\`\`\`chart\ntype: bar\ntitle: Descriptive title\nlabels: Label 1, Label 2\nvalues: 3, 5\n\`\`\`\n\nNever invent numbers merely to create a chart.`
  );
}

// ---------- Bulk Upload: AI-assisted subject matching ----------

const SubjectMatchAiSchema = z.object({
  matches: z.array(
    z.object({
      title: z.string().describe("Echo back the exact title given for this item"),
      subjectId: z
        .string()
        .nullable()
        .describe("The id of the best-matching subject from the candidate list, or null if none genuinely fit"),
      suggestedNewSubjectName: z
        .string()
        .nullable()
        .describe(
          "Only set when subjectId is null: a clean, properly-capitalised subject name to create for this paper"
        ),
    })
  ),
});
export type SubjectMatchAiResult = z.infer<typeof SubjectMatchAiSchema>;

// Kept intentionally scoped to one course's subject list (not the whole
// catalog) — the free Groq tier's ~8000-token-per-request cap can't fit
// NoteVault's full subject list (600+) alongside the schema and completion
// budget.
export async function matchSubjectsWithAI(
  titles: string[],
  candidates: { id: string; name: string }[]
) {
  const candidateList = candidates.map((c) => `${c.id} :: ${c.name}`).join("\n");
  const titleList = titles.map((t, i) => `${i + 1}. ${t}`).join("\n");

  return callStructured(
    SubjectMatchAiSchema,
    "You match university exam paper filenames/titles to the correct subject from a fixed candidate list. Only pick a subjectId when you're genuinely confident it's the same paper (accounting for abbreviations, typos, or reordered words) — otherwise return null and suggest a clean new subject name instead. Never invent a subjectId that isn't in the candidate list.",
    `Candidate subjects (id :: name):\n${candidateList}\n\nPaper titles to match:\n${titleList}\n\nFor each numbered title, return its exact text, the best-matching subjectId from the candidate list (or null), and if null, a suggestedNewSubjectName.`
  );
}

// ---------- Subject Normalization Centre: Stage B AI grouping ----------
// Stage A (src/lib/subject-grouping.ts) already resolves exact/near-exact
// duplicates deterministically without any AI call. This is only reached
// for the uncertain leftovers — one small candidate cluster per call, never
// the whole catalog, for the same 8000-token-budget reason as above.

const SubjectGroupSuggestionSchema = z.object({
  suggestedCanonicalName: z.string().describe("A clean, properly-capitalised name for the group, or the best existing name among the candidates"),
  memberSubjectIds: z.array(z.string()).describe("IDs from the candidate list that genuinely belong in this one group. Omit any that turned out to be a separate subject."),
  confidenceScore: z.number().int().min(0).max(100),
  explanation: z.string().describe("1-3 sentences on why these belong together (or don't)"),
  relationship: z
    .enum(["EXACT_DUPLICATE", "SPELLING_VARIATION", "ABBREVIATION", "RENAMED_SYLLABUS", "RELATED_BUT_SEPARATE"])
    .describe("RELATED_BUT_SEPARATE means they should NOT be merged"),
  safeToMerge: z.boolean().describe("False if merging risks losing a real distinction (different paper numbers, semesters, or syllabus versions)"),
  warnings: z.array(z.string()).describe("Any semester/paper-number/UPC concerns the admin should double-check before merging. Empty array if none."),
});
export type SubjectGroupSuggestion = z.infer<typeof SubjectGroupSuggestionSchema>;

export type SubjectGroupingCandidate = {
  id: string;
  name: string;
  upc?: string | null;
  paperType?: string | null;
  programName: string;
  termName: string;
};

// Scoped to one uncertain cluster (typically 2-6 subjects) from one
// programme+term — the caller (subject-grouping.ts) never mixes programmes,
// so cross-programme false merges can't happen here regardless of what the
// model returns.
export async function suggestSubjectGrouping(candidates: SubjectGroupingCandidate[]) {
  const list = candidates
    .map(
      (c) =>
        `${c.id} :: "${c.name}" :: UPC=${c.upc ?? "none"} :: type=${c.paperType ?? "unknown"} :: ${c.programName} :: ${c.termName}`
    )
    .join("\n");

  return callStructured(
    SubjectGroupSuggestionSchema,
    "You are a careful Delhi University syllabus librarian. You review a small cluster of subject-name variants that a text-similarity check flagged as *possibly* the same subject, and decide whether they truly are. Treat capitalisation, spacing, hyphenation, typos, and programme/programme-style abbreviations as the same subject. Treat different paper numbers (I vs II, Paper 1 vs Paper 2), different semesters, or genuinely different topics as SEPARATE subjects even if the names look similar — when in doubt, prefer RELATED_BUT_SEPARATE and safeToMerge=false over a wrong merge. Never invent an id that isn't in the candidate list.",
    `Candidate subjects (id :: name :: UPC :: paper type :: programme :: term):\n${list}\n\nDecide whether these belong to one canonical subject. Return the members that truly belong together (a subset is fine — drop any that are actually separate), a clean canonical name, your confidence, the relationship type, whether it's safe to merge, and any warnings.`
  );
}

const RebuttalGradeSchema = z.object({
  verdict: z.enum(["weak", "solid"]).describe("Whether the student's rebuttal successfully answers the counter-argument"),
  flaw: z.string().nullable().describe("The academic flaw in the rebuttal, or null if the rebuttal is solid"),
  feedback: z.string().describe("1-3 sentences of feedback, referencing the notes where relevant"),
});
export type RebuttalGrade = z.infer<typeof RebuttalGradeSchema>;

export async function gradeRebuttal(
  notes: string,
  statement: string,
  counterArgument: string,
  rebuttal: string,
  subject?: string
) {
  return callStructured(
    RebuttalGradeSchema,
    "You judge a short debate round. Score whether the student's rebuttal actually answers the counter-argument using facts from the notes, or whether it dodges, repeats itself, or misses the objection.",
    basePrompt(notes, subject) +
      `\n\nStudent's original position: "${statement}"\nCounter-argument given: "${counterArgument}"\nStudent's rebuttal: "${rebuttal}"\n\nJudge the rebuttal.`
  );
}

// ---------- Structured note generation (JSON-schema notes, see note-schema.ts) ----------
//
// Groq's on-demand tier caps a single request (prompt + completion) at
// ~8000 tokens total, and MAX_TOKENS above is deliberately small — the
// spec's full 12-part note would blow past that in one call for any real
// document. So generation is split into a handful of small, independently
// schema-validated calls that get assembled and re-validated against the
// master StructuredNoteSchema before anything is saved. Every field in the
// schema still gets produced — just across several requests instead of one.

function truncateSource(source: string, maxChars: number) {
  return source.length > maxChars ? source.slice(0, maxChars) : source;
}

function chunkSource(source: string, chunkSize: number, maxChunks: number): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < source.length && chunks.length < maxChunks) {
    chunks.push(source.slice(start, start + chunkSize));
    start += chunkSize;
  }
  return chunks;
}

export type NoteContext = { subjectName: string; chapter?: string };

const NoteOverviewSchema = z.object({
  title: z.string(),
  estimatedReadingMinutes: z.number().int().min(1).max(60),
  tags: z.array(z.string()).max(8),
  summary: z.string().describe("Two to four sentences"),
  keyFacts: z.array(z.string()).min(3).max(7),
  takeaway: z.string().describe("One to two sentences, the single most important thing to remember"),
});

export async function generateNoteOverview(sourceText: string, context: NoteContext) {
  return callStructured(
    NoteOverviewSchema,
    "You write the opening summary of a structured educational note: a clear title, a short summary, key facts, and a final takeaway. Preserve the source's meaning and facts exactly; never invent anything not present in the source.",
    `Subject: ${context.subjectName}${context.chapter ? `\nChapter: ${context.chapter}` : ""}\n\nSOURCE MATERIAL\n-------------------\n${truncateSource(sourceText, 5000)}\n-------------------\n\nWrite the title, 2-4 sentence summary, 3-7 key facts, and a 1-2 sentence final takeaway for this material.`
  );
}

const SectionsChunkSchema = z.object({
  sections: z
    .array(
      z.object({
        id: z.string(),
        heading: z.string(),
        content: z.string(),
        calloutType: CalloutTypeSchema,
        calloutText: z.string().nullable(),
      })
    )
    .min(1)
    .max(3),
});

// One call per ~3500-char chunk of source (capped at 4 chunks — roughly the
// first 14,000 characters) rather than one call for the whole document —
// the actual "split into small calls" step the plan calls for.
export async function generateNoteSections(sourceText: string, context: NoteContext): Promise<AiResult<NoteSection[]>> {
  const chunks = chunkSource(sourceText, 3500, 4);
  const sections: NoteSection[] = [];

  for (let i = 0; i < chunks.length; i += 1) {
    const result = await callStructured(
      SectionsChunkSchema,
      "You write one or more sections of the 'main explanation' part of a structured educational note, strictly grounded in the given source fragment. Use short paragraphs and a clear heading per logical idea. Only attach a callout (definition/important/warning/exam-tip) when the content genuinely warrants one — otherwise set calloutType to 'none' and calloutText to null.",
      `Subject: ${context.subjectName}${context.chapter ? `\nChapter: ${context.chapter}` : ""}\nFragment ${i + 1} of ${chunks.length}.\n\nSOURCE FRAGMENT\n-------------------\n${chunks[i]}\n-------------------\n\nWrite 1-3 sections covering this fragment's content.`
    );
    if (!result.ok) {
      // A later chunk failing shouldn't discard sections already produced
      // from earlier chunks — only fail outright if nothing was produced.
      if (sections.length === 0 && i === chunks.length - 1) return result;
      continue;
    }
    for (const s of result.data.sections) {
      sections.push({
        id: s.id || `section-${sections.length + 1}`,
        heading: s.heading,
        content: s.content,
        callout: s.calloutType === "none" ? null : { type: s.calloutType, text: s.calloutText ?? "" },
      });
    }
  }

  if (sections.length === 0) {
    return { ok: false, error: "Couldn't generate any sections from this source." };
  }
  return { ok: true, data: sections.slice(0, 8) };
}

const NoteSupportingSchema = z.object({
  definitions: z.array(z.object({ term: z.string(), definition: z.string() })).max(12),
  formulas: z.array(z.object({ name: z.string(), expression: z.string(), description: z.string().nullable() })).max(8),
  examples: z.array(z.object({ title: z.string().nullable(), prompt: z.string(), solution: z.string() })).max(6),
  commonMistakes: z.array(z.string()).max(6),
});

export async function generateNoteSupporting(sourceText: string, context: NoteContext) {
  return callStructured(
    NoteSupportingSchema,
    "You extract definitions, formulas, worked examples, and common student mistakes from educational source material. Only include what's genuinely present or directly implied by the source — empty arrays are fine when a category doesn't apply.",
    `Subject: ${context.subjectName}${context.chapter ? `\nChapter: ${context.chapter}` : ""}\n\nSOURCE MATERIAL\n-------------------\n${truncateSource(sourceText, 5000)}\n-------------------\n\nExtract definitions, formulas, worked examples, and common mistakes.`
  );
}

// ---------- Visual selection + generation ----------
// Two small calls rather than one: classify first (so a note never gets a
// forced, meaningless diagram when nothing in the source actually suits
// one), then only generate the heavier nodes/edges/etc. payload for
// whichever type was actually chosen.

const VISUAL_SELECTION_RULES = `Choose the visual type from the content, using these rules:
- Ordered process or procedure -> flowchart
- Related concepts and branches -> mind-map
- Events arranged by time -> timeline
- Similarities and differences -> comparison
- Quantitative information with a real numeric pattern -> chart
- Mathematical problem needing worked steps -> solution-sheet
- Geometry topic -> geometry
- Two or three overlapping categories/sets -> venn
- Hierarchical information -> concept-tree
- Use "none" whenever no visual would genuinely improve understanding — never force one.`;

const VisualClassificationSchema = z.object({
  type: z.enum([
    "none",
    "flowchart",
    "mind-map",
    "timeline",
    "concept-tree",
    "comparison",
    "chart",
    "venn",
    "geometry",
    "solution-sheet",
  ]),
  title: z.string(),
  reasoning: z.string().describe("One sentence: why this type fits (or why none does)"),
});

export async function classifyNoteVisual(sourceText: string, context: NoteContext) {
  return callStructured(
    VisualClassificationSchema,
    `You choose the single best visual format for an educational note, or decide none fits. ${VISUAL_SELECTION_RULES}`,
    `Subject: ${context.subjectName}${context.chapter ? `\nChapter: ${context.chapter}` : ""}\n\nSOURCE MATERIAL\n-------------------\n${truncateSource(sourceText, 4000)}\n-------------------\n\nChoose the visual type and a short title for it.`
  );
}

const GraphDataSchema = z.object({
  nodes: z.array(z.object({ id: z.string(), label: z.string().max(60), group: z.string().nullable(), order: z.string().nullable() })).min(2).max(7),
  edges: z.array(z.object({ from: z.string(), to: z.string(), label: z.string().nullable() })).max(12),
  annotations: z.array(z.string()).max(5),
  highlight: z.string().nullable(),
});
const ComparisonDataSchema = z.object({
  columns: z.array(z.string()).min(2).max(4),
  rows: z.array(z.object({ label: z.string(), cells: z.array(z.string()) })).min(2).max(8),
  annotations: z.array(z.string()).max(5),
});
const ChartDataSchema = z.object({
  chartType: z.enum(["bar", "line"]),
  labels: z.array(z.string()).min(2).max(12),
  values: z.array(z.number()).min(2).max(12),
  annotations: z.array(z.string()).max(5),
});
const VennDataSchema = z.object({
  sets: z.array(z.object({ id: z.string(), label: z.string(), items: z.array(z.string()).max(6) })).min(2).max(3),
  overlapItems: z.array(z.string()).max(6),
  annotations: z.array(z.string()).max(5),
});
const GeometryDataSchema = z.object({
  shapes: z
    .array(
      z.object({
        id: z.string(),
        kind: z.enum(["triangle", "circle", "rectangle", "line", "angle"]),
        labels: z.array(z.string()).max(6),
        measurements: z.array(z.string()).max(6),
      })
    )
    .min(1)
    .max(4),
  annotations: z.array(z.string()).max(5),
});
const SolutionSheetDataSchema = z.object({
  steps: z.array(z.object({ step: z.number().int().min(1), description: z.string(), expression: z.string().nullable() })).min(1).max(10),
  annotations: z.array(z.string()).max(5),
});

/** Generates the payload for one already-chosen visual type. Returns
 * `{ ok: true, data: { type: "none" } }` when visualType is "none" so
 * callers don't need a special case. */
export async function generateNoteVisualData(
  sourceText: string,
  visualType: Visual["type"],
  title: string,
  context: NoteContext
): Promise<AiResult<Visual>> {
  if (visualType === "none") return { ok: true, data: { type: "none" } };

  const excerpt = truncateSource(sourceText, 4000);
  const header = `Subject: ${context.subjectName}${context.chapter ? `\nChapter: ${context.chapter}` : ""}\nVisual title: ${title}\n\nSOURCE MATERIAL\n-------------------\n${excerpt}\n-------------------\n\n`;

  if (visualType === "comparison") {
    const result = await callStructured(ComparisonDataSchema, "You build a comparison table from educational source material, strictly grounded in it.", header + "Build a comparison table (2-4 columns, 2-8 rows).");
    return result.ok ? { ok: true, data: { type: "comparison", title, ...result.data } } : result;
  }
  if (visualType === "chart") {
    const result = await callStructured(
      ChartDataSchema,
      "You extract a real, genuine quantitative pattern from educational source material into chart data. Never invent numbers — only use this when the source actually contains a countable/measurable pattern.",
      header + "Extract the chart data (2-12 labels with matching values)."
    );
    return result.ok ? { ok: true, data: { type: "chart", title, ...result.data } } : result;
  }
  if (visualType === "venn") {
    const result = await callStructured(VennDataSchema, "You build a Venn diagram's set data (2-3 sets, their distinct items, and any shared/overlap items) from educational source material.", header + "Build the Venn diagram data.");
    return result.ok ? { ok: true, data: { type: "venn", title, ...result.data } } : result;
  }
  if (visualType === "geometry") {
    const result = await callStructured(GeometryDataSchema, "You build a labelled geometry diagram's shape data (1-4 shapes with labels and measurements) from educational source material.", header + "Build the geometry diagram data.");
    return result.ok ? { ok: true, data: { type: "geometry", title, ...result.data } } : result;
  }
  if (visualType === "solution-sheet") {
    const result = await callStructured(SolutionSheetDataSchema, "You break a mathematical problem's worked solution into ordered steps, strictly grounded in the source.", header + "Build the worked-solution steps (1-10 steps).");
    return result.ok ? { ok: true, data: { type: "solution-sheet", title, ...result.data } } : result;
  }

  // flowchart | mind-map | timeline | concept-tree all share the same
  // nodes/edges shape — only the system prompt's framing differs.
  const framing: Record<string, string> = {
    flowchart: "an ordered process or procedure as a flowchart (nodes = steps, edges = the order they happen in)",
    "mind-map": "related concepts and their branches as a mind map (edges point from a parent concept to each child concept)",
    timeline: "events arranged by time (each node's `order` field is the date/period label)",
    "concept-tree": "hierarchical information as a tree (edges point from a parent to each child)",
  };
  const result = await callStructured(
    GraphDataSchema,
    `You build ${framing[visualType]} from educational source material, strictly grounded in it. Use 3-7 short-labelled nodes, avoid crossed connectors, and set \`highlight\` to the id of the central/final node.`,
    header + "Build the node/edge data (3-7 nodes)."
  );
  return result.ok ? { ok: true, data: { type: visualType, title, ...result.data } as Visual } : result;
}

/**
 * Orchestrates the full structured-note pipeline: overview, sections,
 * supporting material, and visual, each as its own small Groq call (see
 * the comment above chunkSource) — then assembles and validates everything
 * against StructuredNoteSchema as one object. Never returns a partially
 * generated note: if any required step fails, the whole call fails, so a
 * broken/incomplete note is never saved.
 */
export async function generateStructuredNote(sourceText: string, context: NoteContext): Promise<AiResult<StructuredNote>> {
  const [overview, sections, supporting, classification] = await Promise.all([
    generateNoteOverview(sourceText, context),
    generateNoteSections(sourceText, context),
    generateNoteSupporting(sourceText, context),
    classifyNoteVisual(sourceText, context),
  ]);

  if (!overview.ok) return overview;
  if (!sections.ok) return sections;
  if (!supporting.ok) return supporting;
  if (!classification.ok) return classification;

  const visual = await generateNoteVisualData(sourceText, classification.data.type, classification.data.title, context);
  if (!visual.ok) return visual;

  const assembled = {
    metadata: {
      subject: context.subjectName,
      chapter: context.chapter ?? "",
      title: overview.data.title,
      estimatedReadingMinutes: overview.data.estimatedReadingMinutes,
      tags: overview.data.tags,
    },
    summary: overview.data.summary,
    keyFacts: overview.data.keyFacts,
    sections: sections.data,
    definitions: supporting.data.definitions,
    formulas: supporting.data.formulas,
    examples: supporting.data.examples,
    commonMistakes: supporting.data.commonMistakes,
    visual: visual.data,
    takeaway: overview.data.takeaway,
    sources: [] as string[],
  };

  const parsed = StructuredNoteSchema.safeParse(assembled);
  if (!parsed.success) {
    return { ok: false, error: "The generated note didn't match the expected structure. Try again." };
  }
  return { ok: true, data: parsed.data };
}
