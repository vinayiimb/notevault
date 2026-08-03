export const dynamic = "force-static";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createContentBlockAction } from "@/lib/actions";
import { BLOCK_TYPE_LABELS, StudyContentBlockSchema, type StudyContentBlockType } from "@/lib/content/content-block-schema";

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as StudyContentBlockType[];

export default async function ContentBlocksPage() {
  const blocks = await prisma.contentBlock.findMany({ orderBy: { updatedAt: "desc" } });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Content blocks</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Reusable rich-content blocks (formulas, tables, diagrams, charts, images, embedded PDFs, callouts,
        practice questions) an admin can build once here and insert by reference into any question&apos;s
        answer content.
      </p>

      <form
        action={createContentBlockAction}
        className="mt-6 grid gap-3 rounded-2xl border border-dashed border-border p-5 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end"
      >
        <Field label="Label">
          <input name="label" required placeholder="e.g. Elasticity of demand formula" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />
        </Field>
        <Field label="Category (optional)">
          <input name="category" placeholder="Economics" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15" />
        </Field>
        <Field label="Type">
          <select name="type" defaultValue="markdown" className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15">
            {BLOCK_TYPES.map((type) => (
              <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>
            ))}
          </select>
        </Field>
        <button type="submit" className="flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover">
          Create
        </button>
      </form>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((block) => {
          const parsed = StudyContentBlockSchema.safeParse(block.block);
          return (
            <Link
              key={block.id}
              href={`/admin/content-blocks/${block.id}`}
              className="group flex flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:shadow-[0_8px_24px_rgba(15,23,42,.06)]"
            >
              <span className="w-fit rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
                {parsed.success ? BLOCK_TYPE_LABELS[parsed.data.type] : "Unknown type"}
              </span>
              <p className="mt-3 font-semibold text-foreground group-hover:text-accent">{block.label}</p>
              {block.category && <p className="mt-0.5 text-xs text-muted">{block.category}</p>}
              {block.description && <p className="mt-2 line-clamp-2 text-sm text-muted">{block.description}</p>}
            </Link>
          );
        })}
        {blocks.length === 0 && <p className="text-sm text-muted">No content blocks yet — create one above.</p>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted">{label}</span>
      {children}
    </label>
  );
}
