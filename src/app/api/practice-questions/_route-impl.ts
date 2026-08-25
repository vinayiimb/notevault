import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, QuestionDifficulty } from "@prisma/client";
import Groq from "groq-sdk";
import { z } from "zod";

const prisma = new PrismaClient();

// Schema for structured Groq output
const GeneratedQuestionSchema = z.object({
  questionNumber: z.string(),
  section: z.string().nullable(),
  questionText: z.string(),
  answerText: z.string(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  topics: z.array(z.string()),
  solution: z.string(),
});

const GeneratedQuestionsListSchema = z.array(GeneratedQuestionSchema);

// Fallback high-quality questions (e.g. IPMAT logical reasoning and general DU style)
const FALLBACK_QUESTIONS = [
  {
    questionNumber: "1",
    section: "Logical Reasoning",
    questionText: "Five friends A, B, C, D, and E go on a trip together. Each of them likes at least one of the following three activities: Countryside Sightseeing, Shopping, and Adventure Sports such that:\n\n* No two friends like exactly the same set of activities.\n* A, B and E like exactly two activities each.\n* D likes only Countryside Sightseeing.\n* C likes more number of activities compared to D.",
    answerText: "2",
    difficulty: "EASY" as const,
    topics: ["Arrangements"],
    solution: "**Step-by-step Solution:**\n\n1. Let the three activities be:\n   * **CS**: Countryside Sightseeing\n   * **S**: Shopping\n   * **AS**: Adventure Sports\n\n2. Friend **D** likes only Countryside Sightseeing. So D's set of activities is **{CS}** (size 1).\n\n3. Since **C** likes more activities than D, C must like more than 1 activity. The maximum number of activities is 3. Let's look at others:\n   * **A**, **B**, and **E** like exactly two activities each. There are only three unique combinations of choosing 2 activities out of 3:\n     1. {CS, S}\n     2. {CS, AS}\n     3. {S, AS}\n   * Since all friends must have unique sets of activities, A, B, and E must take these three combinations exactly. \n\n4. Since A, B, and E have taken all size 2 combinations, and D has taken {CS} (size 1), **C** cannot like exactly 2 activities. Therefore, C must like all 3 activities: **{CS, S, AS}**.\n\n5. Now, we want to find the number of friends who like both **Shopping (S)** and **Adventure Sports (AS)**:\n   * **C** likes all three, so C likes both S and AS.\n   * Out of A, B, and E, exactly one friend likes the combination **{S, AS}**.\n   * The other combinations ({CS, S} and {CS, AS}) do not contain both S and AS.\n   * D likes only {CS}.\n\n6. Therefore, exactly **2** friends (C and the one of A, B, E who likes {S, AS}) like both Shopping and Adventure Sports."
  },
  {
    questionNumber: "2",
    section: "Logical Reasoning",
    questionText: "If a cube is painted red on all faces and then cut into 64 smaller equal cubes, how many smaller cubes have exactly two painted faces?",
    answerText: "24",
    difficulty: "MEDIUM" as const,
    topics: ["Cube Cutting"],
    solution: "**Step-by-step Solution:**\n\n1. A cube of 64 smaller cubes is a **4 × 4 × 4** cube.\n2. The smaller cubes with exactly two painted faces are located along the **edges** of the larger cube, excluding the corner cubes (which have 3 painted faces).\n3. A cube has **12 edges**.\n4. Along each edge of a 4 × 4 × 4 cube, there are 4 smaller cubes.\n5. Subtracting the 2 corner cubes on each edge: `4 - 2 = 2` cubes per edge have exactly two painted faces.\n6. Total cubes with exactly two painted faces = `12 edges × 2 cubes/edge = 24` cubes."
  },
  {
    questionNumber: "3",
    section: "Analytical Ability",
    questionText: "In a row of 30 students, A is 12th from the left and B is 15th from the right. How many students are there between A and B?",
    answerText: "3",
    difficulty: "EASY" as const,
    topics: ["Ranking"],
    solution: "**Step-by-step Solution:**\n\n1. Total number of students = 30.\n2. Position of A from the left = 12th.\n3. Position of B from the right = 15th.\n4. To find B's position from the left: `Total - Position from Right + 1 = 30 - 15 + 1 = 16th` from the left.\n5. Since A is 12th from the left and B is 16th from the left, the positions between them are: 13th, 14th, and 15th.\n6. Thus, there are exactly **3** students between A and B."
  },
  {
    questionNumber: "4",
    section: "Logical Reasoning",
    questionText: "If 'Red' is called 'Green', 'Green' is called 'Yellow', 'Yellow' is called 'Blue', and 'Blue' is called 'White', what is the color of the clear sky?",
    answerText: "White",
    difficulty: "EASY" as const,
    topics: ["Coding-Decoding"],
    solution: "**Step-by-step Solution:**\n\n1. The actual color of a clear sky is **Blue**.\n2. According to the coding pattern: 'Blue' is called **White**.\n3. Therefore, the color of the clear sky in this code is **White**."
  },
  {
    questionNumber: "5",
    section: "Numerical Ability",
    questionText: "Find the missing number in the series: 2, 6, 12, 20, 30, ?",
    answerText: "42",
    difficulty: "EASY" as const,
    topics: ["Series Completion"],
    solution: "**Step-by-step Solution:**\n\n1. Let's analyze the difference between consecutive terms in the series:\n   * `6 - 2 = 4`\n   * `12 - 6 = 6`\n   * `20 - 12 = 8`\n   * `30 - 20 = 10`\n\n2. The differences form a sequence of consecutive even numbers: **4, 6, 8, 10**.\n3. The next difference in the sequence should be **12**.\n4. Therefore, the missing term is: `30 + 12 = 42`."
  }
];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const course = searchParams.get("course") || "";
  const semester = searchParams.get("semester") || "";
  const subject = searchParams.get("subject") || "";
  const year = searchParams.get("year") || "";

  if (!course || !subject) {
    return NextResponse.json({ error: "Missing course or subject" }, { status: 400 });
  }

  const courseSlug = course.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const subjectSlug = subject.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  try {
    // 1. Try to find the existing Program -> Term -> Subject -> Questions in the DB
    const dbSubject = await prisma.subject.findFirst({
      where: {
        slug: subjectSlug,
        term: {
          program: {
            slug: courseSlug,
          },
        },
      },
      include: {
        questions: {
          orderBy: { questionNumber: "asc" },
        },
      },
    });

    if (dbSubject && dbSubject.questions.length > 0) {
      // Map database questions to the response format
      const formatted = dbSubject.questions.map((q) => {
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
          solution: solution,
        };
      });
      return NextResponse.json({ questions: formatted });
    }

    // 2. No questions in DB. If GROQ_API_KEY is available, try to generate them using AI
    if (process.env.GROQ_API_KEY) {
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const model = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";

      const systemPrompt = `You are an expert exam author and academic tutor.
Your task is to generate 5 high-quality, realistic, exam-style practice questions for the following subject, course, and year.
Each question must be challenging, syllabus-compliant, and accompanied by a detailed step-by-step solution.

Format your output as a JSON array where each item matches this Zod schema:
[
  {
    "questionNumber": string (e.g. "1", "2", "3(a)"),
    "section": string (e.g. "Logical Reasoning", "Accounting"),
    "questionText": string (the question itself, write in clean Markdown/LaTeX),
    "answerText": string (the final answer, e.g. "2" or "White"),
    "difficulty": "EASY" | "MEDIUM" | "HARD",
    "topics": string[] (1-2 specific topic names),
    "solution": string (detailed step-by-step solution showing the full reasoning/working, written in clean Markdown/LaTeX)
  }
]
Return only the valid JSON array. Do NOT wrap in markdown code blocks or add any introductory text.`;

      const userContent = `Course: ${course}
Semester: ${semester}
Subject: ${subject}
Year: ${year}`;

      try {
        const completion = await groq.chat.completions.create({
          model: model,
          max_tokens: 3000,
          temperature: 0.7,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content || "";
        // Try parsing JSON. In case of object wrapper like { "questions": [...] }, handle it.
        let rawJson = JSON.parse(content);
        if (!Array.isArray(rawJson) && rawJson.questions) {
          rawJson = rawJson.questions;
        }

        const parsed = GeneratedQuestionsListSchema.safeParse(rawJson);
        if (parsed.success) {
          // Dynamically ensure Program -> Term -> Subject exist in DB
          let program = await prisma.program.findUnique({ where: { slug: courseSlug } });
          if (!program) {
            program = await prisma.program.create({
              data: {
                name: course,
                slug: courseSlug,
                level: "COLLEGE",
              },
            });
          }

          const semOrder = parseInt(semester.replace(/\D/g, "")) || 1;
          let term = await prisma.term.findFirst({
            where: { programId: program.id, order: semOrder },
          });
          if (!term) {
            term = await prisma.term.create({
              data: {
                programId: program.id,
                name: semester || `Semester ${semOrder}`,
                order: semOrder,
              },
            });
          }

          let dbSub = await prisma.subject.findUnique({
            where: { termId_slug: { termId: term.id, slug: subjectSlug } },
          });
          if (!dbSub) {
            dbSub = await prisma.subject.create({
              data: {
                termId: term.id,
                name: subject,
                slug: subjectSlug,
              },
            });
          }

          // Insert questions into database
          const insertedQuestions = [];
          for (const q of parsed.data) {
            const created = await prisma.question.create({
              data: {
                subjectId: dbSub.id,
                questionText: q.questionText,
                answerText: q.answerText,
                questionNumber: q.questionNumber,
                section: q.section,
                topics: q.topics,
                difficulty: q.difficulty as QuestionDifficulty,
                contentBlocks: [
                  {
                    id: Math.random().toString(36).substring(7),
                    type: "markdown",
                    content: q.solution,
                  },
                ],
              },
            });

            insertedQuestions.push({
              id: created.id,
              questionNumber: q.questionNumber,
              section: q.section || "General",
              questionText: q.questionText,
              answerText: q.answerText,
              difficulty: q.difficulty,
              topics: q.topics,
              solution: q.solution,
            });
          }

          return NextResponse.json({ questions: insertedQuestions });
        }
      } catch (err) {
        console.error("Failed to generate AI questions, using fallback:", err);
      }
    }

    // 3. Fallback to default questions if database/AI is not available or fails
    // Match fallback questions with random IDs for the frontend session
    const formattedFallback = FALLBACK_QUESTIONS.map((q) => ({
      id: Math.random().toString(36).substring(7),
      ...q,
    }));
    return NextResponse.json({ questions: formattedFallback });

  } catch (dbErr) {
    console.error("Database error, returning fallback questions:", dbErr);
    const formattedFallback = FALLBACK_QUESTIONS.map((q) => ({
      id: Math.random().toString(36).substring(7),
      ...q,
    }));
    return NextResponse.json({ questions: formattedFallback });
  }
}
