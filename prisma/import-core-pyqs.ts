import { config } from "dotenv";
import { createHash } from "crypto";
import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { PrismaClient } from "../src/generated/prisma";
import { putBytes } from "../src/lib/storage";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

const prisma = new PrismaClient();
const EXPECTED_SOURCE_COUNT = 188;
const IMPORT_BATCH_ID = "dbc-core-pyqs-2017-2025";
const defaultSourceRoot = "/Users/sayam/Desktop/OCR PYQ";

const coursePrograms = {
  Biochemistry: {
    programName: "B.Sc. (Hons.) Biochemistry",
    programSlug: "bsc-hons-biochemistry",
  },
  Botany: {
    programName: "B.Sc. (Hons.) Botany",
    programSlug: "bsc-hons-botany",
  },
  Chemistry: {
    programName: "B.Sc. (Hons.) Chemistry",
    programSlug: "bsc-hons-chemistry",
  },
  Mathematics: {
    programName: "B.Sc. (Hons.) Mathematics",
    programSlug: "bsc-hons-mathematics",
  },
  Physics: {
    programName: "B.Sc. (Hons.) Physics",
    programSlug: "bsc-hons-physics",
  },
  Zoology: {
    programName: "B.Sc. (Hons.) Zoology",
    programSlug: "bsc-hons-zoology",
  },
} as const;

type CourseName = keyof typeof coursePrograms;

const semesterOrders = {
  Semester_I: 1,
  Semester_II: 2,
  Semester_III: 3,
  Semester_IV: 4,
  Semester_V: 5,
  Semester_VI: 6,
} as const;

type SemesterName = keyof typeof semesterOrders;

type SourceJson = {
  course: string;
  semester: string;
  year: string;
  filename: string;
  extraction_method: string;
  extracted_text: string;
  page_count: number;
};

type ImportRecord = {
  sourceJsonName: string;
  sourceJsonPath: string;
  pdfPath: string;
  pdfBytes: Buffer;
  pdfHash: string;
  course: CourseName;
  semester: SemesterName;
  semesterOrder: number;
  academicYear: string;
  year: number;
  originalFilename: string;
  extractionMethod: string;
  ocrText: string;
  ocrTextHash: string;
  pageCount: number;
};

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function isCourseName(value: string): value is CourseName {
  return Object.prototype.hasOwnProperty.call(coursePrograms, value);
}

function isSemesterName(value: string): value is SemesterName {
  return Object.prototype.hasOwnProperty.call(semesterOrders, value);
}

function titleFor(record: ImportRecord) {
  return `${record.course} · Semester ${record.semesterOrder} · ${record.academicYear}`;
}

function storedFilename(record: ImportRecord) {
  return `${record.course}_Semester_${record.semesterOrder}_${record.academicYear}.pdf`.replace(
    /[^\w.-]+/g,
    "_",
  );
}

function storageKey(record: ImportRecord) {
  const courseSlug = record.course.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `uploads/pyqs/dbc-core/${courseSlug}/semester-${record.semesterOrder}/${record.academicYear}.pdf`;
}

function subjectDescription(record: ImportRecord) {
  const { programName } = coursePrograms[record.course];
  return `Combined ${record.course} previous-year question papers for ${programName}, Semester ${record.semesterOrder}.`;
}

