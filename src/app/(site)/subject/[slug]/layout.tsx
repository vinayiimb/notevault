import { ReactNode } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { BookOpen, FileText, Target, FileQuestion, PenTool } from "lucide-react";

export default async function SubjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  const subject = await prisma.subject.findFirst({
    where: { slug },
    include: {
      term: {
        include: { program: true }
      }
    }
  });

  if (!subject) notFound();

  const tabs = [
    { name: "Overview", href: `/subject/${slug}`, icon: BookOpen },
    { name: "PYQs", href: `/subject/${slug}/pyq`, icon: FileText },
    { name: "Notes", href: `/subject/${slug}/notes`, icon: PenTool },
    { name: "Important Questions", href: `/subject/${slug}/important-questions`, icon: Target },
    { name: "Mock Tests", href: `/subject/${slug}/mock-test`, icon: FileQuestion },
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b border-gray-200 pt-32 pb-8">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="mb-4">
            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
              {subject.term.program.name} · Semester {subject.term.order}
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">
              {subject.name}
            </h1>
            {subject.upc && (
              <p className="text-gray-500 font-medium mt-3">UPC: {subject.upc}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-8">
            {tabs.map((tab) => (
              <Link
                key={tab.name}
                href={tab.href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all hover:bg-gray-100 text-gray-700"
              >
                <tab.icon className="w-4 h-4" />
                {tab.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-12 max-w-5xl">
        {children}
      </main>
    </div>
  );
}
