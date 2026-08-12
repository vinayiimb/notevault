export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { StudyContentBlockSchema, createDefaultBlock } from "@/lib/content/content-block-schema";
import { ContentBlockEditor } from "@/components/admin/content-block-editor";

export default async function AdminContentBlockPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await prisma.contentBlock.findUnique({ where: { id } });
  if (!record) notFound();

  const parsed = StudyContentBlockSchema.safeParse(record.block);
  const block = parsed.success ? parsed.data : createDefaultBlock("markdown", id);

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/content-blocks" className="hover:text-accent">
          Content blocks
        </Link>
      </p>
      <h1 className="mt-1 text-2xl font-semibold">{record.label}</h1>

      <div className="mt-6">
        <ContentBlockEditor
          id={record.id}
          initialLabel={record.label}
          initialDescription={record.description ?? ""}
          initialCategory={record.category ?? ""}
          initialTags={record.tags.join(", ")}
          initialBlock={block}
        />
      </div>
    </div>
  );
}
