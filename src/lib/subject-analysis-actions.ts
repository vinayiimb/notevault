"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { extractPdfTextFromUrl } from "@/lib/pdf-server";
import { analyzeSubjectPapers, type PaperAnalysis } from "@/lib/ai";

// Kept small for the free/on-demand Groq tier's per-request token cap — see
// the comment on MAX_TOKENS in ai.ts.
const MAX_PAPERS = 4;

export async function generateSubjectAnalysisAction(
  subjectId: string
): Promise<{ ok: true; data: PaperAnalysis } | { ok: false; error: string }> {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    include: {
      resources: {
        where: { type: "PYQ" },
        orderBy: { createdAt: "desc" },
        take: MAX_PAPERS,
      },
    },
  });
  if (!subject) return { ok: false, error: "Subject not found." };
  if (subject.resources.length === 0) {
    return { ok: false, error: "No PYQ papers uploaded for this subject yet." };
  }

  const papers: { label: string; text: string }[] = [];
  for (const r of subject.resources) {
    try {
      const text = await extractPdfTextFromUrl(r.fileUrl);
      if (text.length > 40) {
        papers.push({ label: r.year ? `${r.title} (${r.year})` : r.title, text });
      }
    } catch {
      // Skip unreadable/scanned PDFs — they need OCR (Restore tool) first.
    }
  }

  if (papers.length === 0) {
    return {
      ok: false,
      error:
        "Couldn't read text from any uploaded paper for this subject — they may be scanned images. Run them through the Restore tool first.",
    };
  }

  const result = await analyzeSubjectPapers(subject.name, papers);
  if (!result.ok) return result;

  await prisma.subjectAnalysis.upsert({
    where: { subjectId },
    create: {
      subjectId,
      compiledNotes: result.data.compiledNotes,
      mostRepeatedJson: JSON.stringify(result.data.mostRepeated),
      predictedPaperJson: JSON.stringify(result.data.predictedPaper),
      sourceResourceCount: papers.length,
    },
    update: {
      compiledNotes: result.data.compiledNotes,
      mostRepeatedJson: JSON.stringify(result.data.mostRepeated),
      predictedPaperJson: JSON.stringify(result.data.predictedPaper),
      sourceResourceCount: papers.length,
      generatedAt: new Date(),
    },
  });

  revalidatePath(`/subjects/${subjectId}`);
  return { ok: true, data: result.data };
}
