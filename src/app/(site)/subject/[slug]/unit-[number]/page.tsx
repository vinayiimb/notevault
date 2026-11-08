import { Metadata } from 'next';
import Link from 'next/link';

interface Props {
  params: Promise<{ slug?: string; id?: string; code?: string; number?: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Unit Specific Notes`,
    description: `Comprehensive resources for Unit Specific Notes`,
    // Placeholder tab content — keep it out of the index until it is built.
    robots: { index: false, follow: true },
  };
}

export default async function Page({ params }: Props) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug;
  return (
    <div className="rounded-[22px] bg-surface-muted px-6 py-16 text-center">
      <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-foreground">Unit Specific Notes</h2>
      <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
        This section is coming soon. Meanwhile, the past papers and most repeated questions for this subject are available.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href={`/subject/${slug}/pyq`} className="rounded-full bg-brand px-5 py-2.5 text-[15px] font-semibold text-brand-foreground transition-colors duration-300 hover:bg-brand-hover">
          Previous year papers
        </Link>
        <Link href={`/subject/${slug}/important-questions`} className="rounded-full bg-surface px-5 py-2.5 text-[15px] font-semibold text-foreground ring-1 ring-border transition-colors duration-300 hover:bg-background">
          Important questions
        </Link>
      </div>
    </div>
  );
}
