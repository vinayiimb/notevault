import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QuestionDifficulty } from "@prisma/client";
import { SYLLABUS_MAPS_BY_SUBJECT_ID } from "@/lib/practice-syllabus-maps";

// Practice-mode question lookup, real data only — no AI generation, no
// hardcoded fallback questions. Reads the same Question table the admin
// question bank (/admin/questions) and the "important questions" page
// (/subject/[slug]/important-questions) already use. An empty `questions`
// array is a legitimate, honest response: it means nothing has been
// catalogued yet for this subject, and the frontend shows that plainly
// rather than backfilling with generated content.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // The practice page's subject dropdown now sends the real Subject.id
  // directly (see src/app/(site)/practice/page.tsx) rather than a display
  // name re-slugified independently on each side — that used to be a
  // silent-zero-results footgun whenever the two slugification schemes
  // disagreed. `course` is no longer needed to disambiguate.
  const subjectId = searchParams.get("subject") || "";

  if (!subjectId) {
    return NextResponse.json({ error: "Missing subject" }, { status: 400 });
  }

  try {
    const questions = await prisma.question.findMany({
      where: { subjectId },
      orderBy: { questionNumber: "asc" },
    });

    const formatted = questions.map((q) => {
      const blocks = q.contentBlocks as Array<{ type: string; content?: string }> | null;
      const solution = blocks?.find((b) => b.type === "markdown")?.content || "";
      return {
        id: q.id,
        questionNumber: q.questionNumber || "1",
        section: q.section || "General",
        questionText: q.questionText,
        answerText: q.answerText,
        difficulty: q.difficulty || QuestionDifficulty.EASY,
        topics: q.topics,
        solution,
        contentBlocks: blocks ?? [],
      };
    });

    // Optional: a hand-authored Mermaid topic map for this subject, shown
    // on the practice page before a session starts so students can see the
    // syllabus shape at a glance. Most subjects won't have one yet — that's
    // fine, the frontend just skips rendering it when absent.
    const syllabusMap = SYLLABUS_MAPS_BY_SUBJECT_ID[subjectId] ?? null;

    return NextResponse.json({ questions: formatted, syllabusMap });
  } catch (dbErr) {
    console.error("practice-questions lookup failed:", dbErr);
    return NextResponse.json({ error: "Could not load questions." }, { status: 500 });
  }
}