async function loadRecords(sourceRoot: string): Promise<ImportRecord[]> {
  const jsonDirectory = path.join(sourceRoot, "OCR_Output", "JSON");
  const sourceNames = (await readdir(jsonDirectory))
    .filter((name) => name.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  if (sourceNames.length !== EXPECTED_SOURCE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SOURCE_COUNT} JSON sources, but found ${sourceNames.length} in ${jsonDirectory}.`,
    );
  }

  const records: ImportRecord[] = [];
  for (const sourceJsonName of sourceNames) {
    const sourceJsonPath = path.join(jsonDirectory, sourceJsonName);
    const parsed = JSON.parse(await readFile(sourceJsonPath, "utf8")) as SourceJson;

    if (!isCourseName(parsed.course)) {
      throw new Error(`${sourceJsonName}: unsupported course ${JSON.stringify(parsed.course)}`);
    }
    if (!isSemesterName(parsed.semester)) {
      throw new Error(`${sourceJsonName}: unsupported semester ${JSON.stringify(parsed.semester)}`);
    }
    if (!/^\d{4}-\d{2}$/.test(parsed.year)) {
      throw new Error(`${sourceJsonName}: invalid academic year ${JSON.stringify(parsed.year)}`);
    }
    if (typeof parsed.extracted_text !== "string" || parsed.extracted_text.length === 0) {
      throw new Error(`${sourceJsonName}: extracted_text is empty or invalid`);
    }
    if (!Number.isInteger(parsed.page_count) || parsed.page_count <= 0) {
      throw new Error(`${sourceJsonName}: page_count is invalid`);
    }

    const pdfPath = path.join(
      sourceRoot,
      "Semester_Organized",
      parsed.semester,
      parsed.course,
      `${parsed.year}.pdf`,
    );
    const pdfStats = await stat(pdfPath);
    if (!pdfStats.isFile()) {
      throw new Error(`${sourceJsonName}: matching PDF is not a file at ${pdfPath}`);
    }
    const pdfBytes = await readFile(pdfPath);
    if (pdfBytes.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new Error(`${sourceJsonName}: matching file does not have a PDF signature`);
    }

    records.push({
      sourceJsonName,
      sourceJsonPath,
      pdfPath,
      pdfBytes,
      pdfHash: sha256(pdfBytes),
      course: parsed.course,
      semester: parsed.semester,
      semesterOrder: semesterOrders[parsed.semester],
      academicYear: parsed.year,
      year: Number(parsed.year.slice(0, 4)),
      originalFilename: parsed.filename,
      extractionMethod: parsed.extraction_method,
      ocrText: parsed.extracted_text,
      ocrTextHash: sha256(parsed.extracted_text),
      pageCount: parsed.page_count,
    });
  }

  const duplicatePdfHashes = new Map<string, string[]>();
  for (const record of records) {
    const names = duplicatePdfHashes.get(record.pdfHash) ?? [];
    names.push(record.sourceJsonName);
    duplicatePdfHashes.set(record.pdfHash, names);
  }
  const collisions = [...duplicatePdfHashes.values()].filter((names) => names.length > 1);
  if (collisions.length > 0) {
    throw new Error(
      `Source set contains duplicate PDF bytes: ${collisions.map((names) => names.join(" / ")).join(", ")}`,
    );
  }

  return records;
}

function printInventory(records: ImportRecord[]) {
  console.log(`Validated ${records.length} JSON files and ${records.length} matching PDFs.`);
  for (const course of Object.keys(coursePrograms) as CourseName[]) {
    const courseRecords = records.filter((record) => record.course === course);
    const semesterCounts = Object.keys(semesterOrders)
      .map((semester) => {
        const count = courseRecords.filter((record) => record.semester === semester).length;
        return `${semester.replace("Semester_", "S")}:${count}`;
      })
      .join(" ");
    console.log(`${course.padEnd(12)} ${courseRecords.length} papers  ${semesterCounts}`);
  }
}

async function ensureSubject(record: ImportRecord) {
  const programSpec = coursePrograms[record.course];
  const program = await prisma.program.upsert({
    where: { slug: programSpec.programSlug },
    create: {
      name: programSpec.programName,
      slug: programSpec.programSlug,
      level: "COLLEGE",
    },
    update: { name: programSpec.programName },
  });

  const term = await prisma.term.upsert({
    where: { programId_order: { programId: program.id, order: record.semesterOrder } },
    create: {
      programId: program.id,
      order: record.semesterOrder,
      name: `Semester ${record.semesterOrder}`,
    },
    update: { name: `Semester ${record.semesterOrder}` },
  });

  return prisma.subject.upsert({
    where: { termId_slug: { termId: term.id, slug: record.course.toLowerCase() } },
    create: {
      termId: term.id,
      name: record.course,
      slug: record.course.toLowerCase(),
      description: subjectDescription(record),
    },
    update: {
      name: record.course,
      description: subjectDescription(record),
    },
  });
}

async function applyImport(records: ImportRecord[]) {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for --apply.");
  }
  const requiredStorageVariables = [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_URL",
  ];
  const missingStorageVariables = requiredStorageVariables.filter((name) => !process.env[name]);
  if (missingStorageVariables.length > 0) {
    throw new Error(
      `Production R2 configuration is required for --apply. Missing: ${missingStorageVariables.join(", ")}`,
    );
  }

  await prisma.$connect();
  await prisma.uploadBatch.upsert({
    where: { id: IMPORT_BATCH_ID },
    create: { id: IMPORT_BATCH_ID },
    update: {},
  });

  let created = 0;
  let updated = 0;
  for (let index = 0; index < records.length; index++) {
    const record = records[index];
    const subject = await ensureSubject(record);
    const existingBySource = await prisma.resource.findUnique({
      where: { sourceJsonName: record.sourceJsonName },
    });
    const existingByHash = existingBySource
      ? null
      : await prisma.resource.findFirst({ where: { fileHash: record.pdfHash } });
    const existing = existingBySource ?? existingByHash;
    const configuredPublicRoot = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");
    const alreadyStored =
      existing?.fileHash === record.pdfHash && existing.fileUrl.startsWith(`${configuredPublicRoot}/`);
    const fileUrl = alreadyStored
      ? existing.fileUrl
      : await putBytes(storageKey(record), record.pdfBytes, { allowOverwrite: true });

    const data = {
      subjectId: subject.id,
      type: "PYQ" as const,
      title: titleFor(record),
      year: record.year,
      academicYear: record.academicYear,
      fileUrl,
      fileName: storedFilename(record),
      fileSize: record.pdfBytes.byteLength,
      fileHash: record.pdfHash,
      ocrText: record.ocrText,
      ocrTextHash: record.ocrTextHash,
      sourceJsonName: record.sourceJsonName,
      pageCount: record.pageCount,
      batchId: IMPORT_BATCH_ID,
    };

    if (existing) {
      await prisma.resource.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.resource.create({ data });
      created++;
    }
    console.log(
      `[${String(index + 1).padStart(3, "0")}/${records.length}] ${existing ? "updated" : "created"} ${record.sourceJsonName}`,
    );
  }

  return { created, updated };
}

async function verifyDatabase(records: ImportRecord[]) {
  const sourceNames = records.map((record) => record.sourceJsonName);
  const resources = await prisma.resource.findMany({
    where: { sourceJsonName: { in: sourceNames } },
    include: { subject: { include: { term: { include: { program: true } } } } },
  });
  const resourcesBySource = new Map(
    resources.map((resource) => [resource.sourceJsonName, resource] as const),
  );
  const failures: string[] = [];

  for (const record of records) {
    const resource = resourcesBySource.get(record.sourceJsonName);
    if (!resource) {
      failures.push(`${record.sourceJsonName}: missing resource`);
      continue;
    }
    const expectedProgram = coursePrograms[record.course];
    const checks = [
      [resource.subject.name === record.course, "subject"],
      [resource.subject.term.order === record.semesterOrder, "semester"],
      [resource.subject.term.program.slug === expectedProgram.programSlug, "program"],
      [resource.academicYear === record.academicYear, "academic year"],
      [resource.year === record.year, "year"],
      [resource.fileHash === record.pdfHash, "PDF hash"],
      [resource.fileSize === record.pdfBytes.byteLength, "PDF size"],
      [resource.ocrText === record.ocrText, "OCR text"],
      [resource.ocrTextHash === record.ocrTextHash, "OCR hash"],
      [resource.pageCount === record.pageCount, "page count"],
      [resource.type === "PYQ", "resource type"],
      [/^https:\/\//.test(resource.fileUrl), "public file URL"],
    ] as const;
    const failedFields = checks.filter(([passed]) => !passed).map(([, label]) => label);
    if (failedFields.length > 0) {
      failures.push(`${record.sourceJsonName}: ${failedFields.join(", ")}`);
    }
  }

  if (resources.length !== records.length) {
    failures.push(`resource count is ${resources.length}; expected ${records.length}`);
  }
  if (failures.length > 0) {
    throw new Error(`Database verification failed:\n${failures.join("\n")}`);
  }
  console.log(`Verified ${resources.length}/${records.length} deployed resources against source data.`);
}

async function main() {
  const sourceRoot = process.env.OCR_PYQ_ROOT || defaultSourceRoot;
  const apply = process.argv.includes("--apply");
  const records = await loadRecords(sourceRoot);
  printInventory(records);

  if (!apply) {
    console.log("Dry run complete. Run with --apply after configuring the deployment environment.");
    return;
  }

  const result = await applyImport(records);
  await verifyDatabase(records);
  console.log(`Import complete: ${result.created} created, ${result.updated} updated.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
