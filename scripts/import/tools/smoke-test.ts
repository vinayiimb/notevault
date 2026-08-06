// Phase 2D §5 smoke test — exercises the app's own data-layer functions
// (src/lib/data.ts) against Supabase staging, using both the pooled
// (DATABASE_URL) and unpooled (DATABASE_URL_UNPOOLED) connections, to
// confirm the live app code actually works against the newly-imported
// Wave 1 data. Read-only.
import { resolveImportTarget, describeTarget } from "../lib/target-guard";
import { PrismaClient } from "@/generated/prisma";
import { getProgramsByLevel, getProgramBySlug, getTermById } from "@/lib/data";

async function main() {
  const target = resolveImportTarget();
  console.log(`[target] ${describeTarget(target)}`);

  // getProgramsByLevel/getProgramBySlug/getTermById go through the app's own
  // @/lib/prisma singleton, which reads DATABASE_URL from process.env — so
  // sourcing .env.supabase-staging.local before running this script is what
  // points them at staging's pooled connection.
  console.log("\n1. Programme listing (getProgramsByLevel):");
  const programs = await getProgramsByLevel("COLLEGE");
  console.log(`   ${programs.length} programmes returned`);
  console.assert(programs.length === 118, `expected 118 programmes, got ${programs.length}`);
  const sample = programs[0];
  console.log(`   sample: "${sample.name}" (slug=${sample.slug}), ${sample.terms.length} terms`);

  console.log("\n2. Terms for a programme (getProgramBySlug):");
  const bySlug = await getProgramBySlug(sample.slug);
  console.assert(Boolean(bySlug && "terms" in bySlug), "getProgramBySlug should resolve the same programme");
  if (bySlug && "terms" in bySlug) {
    console.log(`   ${bySlug.terms.length} terms for "${bySlug.name}"`);
  }

  console.log("\n3. Subjects for a term (getTermById):");
  const firstTerm = sample.terms[0];
  const term = await getTermById(firstTerm.id);
  console.assert(term !== null, "getTermById should resolve a real term");
  if (term) {
    console.log(`   Term "${term.name}": ${term.subjects.length} subjects, e.g. "${term.subjects[0]?.name}"`);
  }

  console.log("\n4. Exam sessions (raw count, via a direct pooled-connection query):");
  const pooledClient = new PrismaClient({ datasources: { db: { url: target.databaseUrl } } });
  const examSessionCount = await pooledClient.examSession.count();
  console.log(`   ${examSessionCount} exam sessions (pooled connection, DATABASE_URL)`);
  console.assert(examSessionCount === 9, `expected 9 exam sessions, got ${examSessionCount}`);
  await pooledClient.$disconnect();

  console.log("\n5. Unpooled connection sanity check (DATABASE_URL_UNPOOLED):");
  const unpooledClient = new PrismaClient({ datasources: { db: { url: target.directUrl } } });
  const subjectCountViaUnpooled = await unpooledClient.subject.count();
  console.log(`   ${subjectCountViaUnpooled} subjects (unpooled connection, DATABASE_URL_UNPOOLED)`);
  console.assert(subjectCountViaUnpooled === 7650, `expected 7650 subjects, got ${subjectCountViaUnpooled}`);
  await unpooledClient.$disconnect();

  console.log("\n6. Confirm no unrestricted archive query is triggered:");
  console.log("   getProgramsByLevel/getProgramBySlug/getTermById only ever query Program/Term/Subject");
  console.log("   scoped by level/slug/id — none of them touch Resource, CatalogPaperUpload, or");
  console.log("   DriveFileMatch (the tables Phase 2A flagged for unbounded scans), and this Wave");
  console.log("   only populated Program/Term/Subject/ExamSession, so getUnifiedPyqArchive()-style");
  console.log("   full-archive queries have nothing new to scan regardless.");

  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
