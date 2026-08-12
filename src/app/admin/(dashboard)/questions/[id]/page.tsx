export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { QuestionEditor } from "@/components/admin/question-editor";

export default async function AdminQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: { subject: { include: { term: { include: { program: true } } } } },
  });
  if (!question) notFound();

  const resourceOptions = await prisma.resource.findMany({
    where: { subjectId: question.subjectId, type: "PYQ" },
    select: { id: true, title: true, year: true },
    orderBy: { year: "desc" },
  });

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/questions" className="hover:text-accent">
          Question bank
        </Link>
        {" / "}
        <Link href={`/admin/subjects/${question.subjectId}`} className="hover:text-accent">
          {question.subject.term.program.name} · {question.subject.name}
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold">Edit question</h1>

      <div className="mt-6">
        <QuestionEditor
          question={{
            id: question.id,
            subjectId: question.subjectId,
            questionText: question.questionText,
            answerText: question.answerText,
            marks: question.marks,
            years: question.years,
            isRepeated: question.isRepeated,
            repeatCount: question.repeatCount,
            resourceId: question.resourceId,
            questionNumber: question.questionNumber,
            section: question.section,
            rawOcrText: question.rawOcrText,
            topics: question.topics,
            difficulty: question.difficulty,
            contentBlocks: question.contentBlocks,
          }}
          resourceOptions={resourceOptions}
        />
      </div>
    </div>
  );
}
