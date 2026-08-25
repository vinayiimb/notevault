import { Metadata } from 'next';
import { notFound } from 'next/navigation';

interface Props {
  params: Promise<{ slug?: string; id?: string; code?: string; number?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Question Bank`,
    description: `Comprehensive resources for Question Bank`,
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  return (
    <div className="container mx-auto px-4 py-24 min-h-screen">
      <h1 className="text-4xl font-bold mb-6">Question Bank</h1>
      <p className="text-gray-600">This page is part of the new SEO architecture. Dynamic data integration pending.</p>
    </div>
  );
}
