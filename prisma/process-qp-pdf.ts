#!/usr/bin/env tsx
// @ts-nocheck
/**
 * Process university question paper PDF: extract metadata, organize by Year/Semester/Subject.
 *
 * Usage:
 *   npx tsx prisma/process-qp-pdf.ts <pdf_path> [--year YYYY] [--output dir] [--metadata file.jsonl] [--db]
 *
 * Example:
 *   npx tsx prisma/process-qp-pdf.ts "/path/to/B.Com-Prog-Copy.pdf" --year 2026 --output "./qps" --metadata "./metadata.jsonl" --db
 */

import * as fs from "fs";
import * as path from "path";
import { createWriteStream } from "fs";
import Anthropic from "@anthropic-ai/sdk";
import { PrismaClient } from "@prisma/client";
import * as pdfParse from "pdf-parse";

interface ExtractedMetadata {
  subject: string | null;
  semester: string | null;
  course: string | null;
  paper_code: string | null;
  marks: number | null;
  duration_hours: number | null;
  year: string | null;
  confidence: number;
  notes: string;
}

interface Paper {
  file_source: string;
  page_start: number;
  page_end: number;
  year: number | null;
  semester: string | null;
  course: string | null;
  subject: string | null;
  subject_hindi: string | null;
  paper_code: string | null;
  marks: number | null;
  duration_hours: number | null;
  confidence: number;
  extraction_notes: string;
  file_output: string | null;
}

const client = new Anthropic();
let prisma: PrismaClient | null = null;

// PDF extraction helper
async function extractTextFromPdf(pdfPath: string): Promise<string[]> {
  const dataBuffer = fs.readFileSync(pdfPath);
  let pages: string[] = [];

  try {
    // Use pdf-parse to extract text from first 5 pages
    const pdfParser = pdfParse as unknown as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>;
    const pdf = await pdfParser(dataBuffer, { max: 5 });

    // pdf-parse gives us full text; split into pages manually
    const fullText = pdf.text;
    const numPages = Math.min(5, pdf.numpages || 5);
    const pageSize = fullText.length / numPages;

    for (let i = 0; i < numPages; i++) {
      const start = Math.floor(i * pageSize);
      const end = Math.floor((i + 1) * pageSize);
      pages.push(fullText.substring(start, end));
    }
  } catch (err) {
    console.warn(`⚠️  PDF extraction failed: ${String(err).substring(0, 50)}`);
    // Fallback: return 5 empty pages
    pages = ["", "", "", "", ""];
  }

  return pages;
}

// Detect paper boundaries by looking for "printed pages" marker
function detectPaperBoundaries(pages: string[]): Array<[number, number]> {
  const boundaries: number[] = [];

  pages.forEach((text, idx) => {
    if (text.toLowerCase().includes("printed page")) {
      boundaries.push(idx + 1); // 1-indexed
    }
  });

  // Convert starts to (start, end) ranges
  const ranges: Array<[number, number]> = [];
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1] ? boundaries[i + 1] - 1 : pages.length;
    ranges.push([start, end]);
  }

  return ranges.length > 0 ? ranges : [[1, Math.min(5, pages.length)]];
}

// Extract header block (~20 lines from page)
function extractHeaderBlock(text: string): string {
  const lines = text.split("\n");
  const markerIdx = lines.findIndex(line =>
    line.toLowerCase().includes("printed page")
  );

  if (markerIdx === -1) return text.substring(0, 500);

  return lines
    .slice(markerIdx, Math.min(markerIdx + 20, lines.length))
    .join("\n");
}

