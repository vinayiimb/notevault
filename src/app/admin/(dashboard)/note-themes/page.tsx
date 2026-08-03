export const dynamic = "force-static";
import Link from "next/link";
import { Check, CopySimple, Lock, Swatches } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { listNoteThemes } from "@/lib/note-theme-data";
import { createNoteThemeAction, duplicateNoteThemeAction } from "@/lib/actions";
import { DEFAULT_THEME, ThemeValuesSchema, type ThemeValues } from "@/lib/note-theme";

function swatchColors(publishedJson: unknown, draftJson: unknown): ThemeValues["colors"] {
  const full = ThemeValuesSchema.safeParse(publishedJson ?? draftJson);
  if (full.success) return full.data.colors;
  const partial = ThemeValuesSchema.partial().safeParse(publishedJson ?? draftJson);
  return { ...DEFAULT_THEME.colors, ...(partial.success ? partial.data.colors : {}) };
}

export default async function NoteThemesPage() {
  const [themes, subjects] = await Promise.all([
    listNoteThemes(),
    prisma.subject.findMany({
      where: { noteThemes: { none: {} } },
      select: { id: true, name: true, term: { select: { program: { select: { name: true } } } } },
      orderBy: { name: "asc" },
      take: 300,
    }),
  ]);

  const global = themes.filter((t) => t.scope === "GLOBAL");
  const subjectScoped = themes.filter((t) => t.scope === "SUBJECT");
  const noteScoped = themes.filter((t) => t.scope === "NOTE");

  return (
    <div className="p-8">
      <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_10px_40px_rgba(15,23,42,.06)] sm:p-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Note Designer</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Themes control colors, typography, layout, and diagram styling for structured notes — never
          the content itself. Global is every note&apos;s fallback; a subject or note theme only needs
          to override what it actually wants to change.
        </p>

        <section className="mt-10">
          <SectionHeading title="Global" subtitle="Site default" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {global.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </section>

        <section className="mt-10 border-t border-border pt-10">
          <SectionHeading title="Subject overrides" subtitle={`${subjectScoped.length}`} />
          {subjectScoped.length > 0 && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {subjectScoped.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          )}

          <form
            action={createNoteThemeAction}
            className="mt-4 grid gap-3 rounded-2xl border border-dashed border-border p-5 sm:grid-cols-[1.2fr_1.4fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="scope" value="SUBJECT" />
            <Field label="Theme name">
              <input
                type="text"
                name="name"
                placeholder="e.g. Economics — warm"
                required
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              />
            </Field>
            <Field label="Subject">
              <select
                name="subjectId"
                required
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              >
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.term.program.name} · {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Start from">
              <select
                name="basedOnId"
                defaultValue=""
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
              >
                <option value="">Default</option>
                {global.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="submit"
              className="flex min-h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
            >
              Create
            </button>
          </form>
        </section>

        {noteScoped.length > 0 && (
          <section className="mt-10 border-t border-border pt-10">
            <SectionHeading title="Note-specific overrides" subtitle={`${noteScoped.length}`} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {noteScoped.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <h2 className="text-xs font-bold tracking-wider text-muted uppercase">{title}</h2>
      <span className="text-xs text-muted/70">{subtitle}</span>
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

function ThemeCard({
  theme,
}: {
  theme: {
    id: string;
    name: string;
    isPreset: boolean;
    isDefaultGlobal: boolean;
    publishedJson: unknown;
    draftJson: unknown;
    subject: { id: string; name: string } | null;
  };
}) {
  const colors = swatchColors(theme.publishedJson, theme.draftJson);
  const swatches = [colors.background, colors.primaryAccent, colors.highlightYellow, colors.highlightMint, colors.highlightPink];

  return (
    <div className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-background transition hover:border-accent/50 hover:shadow-[0_8px_24px_rgba(15,23,42,.06)]">
      <Link href={`/admin/note-themes/${theme.id}`} className="flex flex-1 flex-col p-5">
        <div className="flex overflow-hidden rounded-lg border border-border">
          {swatches.map((c, i) => (
            <span key={i} className="h-8 flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>

        <div className="mt-4 flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-foreground group-hover:text-accent">{theme.name}</p>
            {theme.subject && <p className="mt-0.5 text-xs text-muted">{theme.subject.name}</p>}
          </div>
          {theme.isDefaultGlobal && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              <Check size={11} weight="bold" /> Default
            </span>
          )}
        </div>

        <p className="mt-auto flex items-center gap-1.5 pt-4 text-xs text-muted">
          {theme.isPreset ? (
            <>
              <Lock size={12} weight="bold" /> Built-in preset
            </>
          ) : theme.publishedJson ? (
            <>
              <Swatches size={12} weight="bold" /> Published
            </>
          ) : (
            "Draft only"
          )}
        </p>
      </Link>

      <form action={duplicateNoteThemeAction} className="border-t border-border">
        <input type="hidden" name="themeId" value={theme.id} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-1.5 py-2.5 text-xs font-semibold text-muted transition hover:bg-surface-muted hover:text-foreground"
        >
          <CopySimple size={13} weight="bold" /> Duplicate
        </button>
      </form>
    </div>
  );
}
