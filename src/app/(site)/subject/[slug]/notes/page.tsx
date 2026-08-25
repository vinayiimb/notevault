import { slugify } from "@/lib/utils";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";
import { PenTool, Download, Eye, BookOpen, ArrowRight } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: { term: { include: { program: true } } }
  });
  if (!subject) return { title: 'Not Found' };
  
  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'notes');
}

export default async function SubjectNotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: { notes: true, term: { include: { program: true } } }
  });

  if (!subject) notFound();

  // Fetch PDF Notes from Resources
  const pdfNotes = await prisma.resource.findMany({
    where: { 
      subjectId: subject.id,
      type: "NOTES"
    },
    orderBy: { createdAt: 'desc' }
  });

  const programmeSlug = slugify(subject.term.program.name);
  const canonicalNote = await getCanonicalNote(programmeSlug, subject.slug);
  const hasStructuredNotes = !!canonicalNote?.content?.trim();
  const totalNotes = pdfNotes.length + (hasStructuredNotes ? 1 : 0);

  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Study Notes & Material</h2>
            <p className="text-gray-500 mt-1">Complete unit-wise summaries for {subject.name}</p>
          </div>
          <div className="bg-purple-50 text-purple-700 px-4 py-2 rounded-lg font-bold">
            {totalNotes} Resources
          </div>
        </div>

        {totalNotes === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
            <PenTool className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No notes available yet</h3>
            <p className="text-gray-500">We are currently gathering study material for this subject.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Structured/Markdown Compiled Notes (if they exist) */}
            {hasStructuredNotes && (
              <div className="bg-gradient-to-br from-purple-50 to-white border border-purple-200 rounded-xl p-5 flex flex-col hover:shadow-md transition-all md:col-span-2">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-purple-100 p-2 rounded-lg text-purple-700">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">Official Compiled Notes</h3>
                      <p className="text-sm text-gray-600 mt-1">Comprehensive unit-wise revision notes</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded uppercase tracking-wider">
                    Recommended
                  </span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-purple-100 flex justify-end">
                  <Link 
                    href={`/notes/${programmeSlug}/${subject.slug}`} 
                    className="flex items-center gap-2 bg-purple-600 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-purple-700 transition-colors"
                  >
                    Read Notes <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* PDF Notes */}
            {pdfNotes.map((note) => (
              <div key={note.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{note.title}</h3>
                    {note.year && <p className="text-sm text-gray-500 mt-1">Year: {note.year}</p>}
                  </div>
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    PDF
                  </span>
                </div>
                
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
                  <Link 
                    href={`/pyq-notes/${note.id}`} 
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0A1128] text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </Link>
                  <a 
                    href={`/api/download/${note.id}`}
                    className="flex items-center justify-center gap-2 bg-gray-50 text-gray-700 border border-gray-200 py-2 px-4 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RelatedLinks 
        links={[
          { title: `${subject.name} PYQs`, url: `/subject/${slug}/pyq`, type: 'pyq' },
          { title: `${subject.name} Important Questions`, url: `/subject/${slug}/important-questions`, type: 'important' }
        ]} 
      />
    </div>
  );
}