// Prompt 1: Extract metadata from OCR header
async function extractMetadata(headerText: string): Promise<ExtractedMetadata> {
  const prompt = `You extract structured metadata from OCR'd headers of Indian university exam question papers. OCR text is often garbled — words split/merged, stray chars ("Nam ofthe Paper", "UGCE"), labels/values out of order due to table layout.

Extract only what's stated in the header. Do not infer from question content. For ambiguous fields, pick most likely and lower confidence. Normalize semester to Roman numerals (I, II, III, IV, V, VI, VII, VIII, IX).

Respond with ONLY valid JSON, no other text:

{
  "subject": "string or null",
  "semester": "I/II/III/IV/V/VI/VII/VIII/IX or null",
  "course": "string or null (e.g., B.Com (P), B.A. (Prog.), B.A. (P) UGCF)",
  "paper_code": "string or null",
  "marks": "number or null",
  "duration_hours": "number or null",
  "year": "string (YYYY) or null",
  "confidence": 0.0-1.0,
  "notes": "string (flag any OCR issues or ambiguities)"
}

OCR header text:
"""
${headerText}
"""
`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 500,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const firstContentBlock = response.content[0];
  const text = (firstContentBlock && "text" in firstContentBlock ? (firstContentBlock as { text: string }).text : "").trim();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`⚠️  Failed to parse JSON: ${text.substring(0, 100)}`);
    return {
      subject: null,
      semester: null,
      course: null,
      paper_code: null,
      marks: null,
      duration_hours: null,
      year: null,
      confidence: 0,
      notes: `Parse error: ${String(err).substring(0, 50)}`,
    };
  }
}

// Prompt 2: Infer year from paper code if needed
async function inferYear(
  metadata: ExtractedMetadata,
  paperCode: string | null
): Promise<string | null> {
  if (metadata.year) return metadata.year;
  if (!paperCode) return null;

  const prompt = `Given metadata and paper code, infer exam year.

Rules:
1. If a session date/year is explicit, use it.
2. If paper code starts with "24"/"25"/"26" (e.g., 2412251201), those digits usually = 2024/2025/2026.
3. Otherwise return null.

Metadata: ${JSON.stringify(metadata)}
Paper Code: ${paperCode}

Respond JSON only:
{"year": "YYYY or null", "inference_method": "explicit_date | paper_code_prefix | unknown", "confidence": 0.0-1.0}
`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 200,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });

  const secondContentBlock = response.content[0];
  const text = (secondContentBlock && "text" in secondContentBlock ? (secondContentBlock as { text: string }).text : "").trim();
  try {
    const result = JSON.parse(text);
    return result.year;
  } catch {
    return null;
  }
}

