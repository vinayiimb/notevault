"use server";

import Groq from "groq-sdk";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MatchInputSchema = z.object({
  key: z.string().min(1).max(500),
  path: z.string().max(1200),
  previewText: z.string().max(2500),
  programId: z.string().nullable(),
  semesterOrder: z.number().int().min(1).max(6).nullable(),
  subjectName: z.string().max(300),
  academicYear: z.string().max(20),
});

const MatchOutputSchema = z.object({
  matches: z.array(
    z.object({
      key: z.string(),
      programId: z.string().nullable(),
      semesterOrder: z.number().int().min(1).max(6).nullable(),
      subjectId: z.string().nullable(),
      subjectName: z.string(),
      academicYear: z.string(),
      year: z.number().int().min(1900).max(2200).nullable(),
      confidence: z.enum(["high", "medium", "low"]),
      reason: z.string(),
    }),
  ),
});

export type ConsolidatedMetadataInput = z.infer<typeof MatchInputSchema>;
export type ConsolidatedMetadataMatch = z.infer<typeof MatchOutputSchema>["matches"][number];

type CatalogProgram = {
  id: string;
  name: string;
  terms: {
    id: string;
    name: string;
    order: number;
    subjects: { id: string; name: string }[];
  }[];
};

function responseText(payload: unknown): string | null {
  const output = (payload as { output?: unknown[] })?.output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    const content = (item as { content?: unknown[] })?.content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      const typed = part as { type?: string; text?: string };
      if (typed.type === "output_text" && typeof typed.text === "string") return typed.text;
    }
  }
  return null;
}

function buildPrompt(items: ConsolidatedMetadataInput[], catalog: CatalogProgram[]) {
  return `CATALOG (program -> semester -> subject):\n${JSON.stringify(catalog)}\n\nPAPERS:\n${JSON.stringify(items)}\n\nFor each paper, infer metadata from its path, filename, heuristic values, and extracted PDF preview. Use preview text as stronger evidence than a vague filename. Return the same key. Pick only IDs that exist in CATALOG. Subject must belong to the returned program and semester. Preserve an academic year range such as 2023-24; year is its four-digit starting year. If a real catalog subject is not present, subjectId must be null and subjectName should be a clean, concise subject title. If evidence is weak, keep uncertain fields null/unchanged and mark confidence low.`;
}

async function callOpenAI(
  items: ConsolidatedMetadataInput[],
  catalog: CatalogProgram[],
  safetyIdentifier: string,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MATCH_MODEL ?? "gpt-5.6-luna",
      store: false,
      safety_identifier: safetyIdentifier,
      reasoning: { effort: "low" },
      max_output_tokens: 5000,
      input: [
        {
          role: "system",
          content:
            "You are a precise university archive cataloger. Match PDFs to the supplied catalog and extract course, semester, subject, and academic year. Never invent an ID.",
        },
        { role: "user", content: buildPrompt(items, catalog) },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "paper_metadata_matches",
          strict: true,
          schema: z.toJSONSchema(MatchOutputSchema, { target: "draft-7" }),
        },
      },
    }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI matching failed (${response.status}): ${body.slice(0, 240)}`);
  }
  const text = responseText(await response.json());
  if (!text) throw new Error("OpenAI returned no metadata result.");
  return MatchOutputSchema.parse(JSON.parse(text));
}

async function callGroq(items: ConsolidatedMetadataInput[], catalog: CatalogProgram[]) {
  const client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const response = await client.chat.completions.create({
    model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    max_tokens: 4000,
    messages: [
      {
        role: "system",
        content:
          "You are a precise university archive cataloger. Match PDFs to the supplied catalog and extract course, semester, subject, and academic year. Never invent an ID.",
      },
      { role: "user", content: buildPrompt(items, catalog) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "paper_metadata_matches",
        strict: true,
        schema: z.toJSONSchema(MatchOutputSchema, { target: "draft-7" }) as Record<string, unknown>,
      },
    },
  });
  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("The fallback AI returned no metadata result.");
  return MatchOutputSchema.parse(JSON.parse(text));
}

export async function matchConsolidatedMetadataAction(rawItems: ConsolidatedMetadataInput[]) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "Unauthorized" };
  const parsed = z.array(MatchInputSchema).min(1).max(60).safeParse(rawItems);
  if (!parsed.success) return { ok: false as const, error: "The PDF metadata request is invalid." };

  const programs: CatalogProgram[] = await prisma.program.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      terms: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          name: true,
          order: true,
          subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } },
        },
      },
    },
  });

  const useOpenAI = !!process.env.OPENAI_API_KEY;
  if (!useOpenAI && !process.env.GROQ_API_KEY) {
    return {
      ok: false as const,
      error: "AI matching is not configured. Add OPENAI_API_KEY (preferred) or GROQ_API_KEY.",
    };
  }

  // Groq's smaller request limit cannot hold the full catalog. Its fallback
  // therefore uses the courses already found by deterministic parsing/admin
  // selection; OpenAI receives the full catalog and can correct the course.
  const heuristicProgramIds = new Set(parsed.data.map((item) => item.programId).filter(Boolean));
  const providerCatalog = useOpenAI
    ? programs
    : programs.filter((program) => heuristicProgramIds.has(program.id));
  if (providerCatalog.length === 0) {
    return { ok: false as const, error: "Choose a course for at least one row before using the fallback AI matcher." };
  }

  try {
    const collected: ConsolidatedMetadataMatch[] = [];
    // Bounded chunks improve reliability and keep one failed response from
    // discarding an entire large archive's matches.
    for (let i = 0; i < parsed.data.length; i += 10) {
      const chunk = parsed.data.slice(i, i + 10);
      const result = useOpenAI
        ? await callOpenAI(chunk, providerCatalog, `notevault_admin_${session.adminId}`)
        : await callGroq(chunk, providerCatalog);
      collected.push(...result.matches);
    }

    const validPrograms = new Set(programs.map((program) => program.id));
    const validSubjects = new Map(
      programs.flatMap((program) =>
        program.terms.flatMap((term) =>
          term.subjects.map((subject) => [subject.id, { ...subject, programId: program.id, order: term.order }] as const),
        ),
      ),
    );
    const matches = collected.map((match) => {
      const subject = match.subjectId ? validSubjects.get(match.subjectId) : null;
      const programId = match.programId && validPrograms.has(match.programId) ? match.programId : null;
      const subjectIsConsistent =
        !!subject && subject.programId === programId && subject.order === match.semesterOrder;
      return {
        ...match,
        programId,
        subjectId: subjectIsConsistent ? match.subjectId : null,
        subjectName: subjectIsConsistent && subject ? subject.name : match.subjectName,
      };
    });
    return { ok: true as const, provider: useOpenAI ? ("OpenAI" as const) : ("Groq" as const), matches };
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof Error ? error.message : "AI metadata matching failed.",
    };
  }
}
