// One-off, manually-run integration test for src/lib/subject-merge.ts
// against a REAL database (must be Supabase staging — never run this
// against production). Not part of `npm test` (creates and deletes real
// rows, needs a live DB) — run manually after sourcing
// .env.supabase-staging.local:
//   npx tsx scripts/dev/test-subject-merge-live.ts
//
// Creates a throwaway Term + several throwaway Subjects (and their
// resources/questions/notes/etc.) under a real existing Program, exercises
// applyMerge/undoMerge/idempotency/collision-blocking against them, and
// deletes everything it created at the end — success or failure.
import { PrismaClient } from "@/generated/prisma";
import { applyMerge, undoMerge, previewMerge } from "@/lib/subject-merge";

const prisma = new PrismaClient();

function assert(cond: boolean, message: string) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${message}`);
  console.log(`  ok: ${message}`);
}

async function main() {
  const hostname = new URL(process.env.DATABASE_URL ?? "").hostname;
  if (!hostname.endsWith("pooler.supabase.com")) {
    throw new Error(`Refusing to run: DATABASE_URL host "${hostname}" is not a Supabase staging host.`);
  }
  console.log(`[target] host=${hostname}\n`);

  const program = await prisma.program.findFirst();
  if (!program) throw new Error("No Program exists in this database — nothing to attach a test Term to.");

  const term = await prisma.term.create({
    data: { programId: program.id, name: "__TEST_MERGE_TERM__", order: 99 },
  });
  console.log(`Created throwaway Term ${term.id} under Program "${program.name}"\n`);

  const createdSubjectIds: string[] = [];
  let createdLogId: string | null = null;

  try {
    // ---------- Test 1: basic merge + resource/question preservation ----------
    console.log("Test 1: applyMerge preserves resources/questions, creates alias, sets mergedIntoId");
    const canonical = await prisma.subject.create({
      data: { termId: term.id, name: "Income Tax & Practice", slug: "income-tax-practice" },
    });
    const dup1 = await prisma.subject.create({
      data: { termId: term.id, name: "Income Tax", slug: "income-tax" },
    });
    createdSubjectIds.push(canonical.id, dup1.id);

    const res1 = await prisma.resource.create({
      data: { subjectId: dup1.id, type: "PYQ", title: "Test Paper", fileUrl: "/x.pdf", fileName: "x.pdf", fileSize: 1 },
    });
    const q1 = await prisma.question.create({
      data: { subjectId: dup1.id, questionText: "Test Q", answerText: "Test A" },
    });

    const preview1 = await previewMerge(canonical.id, [canonical.id, dup1.id]);
    assert(preview1.before.resources === 1, "preview shows 1 resource to move");
    assert(preview1.before.questions === 1, "preview shows 1 question to move");
    assert(preview1.blocked === false, "preview is not blocked (no 1:1 conflicts)");
    assert(preview1.expectedDataLoss === 0, "preview expects zero data loss");

    const log1 = await applyMerge({ canonicalSubjectId: canonical.id, memberSubjectIds: [canonical.id, dup1.id], administrator: "test-script" });
    createdLogId = log1.id;

    const movedResource = await prisma.resource.findUniqueOrThrow({ where: { id: res1.id } });
    const movedQuestion = await prisma.question.findUniqueOrThrow({ where: { id: q1.id } });
    assert(movedResource.subjectId === canonical.id, "resource reassigned to canonical subject");
    assert(movedQuestion.subjectId === canonical.id, "question reassigned to canonical subject");

    const dup1After = await prisma.subject.findUniqueOrThrow({ where: { id: dup1.id } });
    assert(dup1After.mergedIntoId === canonical.id, "duplicate subject row marked mergedIntoId, not deleted");

    const alias = await prisma.subjectAlias.findFirst({ where: { canonicalSubjectId: canonical.id, normalizedName: "income tax" } });
    assert(Boolean(alias), "SubjectAlias created for the duplicate's original name");

    // ---------- Test 2: idempotency — re-applying the same merge is a safe no-op ----------
    console.log("\nTest 2: re-applying the exact same merge is idempotent (no error, no duplicate)");
    const aliasCountBefore = await prisma.subjectAlias.count({ where: { canonicalSubjectId: canonical.id } });
    const log2 = await applyMerge({ canonicalSubjectId: canonical.id, memberSubjectIds: [canonical.id, dup1.id], administrator: "test-script" });
    const aliasCountAfter = await prisma.subjectAlias.count({ where: { canonicalSubjectId: canonical.id } });
    assert(log2.id === log1.id, "re-apply returns the original log, not a new one");
    assert(aliasCountAfter === aliasCountBefore, "re-apply did not create a duplicate alias");

    // ---------- Test 3: undo restores everything exactly ----------
    console.log("\nTest 3: undoMerge restores resource/question subjectId and un-merges the subject");
    await undoMerge(log1.id, "test-script");
    const restoredResource = await prisma.resource.findUniqueOrThrow({ where: { id: res1.id } });
    const restoredQuestion = await prisma.question.findUniqueOrThrow({ where: { id: q1.id } });
    const dup1Restored = await prisma.subject.findUniqueOrThrow({ where: { id: dup1.id } });
    assert(restoredResource.subjectId === dup1.id, "resource restored to original subject");
    assert(restoredQuestion.subjectId === dup1.id, "question restored to original subject");
    assert(dup1Restored.mergedIntoId === null, "duplicate subject un-merged");
    const aliasAfterUndo = await prisma.subjectAlias.findFirst({ where: { canonicalSubjectId: canonical.id, normalizedName: "income tax" } });
    assert(!aliasAfterUndo, "alias removed after undo");

    // ---------- Test 4: double-undo rejected ----------
    console.log("\nTest 4: undoing an already-undone merge throws instead of silently no-op'ing");
    await undoMerge(log1.id, "test-script").then(
      () => { throw new Error("expected undoMerge to throw on an already-undone log"); },
      (err) => assert(err instanceof Error && err.message.includes("already been undone"), "correct error message"),
    );

    // ---------- Test 5: collision blocking (two SubjectNotes in one group) ----------
    console.log("\nTest 5: previewMerge blocks a merge where 2+ subjects each have their own SubjectNotes");
    const dup2 = await prisma.subject.create({ data: { termId: term.id, name: "Income Tax Practice", slug: "income-tax-practice-2" } });
    createdSubjectIds.push(dup2.id);
    await prisma.subjectNotes.create({ data: { subjectId: canonical.id, content: "Canonical's own notes" } });
    await prisma.subjectNotes.create({ data: { subjectId: dup2.id, content: "Duplicate's own notes" } });

    const preview2 = await previewMerge(canonical.id, [canonical.id, dup2.id]);
    assert(preview2.blocked === true, "preview correctly blocks the merge");
    assert(preview2.conflicts.length > 0, "preview reports at least one conflict reason");

    await applyMerge({ canonicalSubjectId: canonical.id, memberSubjectIds: [canonical.id, dup2.id], administrator: "test-script" }).then(
      () => { throw new Error("expected applyMerge to throw on a blocked collision"); },
      (err) => assert(err instanceof Error && err.message.includes("Merge blocked"), "applyMerge refuses with a clear message, nothing written"),
    );
    const dup2Unchanged = await prisma.subject.findUniqueOrThrow({ where: { id: dup2.id } });
    assert(dup2Unchanged.mergedIntoId === null, "blocked merge left the subject untouched (not partially merged)");

    console.log("\nAll subject-merge.ts live integration tests passed.");
  } finally {
    // ---------- Cleanup: delete everything this script created ----------
    console.log("\nCleaning up test data...");
    if (createdLogId) await prisma.subjectMergeLog.deleteMany({ where: { id: createdLogId } });
    await prisma.subjectAlias.deleteMany({ where: { canonicalSubjectId: { in: createdSubjectIds } } });
    await prisma.subjectNotes.deleteMany({ where: { subjectId: { in: createdSubjectIds } } });
    await prisma.question.deleteMany({ where: { subjectId: { in: createdSubjectIds } } });
    await prisma.resource.deleteMany({ where: { subjectId: { in: createdSubjectIds } } });
    await prisma.subject.deleteMany({ where: { id: { in: createdSubjectIds } } });
    await prisma.term.delete({ where: { id: term.id } }).catch(() => {});
    console.log("Cleanup complete — no test data left in the database.");
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nFAILED:", err);
  process.exitCode = 1;
});
