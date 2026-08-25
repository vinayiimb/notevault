import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug?: string; id?: string; code?: string; number?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Value Addition Courses (VAC)`,
    description: `Comprehensive resources for Value Addition Courses (VAC)`,
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <h1 className="text-4xl font-bold mb-6">Value Addition Courses (VAC)</h1>
      <p className="text-gray-600">This page is part of the new SEO architecture. Dynamic data integration pending.</p>
    </div>
  );
}
