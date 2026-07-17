// Recovery script: an out-of-band deletion wiped Program/Term/Subject/
// Resource/Question rows while leaving the actual uploaded PDF files on disk
// (public/uploads/notes, public/uploads/pyqs). Every genuine upload is named
// "<uuid>-<original-filename>.pdf" (see src/lib/storage.ts); bare "<uuid>.pdf"
// files are synthetic demo PDFs from the seed scripts and are NOT touched
// here. This recreates Resource rows for the identifiable real uploads,
// pointing at the files that are already sitting on disk — no re-upload
// needed. Run once; safe to re-run (skips files that already have a Resource
// row with a matching fileUrl).
import { readdir } from "fs/promises";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();
const POOL_SLUG = "common-pool-vac-aec-sec-ge";

// filename hint -> [subject name, term order to create-if-missing, year]
const KNOWN: Array<{ prefix: string; subject: string; termOrder: number }> = [
  { prefix: "Art_of_Being_Happy_", subject: "Art of Being Happy", termOrder: 2 },
  { prefix: "Financial_Literacy_", subject: "Financial Literacy", termOrder: 2 },
  { prefix: "Yoga_Philosophy_Practice_", subject: "Yoga Philosophy & Practice", termOrder: 2 },
  { prefix: "Finance_for_Everyone_SEC_PYQ_", subject: "Finance for Everyone", termOrder: 0 },
  {
    prefix: "Financial_Management_for_Beginners_Eco_GE_Sem_II_PYQ_",
    subject: "Financial Management for Beginners (Eco. GE)",
    termOrder: 2,
  },
];

async function uniqueSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>
) {
  const root = base.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = root;
  let n = 2;
  while (await exists(slug)) {
    slug = `${root}-${n}`;
    n++;
  }
  return slug;
}

async function getOrCreateSubject(termId: string, name: string) {
  const existing = await prisma.subject.findFirst({ where: { termId, name } });
  if (existing) return existing;
  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({ where: { termId_slug: { termId, slug: s } } });
    return !!found;
  });
  return prisma.subject.create({ data: { termId, name, slug } });
}

async function main() {
  const pool = await prisma.program.findUnique({ where: { slug: POOL_SLUG } });
  if (!pool) throw new Error("Common Pool programme missing — run fix-vac-common-pool.ts first.");

  const terms = new Map<number, { id: string }>();
  for (const k of KNOWN) {
    if (terms.has(k.termOrder)) continue;
    const term = await prisma.term.findUnique({
      where: { programId_order: { programId: pool.id, order: k.termOrder } },
    });
    if (!term) throw new Error(`Term order ${k.termOrder} missing under Common Pool.`);
    terms.set(k.termOrder, term);
  }

  let recovered = 0;
  let skippedUnknown = 0;

  for (const subdir of ["notes", "pyqs"] as const) {
    const dir = path.join(process.cwd(), "public", "uploads", subdir);
    const files = await readdir(dir).catch(() => []);
    for (const file of files) {
      // bare "<uuid>.pdf" = synthetic seed content, not a real orphaned upload
      const withoutExt = file.replace(/\.pdf$/i, "");
      const uuidOnly = /^[0-9a-f-]{36}$/i.test(withoutExt);
      if (uuidOnly) continue;

      const match = KNOWN.find((k) => {
        const suffix = withoutExt.slice(37); // after "<uuid>-"
        return suffix.startsWith(k.prefix);
      });

      const fileUrl = `/uploads/${subdir}/${file}`;
      const existingResource = await prisma.resource.findFirst({ where: { fileUrl } });
      if (existingResource) continue;

      if (!match) {
        console.log("UNRECOGNIZED (left as-is, not linked into DB):", file);
        skippedUnknown++;
        continue;
      }

      const term = terms.get(match.termOrder)!;
      const subject = await getOrCreateSubject(term.id, match.subject);

      const filePath = path.join(dir, file);
      const { statSync } = await import("fs");
      const size = statSync(filePath).size;

      const title = withoutExt.slice(37).replace(/_/g, " ").trim();

      await prisma.resource.create({
        data: {
          subjectId: subject.id,
          type: "PYQ",
          title,
          year: 2024,
          fileUrl,
          fileName: `${title}.pdf`,
          fileSize: size,
        },
      });
      console.log("Recovered:", file, "->", subject.name);
      recovered++;
    }
  }

  console.log(`\nRecovered ${recovered} resource(s). ${skippedUnknown} file(s) left unlinked (no confident match).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
