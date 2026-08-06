// Phase 2D apply-mode execution. Uses the exact same computeImportPlan()
// as preview/validate (lib/plan.ts) so what gets written is guaranteed to
// match what was previewed — then performs the actual writes for
// status: "insert" outcomes only, in FK dependency order, in bounded
// chunked transactions. Never touches "rejected"/"unresolved_fk" outcomes.
import type { PrismaClient } from "@/generated/prisma";
import type { ImportPlan } from "./plan";
import type { PlannedRecord } from "./types";

const CHUNK_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type ApplyResult = {
  perModel: Record<string, { inserted: number; skippedExisting: number; rejected: number; unresolvedForeignKey: number }>;
  totalInserted: number;
};

export async function applyImportPlan(prisma: PrismaClient, plan: ImportPlan): Promise<ApplyResult> {
  const insertsByModel = (model: string) =>
    plan.outcomes.filter((o) => o.status === "insert" && o.record.model === model).map((o) => o.record as PlannedRecord);

  // --- Program ---
  const programInserts = insertsByModel("Program");
  for (const batch of chunk(programInserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((r) =>
        prisma.program.create({
          data: {
            level: r.data.level as "COLLEGE" | "SCHOOL",
            name: String(r.data.name),
            slug: r.naturalKey,
            summary: (r.data.summary as string | null) ?? null,
          },
        }),
      ),
    );
  }

  // Bounded re-query covering the whole candidate set (inserted-this-run +
  // pre-existing) — needed to resolve Term's Program FK next wave.
  const allProgramSlugs = [...new Set(plan.outcomes.filter((o) => o.record.model === "Program").map((o) => o.record.naturalKey))];
  const programRows = allProgramSlugs.length
    ? await prisma.program.findMany({ where: { slug: { in: allProgramSlugs } }, select: { id: true, slug: true } })
    : [];
  const programIdBySlug = new Map(programRows.map((p) => [p.slug, p.id]));

  // --- Term (depends on Program) ---
  const termInserts = insertsByModel("Term");
  for (const batch of chunk(termInserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((r) => {
        const programId = programIdBySlug.get(String(r.data.programSlug));
        if (!programId) throw new Error(`Apply-time invariant violation: Program(slug=${r.data.programSlug}) not found for Term ${r.naturalKey}`);
        return prisma.term.create({
          data: { programId, order: Number(r.data.order), name: String(r.data.name) },
        });
      }),
    );
  }

  const allTermProgramSlugs = [...new Set(plan.outcomes.filter((o) => o.record.model === "Term").map((o) => String(o.record.data.programSlug)))];
  const allTermProgramIds = allTermProgramSlugs.map((s) => programIdBySlug.get(s)).filter((id): id is string => Boolean(id));
  const termRows = allTermProgramIds.length
    ? await prisma.term.findMany({ where: { programId: { in: allTermProgramIds } }, select: { id: true, programId: true, order: true } })
    : [];
  const programSlugById = new Map([...programIdBySlug.entries()].map(([slug, id]) => [id, slug]));
  const termIdByProgramSlugAndOrder = new Map(
    termRows.map((t) => [`${programSlugById.get(t.programId)}::${t.order}`, t.id]),
  );

  // --- Subject (depends on Term) ---
  const subjectInserts = insertsByModel("Subject");
  for (const batch of chunk(subjectInserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((r) => {
        const termId = termIdByProgramSlugAndOrder.get(String(r.data.termKey));
        if (!termId) throw new Error(`Apply-time invariant violation: Term(${r.data.termKey}) not found for Subject ${r.naturalKey}`);
        return prisma.subject.create({
          data: {
            termId,
            name: String(r.data.name),
            slug: String(r.data.slug),
            description: (r.data.description as string | null) ?? null,
            upc: (r.data.upc as string | null) ?? null,
            paperType: (r.data.paperType as string | null) ?? null,
          },
        });
      }),
    );
  }

  // --- ExamSession ---
  const sessionInserts = insertsByModel("ExamSession");
  for (const batch of chunk(sessionInserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((r) =>
        prisma.examSession.create({ data: { label: String(r.data.label), order: Number(r.data.order) } }),
      ),
    );
  }

  const allSessionLabels = [...new Set(plan.outcomes.filter((o) => o.record.model === "ExamSession").map((o) => o.record.naturalKey))];
  const sessionRows = allSessionLabels.length
    ? await prisma.examSession.findMany({ where: { label: { in: allSessionLabels } }, select: { id: true, label: true } })
    : [];
  const sessionIdByLabel = new Map(sessionRows.map((s) => [s.label, s.id]));

  // --- SessionProgramLink (depends on ExamSession + Program) ---
  const linkInserts = insertsByModel("SessionProgramLink");
  for (const batch of chunk(linkInserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((r) => {
        const sessionId = sessionIdByLabel.get(String(r.data.sessionKey));
        const programId = programIdBySlug.get(String(r.data.programSlug));
        if (!sessionId || !programId) {
          throw new Error(`Apply-time invariant violation: missing parent for SessionProgramLink ${r.naturalKey}`);
        }
        return prisma.sessionProgramLink.create({
          data: { sessionId, programId, variantLabel: String(r.data.variantLabel ?? ""), driveUrl: String(r.data.driveUrl) },
        });
      }),
    );
  }

  const perModel: ApplyResult["perModel"] = {};
  for (const model of ["Program", "Term", "Subject", "ExamSession", "SessionProgramLink"]) {
    const modelOutcomes = plan.outcomes.filter((o) => o.record.model === model);
    perModel[model] = {
      inserted: modelOutcomes.filter((o) => o.status === "insert").length,
      skippedExisting: modelOutcomes.filter((o) => o.status === "skip_existing").length,
      rejected: modelOutcomes.filter((o) => o.status === "rejected").length,
      unresolvedForeignKey: modelOutcomes.filter((o) => o.status === "unresolved_fk").length,
    };
  }
  const totalInserted = Object.values(perModel).reduce((sum, m) => sum + m.inserted, 0);

  return { perModel, totalInserted };
}
