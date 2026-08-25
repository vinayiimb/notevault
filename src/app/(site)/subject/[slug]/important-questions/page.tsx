import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { Target, TrendingUp, AlertCircle } from "lucide-react";
import Link from "next/link";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: { term: { include: { program: true } } }
  });
  if (!subject) return { title: 'Not Found' };
  
  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'questions');
}

export default async function SubjectImportantQuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const subject = await prisma.subject.findFirst({
    where: { slug },
  });

  if (!subject) notFound();

  // Fetch repeated questions, sorted by how often they appeared
  const questions = await prisma.question.findMany({
    where: { 
      subjectId: subject.id,
      isRepeated: true
    },
    orderBy: { repeatCount: 'desc' },
    take: 50 // Limit to top 50 to avoid massive pages
  });

  return (
    <div className="space-y-12">
      <section>
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-rose-500" />
            Most Repeated Questions
          </h2>
          <p className="text-gray-500 mt-2 max-w-2xl">
            These questions have appeared multiple times in past DU examinations for {subject.name}. Focusing on these topics will give you the highest return on your study time.
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
            <Target className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">Analysis pending</h3>
            <p className="text-gray-500 max-w-md mx-auto mt-2">
              We are still analyzing the previous year papers for this subject to determine the most frequently asked questions. Check back before exams.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800">
                <strong>Disclaimer:</strong> This is a statistical analysis of past papers (10 Years), not a prediction. Delhi University can change paper patterns at any time. Do not rely solely on these questions.
              </p>
            </div>

            <div className="space-y-4">
              {questions.map((q, i) => (
                <div key={q.id} className="bg-white border border-gray-200 rounded-xl p-5 md:p-6 hover:border-rose-300 hover:shadow-md transition-all">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold">
                          {i + 1}
                        </span>
                        {q.topics.length > 0 && (
                          <div className="flex gap-2">
                            {q.topics.map(topic => (
                              <span key={topic} className="text-xs font-bold bg-rose-50 text-rose-600 px-2 py-1 rounded">
                                {topic}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <h3 className="text-lg font-medium text-gray-900 leading-relaxed whitespace-pre-wrap">
                        {q.questionText}
                      </h3>
                    </div>
                    
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0 md:w-32 bg-gray-50 md:bg-transparent p-3 md:p-0 rounded-lg md:rounded-none">
                      <div className="text-center md:text-right">
                        <div className="text-2xl font-black text-rose-600 leading-none">{q.repeatCount}x</div>
                        <div className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mt-1">Repeated</div>
                      </div>
                      
                      {q.years && (
                        <div className="text-xs font-medium text-gray-500 md:text-right mt-2">
                          <span className="block md:hidden font-bold mb-1">Years Asked:</span>
                          {q.years.split(',').join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {q.answerText && q.answerText.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <details className="group">
                        <summary className="flex items-center gap-2 text-sm font-bold text-blue-600 cursor-pointer select-none">
                          <span className="group-open:hidden">View Solution</span>
                          <span className="hidden group-open:inline">Hide Solution</span>
                        </summary>
                        <div className="mt-3 prose prose-sm max-w-none text-gray-700 bg-gray-50 p-4 rounded-lg">
                          {q.answerText}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <RelatedLinks 
        links={[
          { title: `${subject.name} Complete PYQs`, url: `/subject/${slug}/pyq`, type: 'pyq' },
          { title: `${subject.name} Study Notes`, url: `/subject/${slug}/notes`, type: 'notes' }
        ]} 
      />
    </div>
  );
}
