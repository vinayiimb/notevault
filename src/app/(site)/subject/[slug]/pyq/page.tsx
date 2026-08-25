import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";
import { FileText, Download, Eye } from "lucide-react";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: { term: { include: { program: true } } }
  });
  if (!subject) return { title: 'Not Found' };
  
  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'pyq');
}

export default async function SubjectPYQPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const subject = await prisma.subject.findFirst({
    where: { slug },
  });

  if (!subject) notFound();

  // Fetch actual PYQs from the database
  const pyqs = await prisma.resource.findMany({
    where: { 
      subjectId: subject.id,
      type: "PYQ"
    },
    orderBy: { year: 'desc' }
  });

  return (
    <div className="space-y-12">
      <section>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Previous Year Question Papers</h2>
            <p className="text-gray-500 mt-1">Download original PDF question papers for {subject.name}</p>
          </div>
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-lg font-bold">
            {pyqs.length} Papers
          </div>
        </div>

        {pyqs.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900">No PYQs available yet</h3>
            <p className="text-gray-500">Check back later for updated question papers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pyqs.map((pyq) => (
              <div key={pyq.id} className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col hover:border-blue-300 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{pyq.year || pyq.academicYear || "Question Paper"}</h3>
                    <p className="text-sm text-gray-500 line-clamp-1 mt-1">{pyq.title}</p>
                  </div>
                  {pyq.session && (
                    <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {pyq.session}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-gray-100">
                  <Link 
                    href={`/pyq-notes/${pyq.id}`} 
                    className="flex-1 flex items-center justify-center gap-2 bg-[#0A1128] text-white py-2 rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors"
                  >
                    <Eye className="w-4 h-4" /> View
                  </Link>
                  <a 
                    href={`/api/download/${pyq.id}`}
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
          { title: `${subject.name} Study Notes`, url: `/subject/${slug}/notes`, type: 'notes' },
          { title: `${subject.name} Important Questions`, url: `/subject/${slug}/important-questions`, type: 'important' }
        ]} 
      />
    </div>
  );
}
