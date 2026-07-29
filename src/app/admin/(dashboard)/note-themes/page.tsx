import Link from "next/link";
import { Check, Copy, Lock, PaintBrush } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import { listNoteThemes } from "@/lib/note-theme-data";
import { createNoteThemeAction, duplicateNoteThemeAction } from "@/lib/actions";

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
        <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          <PaintBrush size={28} weight="bold" className="text-accent" /> Note Designer
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Themes control colors, typography, layout, and diagram styling for structured notes — never
          the content itself. Global is every note&apos;s fallback; a subject or note theme only needs
          to override what it actually wants to change.
        </p>

        <section className="mt-8">
          <h2 className="text-sm font-bold tracking-wide text-muted uppercase">Global (site default)</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {global.map((theme) => (
              <ThemeCard key={theme.id} theme={theme} />
            ))}
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">Subject overrides</h2>
          </div>
          {subjectScoped.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No subject has a custom theme yet.</p>
          ) : (
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjectScoped.map((theme) => (
                <ThemeCard key={theme.id} theme={theme} />
              ))}
            </div>
          )}
          <form action={createNoteThemeAction} className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
            <input type="hidden" name="scope" value="SUBJECT" />
            <input
              type="text"
              name="name"
              placeholder="Theme name"
              required
              className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-accent"
            />
            <select name="subjectId" required className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm">
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.term.program.name} · {s.name}
                </option>
              ))}
            </select>
            <select name="basedOnId" className="min-h-9 rounded-lg border border-border bg-background px-3 text-sm" defaultValue="">
              <option value="">Start from Default</option>
              {global.map((g) => (
                <option key={g.id} value={g.id}>
                  Start from {g.name}
                </option>
              ))}
            </select>
            <button type="submit" className="min-h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover">
              Create subject theme
            </button>
          </form>
        </section>

        {noteScoped.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">Note-specific overrides</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

function ThemeCard({
  theme,
}: {
  theme: {
    id: string;
    name: string;
    isPreset: boolean;
    isDefaultGlobal: boolean;
    publishedJson: unknown;
    subject: { id: string; name: string } | null;
  };
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-background p-4 transition hover:border-accent">
      <Link href={`/admin/note-themes/${theme.id}`} className="flex items-center justify-between gap-2">
        <p className="font-semibold">{theme.name}</p>
        {theme.isDefaultGlobal && (
          <span className="flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
            <Check size={12} weight="bold" /> Default
          </span>
        )}
      </Link>
      {theme.subject && <p className="text-xs text-muted">{theme.subject.name}</p>}
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1 text-xs text-muted">
          {theme.isPreset && <Lock size={12} weight="bold" />}
          {theme.isPreset ? "Built-in preset" : theme.publishedJson ? "Published" : "Draft only"}
        </p>
        <form action={duplicateNoteThemeAction}>
          <input type="hidden" name="themeId" value={theme.id} />
          <button type="submit" className="flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            <Copy size={12} weight="bold" /> Duplicate
          </button>
        </form>
      </div>
    </div>
  );
}
