export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getNoteThemeById } from "@/lib/note-theme-data";
import { DEFAULT_THEME, ThemeValuesSchema, type ThemeValues } from "@/lib/note-theme";
import { NoteThemeEditor } from "@/components/admin/note-theme-editor";

function parseAsFullTheme(json: unknown): ThemeValues {
  const parsed = ThemeValuesSchema.safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

export default async function NoteThemeEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const theme = await getNoteThemeById(id);
  if (!theme) notFound();

  // SUBJECT/NOTE themes only ever store a *partial* override — the live
  // preview needs the actual current global default underneath it (fetched
  // fresh here, not assumed to be DEFAULT_THEME, since an admin may have
  // published a different theme as the site default).
  let globalDefault: ThemeValues = DEFAULT_THEME;
  if (theme.scope !== "GLOBAL") {
    const globalTheme = await prisma.noteTheme.findFirst({ where: { scope: "GLOBAL", isDefaultGlobal: true } });
    if (globalTheme?.publishedJson) globalDefault = parseAsFullTheme(globalTheme.publishedJson);
  }

  return (
    <NoteThemeEditor
      themeId={theme.id}
      name={theme.name}
      scope={theme.scope}
      isPreset={theme.isPreset}
      isDefaultGlobal={theme.isDefaultGlobal}
      draftJson={theme.draftJson}
      publishedJson={theme.publishedJson}
      globalDefault={globalDefault}
      versions={theme.versions.map((v) => ({ id: v.id, label: v.label, createdAt: v.createdAt.toISOString() }))}
      subjectName={theme.subject?.name ?? null}
    />
  );
}