// Main processing function
async function processPdf(
  pdfPath: string,
  yearOverride: number | null,
  outputDir: string,
  metadataFile: string,
  saveToDb: boolean
): Promise<Paper[]> {
  console.log(`📄 Processing: ${pdfPath}`);
  console.log(
    `   Output: ${outputDir} | Metadata: ${metadataFile} | DB: ${saveToDb}`
  );

  // Extract pages
  console.log(`\n📖 Extracting pages from PDF...`);
  const pages = await extractTextFromPdf(pdfPath);
  console.log(`   Found ${pages.length} pages`);

  // Detect paper boundaries
  const ranges = detectPaperBoundaries(pages);
  console.log(`\n🔍 Detected ${ranges.length} papers:`);

  const papers: Paper[] = [];

  // Process each paper
  for (const [start, end] of ranges) {
    const pageIdx = Math.max(0, start - 1);
    const headerText = extractHeaderBlock(pages[pageIdx] || "");

    console.log(`\n   Pages ${start}-${end}:`);

    // Extract metadata via Haiku
    const metadata = await extractMetadata(headerText);

    // Infer year if needed
    const year = yearOverride || (await inferYear(metadata, metadata.paper_code));

    const paper: Paper = {
      file_source: path.basename(pdfPath),
      page_start: start,
      page_end: end,
      year: year ? parseInt(String(year), 10) : null,
      semester: metadata.semester,
      course: metadata.course,
      subject: metadata.subject,
      subject_hindi: null,
      paper_code: metadata.paper_code,
      marks: metadata.marks,
      duration_hours: metadata.duration_hours,
      confidence: metadata.confidence,
      extraction_notes: metadata.notes,
      file_output: null,
    };

    // Compute output path
    if (paper.year && paper.semester && paper.subject) {
      paper.file_output = `${paper.year}/${paper.semester}/${paper.subject}.pdf`;
    }

    papers.push(paper);
    console.log(
      `      ✓ ${paper.subject || "UNKNOWN"} (Sem ${paper.semester}, ${paper.year}) | Confidence: ${(metadata.confidence * 100).toFixed(0)}%`
    );

    if (metadata.confidence < 0.8) {
      console.log(`      ⚠️  Low confidence - ${metadata.notes}`);
    }
  }

  // Save metadata to JSON Lines
  console.log(`\n💾 Saving metadata to ${metadataFile}...`);
  fs.mkdirSync(path.dirname(metadataFile) || ".", { recursive: true });
  const jsonlStream = createWriteStream(metadataFile, { flags: "a" });
  for (const paper of papers) {
    jsonlStream.write(JSON.stringify(paper) + "\n");
  }
  jsonlStream.end();
  console.log(`   ✓ Wrote ${papers.length} papers to JSONL`);

  // Save to database if requested
  if (saveToDb) {
    if (!prisma) {
      prisma = new PrismaClient();
    }
    console.log(`\n🗄️  Saving to database...`);
    for (const paper of papers) {
      if (!paper.subject || !paper.semester || !paper.year || !paper.course) {
        console.log(`   ⊘ Skipping incomplete: ${paper.subject} (missing fields)`);
        continue;
      }

      try {
        // Upsert Program
        const program = await prisma!.program.upsert({
          where: { slug: paper.course.toLowerCase().replace(/\s+/g, "-") },
          update: {},
          create: {
            level: "COLLEGE",
            name: paper.course,
            slug: paper.course.toLowerCase().replace(/\s+/g, "-"),
          },
        });

        // Upsert Term
        const semesterOrder =
          paper.semester.charCodeAt(0) - "I".charCodeAt(0) + 1; // I=1, II=2, ...
        const term = await prisma!.term.upsert({
          where: {
            programId_order: { programId: program.id, order: semesterOrder },
          },
          update: {},
          create: {
            programId: program.id,
            name: `Semester ${semesterOrder}`,
            order: semesterOrder,
          },
        });

        // Upsert Subject
        const subject = await prisma!.subject.upsert({
          where: {
            termId_slug: {
              termId: term.id,
              slug: paper.subject.toLowerCase().replace(/\s+/g, "-"),
            },
          },
          update: {},
          create: {
            termId: term.id,
            name: paper.subject,
            slug: paper.subject.toLowerCase().replace(/\s+/g, "-"),
          },
        });

        console.log(`   ✓ Created/linked: ${paper.course} → Sem ${paper.semester} → ${paper.subject}`);
      } catch (err) {
        console.error(`   ✗ DB error: ${String(err).substring(0, 60)}`);
      }
    }
  }

  console.log(`\n✨ Complete! Processed ${papers.length} papers.`);
  return papers;
}

// CLI
const args = process.argv.slice(2);
const pdfPath = args[0];

if (!pdfPath) {
  console.error("Usage: npx tsx prisma/process-qp-pdf.ts <pdf_path> [--year YYYY] [--output dir] [--metadata file] [--db]");
  process.exit(1);
}

const yearIdx = args.indexOf("--year");
const year = yearIdx >= 0 ? parseInt(args[yearIdx + 1], 10) : null;

const outputIdx = args.indexOf("--output");
const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : "./organized_qps";

const metadataIdx = args.indexOf("--metadata");
const metadataFile = metadataIdx >= 0 ? args[metadataIdx + 1] : "./metadata.jsonl";

const saveToDb = args.includes("--db");

processPdf(pdfPath, year, outputDir, metadataFile, saveToDb)
  .then(async () => {
    if (prisma) await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("Fatal error:", err);
    if (prisma) await prisma.$disconnect();
    process.exit(1);
  });
