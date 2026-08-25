import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import Link from "next/link";
import { ArrowRight, FileText, PenTool, Target } from "lucide-react";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: { term: { include: { program: true } } }
  });
  if (!subject) return { title: 'Not Found' };
  
  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'home');
}

export default async function SubjectOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: {
      _count: {
        select: {
          resources: true,
          questions: true,
        }
      }
    }
  });

  if (!subject) notFound();

  // In a real app we'd filter resources by type (PYQ vs Notes) directly,
  // but for the skeleton overview we just show the total resources count.
  const resourceCount = subject._count.resources;
  const questionCount = subject._count.questions;

  const quickLinks = [
    {
      title: "Previous Year Papers",
      desc: "Download full PDF papers from the last 10 years",
      icon: FileText,
      href: `/subject/${slug}/pyq`,
      count: resourceCount > 0 ? `${resourceCount} Papers` : "Coming Soon",
      color: "bg-blue-50 text-blue-600"
    },
    {
      title: "Study Notes",
      desc: "Complete unit-wise summaries and revision notes",
      icon: PenTool,
      href: `/subject/${slug}/notes`,
      count: "Notes",
      color: "bg-purple-50 text-purple-600"
    },
    {
      title: "Important Questions",
      desc: "Most repeated questions in recent DU exams",
      icon: Target,
      href: `/subject/${slug}/important-questions`,
      count: questionCount > 0 ? `${questionCount} Questions` : "Coming Soon",
      color: "bg-rose-50 text-rose-600"
    }
  ];

  return (
    <div className="space-y-12">
      <section>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Prepare for {subject.name}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {quickLinks.map((link) => (
            <Link key={link.title} href={link.href} className="block group">
              <div className="h-full bg-white border border-gray-200 rounded-2xl p-6 transition-all hover:shadow-lg hover:border-blue-200">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${link.color}`}>
                  <link.icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{link.title}</h3>
                <p className="text-gray-500 text-sm mb-4 h-10">{link.desc}</p>
                <div className="flex items-center justify-between mt-auto">
                  <span className="text-sm font-semibold text-gray-700">{link.count}</span>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {subject.description && (
        <section className="bg-white border border-gray-200 rounded-2xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">About this Subject</h2>
          <div className="prose prose-blue max-w-none text-gray-600">
            {subject.description}
          </div>
        </section>
      )}

      {/* Placeholder Related Links - In real usage, this would fetch sibling subjects from Prisma */}
      <RelatedLinks 
        links={[
          { title: "Financial Accounting", url: "/subject/financial-accounting" },
          { title: "Business Laws", url: "/subject/business-laws" },
          { title: "B.Com Hons Semester 1 Syllabus", url: "/course/bcom-hons/semester-1" }
        ]} 
      />
    </div>
  );
}
