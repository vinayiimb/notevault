"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowLeft,
  DesktopTower,
  DeviceMobile,
  DeviceTablet,
  DownloadSimple,
  UploadSimple,
  X,
} from "@phosphor-icons/react/dist/ssr";
import {
  saveNoteThemeDraftAction,
  publishNoteThemeAction,
  restoreNoteThemeVersionAction,
  setDefaultGlobalThemeAction,
  importNoteThemeJsonAction,
} from "@/lib/actions";
import {
  mergeThemeLayers,
  contrastRatio,
  meetsWcagAa,
  NOTE_THEME_PRESETS,
  type ThemeValues,
  type NoteComponentKey,
} from "@/lib/note-theme";
import { StructuredNoteRenderer, fontFamilyFor } from "@/components/subjects/structured-note-renderer";
import { SAMPLE_NOTE } from "@/lib/sample-note";

type Scope = "GLOBAL" | "SUBJECT" | "NOTE";
type Group = "colors" | "typography" | "layout" | "components" | "visuals" | "advanced";
const GROUPS: { key: Group; label: string }[] = [
  { key: "colors", label: "Colors" },
  { key: "typography", label: "Typography" },
  { key: "layout", label: "Layout" },
  { key: "components", label: "Components" },
  { key: "visuals", label: "Diagrams" },
  { key: "advanced", label: "Advanced" },
];
const FONT_OPTIONS = [
  { value: "winkle", label: "Winkle (handwritten)" },
  { value: "inter", label: "Inter" },
  { value: "manrope", label: "Manrope" },
  { value: "fraunces", label: "Fraunces" },
  { value: "comic", label: "Comic Sans (Comic Neue)" },
];
const COMPONENT_LABELS: Record<NoteComponentKey, string> = {
  summary: "Summary",
  keyFacts: "Key facts",
  definitions: "Definitions",
  formulas: "Formulas",
  examples: "Examples",
  important: "Important callout",
  warning: "Warning callout",
  examTip: "Exam tip callout",
  quote: "Quote",
  table: "Table",
  takeaway: "Takeaway",
  sources: "Sources",
};

type DraftShape = ThemeValues | Partial<ThemeValues>;

export function NoteThemeEditor({
  themeId,
  name,
  scope,
  isPreset,
  isDefaultGlobal,
  draftJson,
  publishedJson,
  globalDefault,
  versions,
  subjectName,
}: {
  themeId: string;
  name: string;
  scope: Scope;
  isPreset: boolean;
  isDefaultGlobal: boolean;
  draftJson: unknown;
  publishedJson: unknown;
  globalDefault: ThemeValues;
  versions: { id: string; label: string | null; createdAt: string }[];
  subjectName: string | null;
}) {
  const initialDraft = (draftJson ?? {}) as DraftShape;
  const [draft, setDraft] = useState<DraftShape>(initialDraft);
  const [history, setHistory] = useState<DraftShape[]>([initialDraft]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [activeGroup, setActiveGroup] = useState<Group>("colors");
  const [previewWidth, setPreviewWidth] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // For GLOBAL scope, draft is itself a complete ThemeValues, so merging it
  // onto globalDefault just yields draft's own values back out — for
  // SUBJECT/NOTE scope, draft is a partial override layered on top of the
  // live global default. One merge covers both cases.
  const effectiveTheme = useMemo(() => mergeThemeLayers(globalDefault, draft as Partial<ThemeValues>), [draft, globalDefault]);

  function pushHistory(next: DraftShape) {
    const trimmed = history.slice(0, historyIndex + 1);
    trimmed.push(next);
    setHistory(trimmed);
    setHistoryIndex(trimmed.length - 1);
  }

  function update(next: DraftShape) {
    setDraft(next);
    pushHistory(next);
  }

  // These updaters all work through a loose Record<string, unknown> view of
  // the draft (rather than the strict ThemeValues | Partial<ThemeValues>
  // union) since TS's object-literal checking against that union rejects an
  // otherwise-valid computed-key spread — the loose view is cast back to
  // DraftShape only at the final `update(...)` call, where it's really just
  // going into React state, not a place any structural guarantee is needed
  // (effectiveTheme, a real validated ThemeValues, is what actually renders).
  function asRecord(value: DraftShape): Record<string, unknown> {
    return value as unknown as Record<string, unknown>;
  }

  function updateGroupField(group: Group, field: string, value: unknown) {
    const draftRecord = asRecord(draft);
    const current = (draftRecord[group] as Record<string, unknown> | undefined) ?? asRecord(effectiveTheme)[group];
    update({ ...draftRecord, [group]: { ...(current as Record<string, unknown>), [field]: value } } as unknown as DraftShape);
  }

  function updateArrayField(group: "visuals", field: string, index: number, value: string) {
    const draftRecord = asRecord(draft);
    const current = (draftRecord[group] as Record<string, unknown> | undefined) ?? (effectiveTheme.visuals as unknown as Record<string, unknown>);
    const arr = [...((current[field] as string[]) ?? [])];
    arr[index] = value;
    update({ ...draftRecord, [group]: { ...current, [field]: arr } } as unknown as DraftShape);
  }

  function updateComponentField(componentKey: NoteComponentKey, field: "background" | "border" | "text", value: string) {
    const draftRecord = asRecord(draft);
    const currentComponents = (draftRecord.components as ThemeValues["components"] | undefined) ?? effectiveTheme.components;
    const currentStyle = currentComponents[componentKey] ?? effectiveTheme.components[componentKey];
    update({
      ...draftRecord,
      components: { ...currentComponents, [componentKey]: { ...currentStyle, [field]: value } },
    } as unknown as DraftShape);
  }

  function resetGroup(group: Group) {
    if (group === "advanced") return;
    const next = asRecord(draft);
    delete next[group];
    update(next as unknown as DraftShape);
  }

  function applyPreset(values: ThemeValues) {
    update(scope === "GLOBAL" ? values : { ...values });
  }

  function undo() {
    if (historyIndex === 0) return;
    setHistoryIndex(historyIndex - 1);
    setDraft(history[historyIndex - 1]);
  }
  function redo() {
    if (historyIndex >= history.length - 1) return;
    setHistoryIndex(historyIndex + 1);
    setDraft(history[historyIndex + 1]);
  }

  async function saveDraft() {
    setBusy("save");
    setMessage(null);
    try {
      const formData = new FormData();
      formData.set("themeId", themeId);
      formData.set("draftJson", JSON.stringify(draft));
      await saveNoteThemeDraftAction(formData);
      setMessage("Draft saved.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't save the draft.");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setMessage(null);
    try {
      await saveDraft();
      const formData = new FormData();
      formData.set("themeId", themeId);
      await publishNoteThemeAction(formData);
      setMessage("Published — this is now live.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't publish.");
    } finally {
      setBusy(null);
    }
  }

  async function restoreVersion(versionId: string) {
    setBusy(versionId);
    try {
      const formData = new FormData();
      formData.set("versionId", versionId);
      await restoreNoteThemeVersionAction(formData);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't restore that version.");
      setBusy(null);
    }
  }

  async function makeDefault() {
    setBusy("default");
    try {
      const formData = new FormData();
      formData.set("themeId", themeId);
      await setDefaultGlobalThemeAction(formData);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Couldn't set as default — publish it first.");
      setBusy(null);
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^\w.-]+/g, "_") || "theme"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setBusy("import");
    try {
      const text = await file.text();
      const formData = new FormData();
      formData.set("themeId", themeId);
      formData.set("json", text);
      await importNoteThemeJsonAction(formData);
      window.location.reload();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "That file couldn't be imported.");
      setBusy(null);
    }
  }

  const contrastChecks = [
    { label: "Body text on background", a: effectiveTheme.colors.primaryText, b: effectiveTheme.colors.background },
    { label: "Body text on surface", a: effectiveTheme.colors.primaryText, b: effectiveTheme.colors.surface },
    { label: "Link on background", a: effectiveTheme.colors.link, b: effectiveTheme.colors.background },
    { label: "Secondary text on background", a: effectiveTheme.colors.secondaryText, b: effectiveTheme.colors.background },
  ];

  const previewMaxWidth = previewWidth === "desktop" ? "100%" : previewWidth === "tablet" ? "640px" : "375px";
  const hasOverride = (group: Group) => scope !== "GLOBAL" && group !== "advanced" && !!(draft as Record<string, unknown>)[group];

  return (
    <div className="flex h-[100dvh] flex-col bg-surface-muted/40">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-surface px-6 py-3.5">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/note-themes"
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-foreground"
          >
            <ArrowLeft size={16} weight="bold" /> Note Designer
          </Link>
          <div className="h-6 w-px bg-border" />
          <div>
            <p className="font-semibold text-foreground">{name}</p>
            <p className="text-xs text-muted capitalize">
              {scope.toLowerCase()} theme{subjectName ? ` · ${subjectName}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={undo} disabled={historyIndex === 0} className="rounded-lg p-2 text-muted transition hover:bg-surface-muted disabled:opacity-30" aria-label="Undo">
              <ArrowCounterClockwise size={16} />
            </button>
            <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} className="rounded-lg p-2 text-muted transition hover:bg-surface-muted disabled:opacity-30" aria-label="Redo">
              <ArrowClockwise size={16} />
            </button>
          </div>

          <div className="flex items-center gap-0.5 rounded-lg border border-border bg-surface-muted p-1">
            <button type="button" onClick={() => setPreviewWidth("desktop")} className={`rounded-md p-1.5 transition ${previewWidth === "desktop" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"}`} aria-label="Desktop preview">
              <DesktopTower size={15} weight="bold" />
            </button>
            <button type="button" onClick={() => setPreviewWidth("tablet")} className={`rounded-md p-1.5 transition ${previewWidth === "tablet" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"}`} aria-label="Tablet preview">
              <DeviceTablet size={15} weight="bold" />
            </button>
            <button type="button" onClick={() => setPreviewWidth("mobile")} className={`rounded-md p-1.5 transition ${previewWidth === "mobile" ? "bg-surface text-accent shadow-sm" : "text-muted hover:text-foreground"}`} aria-label="Mobile preview">
              <DeviceMobile size={15} weight="bold" />
            </button>
          </div>

          <div className="h-6 w-px bg-border" />

          <div className="flex items-center gap-2">
            <button type="button" disabled={!!busy} onClick={saveDraft} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50">
              Save draft
            </button>
            <button type="button" disabled={!!busy} onClick={publish} className="rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50">
              Publish
            </button>
            {scope === "GLOBAL" && !isDefaultGlobal && publishedJson != null && (
              <button type="button" disabled={!!busy} onClick={makeDefault} className="rounded-lg border border-border px-3.5 py-2 text-sm font-semibold text-foreground transition hover:bg-surface-muted disabled:opacity-50">
                Set as site default
              </button>
            )}
          </div>
        </div>
      </header>

      {message && (
        <p className="flex items-center justify-between border-b border-border bg-accent-soft px-6 py-2.5 text-sm font-medium text-accent">
          {message}
          <button type="button" onClick={() => setMessage(null)} aria-label="Dismiss" className="rounded p-1 hover:bg-accent/10">
            <X size={14} weight="bold" />
          </button>
        </p>
      )}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[240px_1fr_360px]">
        {/* Left panel: presets + group navigator + version history */}
        <aside className="overflow-y-auto border-b border-border bg-surface p-5 lg:border-r lg:border-b-0">
          <p className="text-xs font-bold tracking-wider text-muted uppercase">Presets</p>
          <div className="mt-3 flex flex-col gap-1.5">
            {NOTE_THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="flex items-center gap-2.5 rounded-xl border border-transparent p-2 text-left transition hover:border-border hover:bg-surface-muted"
              >
                <span className="flex h-6 shrink-0 overflow-hidden rounded-md border border-border" style={{ width: 34 }}>
                  {[preset.values.colors.background, preset.values.colors.primaryAccent, preset.values.colors.highlightYellow].map((c, i) => (
                    <span key={i} className="h-full flex-1" style={{ backgroundColor: c }} />
                  ))}
                </span>
                <span className="truncate text-sm font-medium">{preset.name}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-xs font-bold tracking-wider text-muted uppercase">Groups</p>
          <div className="mt-3 flex flex-col gap-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveGroup(g.key)}
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                  activeGroup === g.key ? "bg-accent-soft text-accent" : "text-foreground/80 hover:bg-surface-muted"
                }`}
              >
                {g.label}
                {hasOverride(g.key) && <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-label="Overridden" />}
              </button>
            ))}
          </div>

          {versions.length > 0 && (
            <>
              <p className="mt-6 text-xs font-bold tracking-wider text-muted uppercase">Version history</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="text-muted">{new Date(v.createdAt).toLocaleString()}</span>
                    <button type="button" disabled={!!busy} onClick={() => restoreVersion(v.id)} className="shrink-0 rounded-md px-2 py-1 font-semibold text-accent transition hover:bg-accent-soft disabled:opacity-50">
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Center panel: live preview */}
        <main className="overflow-y-auto p-8">
          <div className="mx-auto transition-all duration-200" style={{ maxWidth: previewMaxWidth }}>
            <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-[0_1px_2px_rgba(15,23,42,.04),0_12px_32px_rgba(15,23,42,.08)]">
              <StructuredNoteRenderer note={SAMPLE_NOTE} theme={effectiveTheme} />
            </div>
          </div>
        </main>

        {/* Right panel: controls for the active group */}
        <aside className="overflow-y-auto border-t border-border bg-surface p-5 lg:border-t-0 lg:border-l">
          {scope !== "GLOBAL" && activeGroup !== "advanced" && (
            <div className="mb-4 flex items-center justify-between rounded-xl bg-surface-muted px-3 py-2.5 text-xs">
              <span className="font-medium text-muted">
                {hasOverride(activeGroup) ? "Overriding this group" : "Inheriting from global"}
              </span>
              <button type="button" onClick={() => resetGroup(activeGroup)} className="font-semibold text-accent hover:underline">
                Reset to inherited
              </button>
            </div>
          )}

          {activeGroup === "colors" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-1">
                {(Object.keys(effectiveTheme.colors) as (keyof ThemeValues["colors"])[]).map((key) => (
                  <ColorField
                    key={key}
                    label={key}
                    value={effectiveTheme.colors[key]}
                    onChange={(v) => updateGroupField("colors", key, v)}
                  />
                ))}
              </div>

              <div>
                <p className="text-xs font-bold tracking-wider text-muted uppercase">Contrast (WCAG AA)</p>
                <div className="mt-2.5 flex flex-col gap-2">
                  {contrastChecks.map((check) => {
                    const ratio = contrastRatio(check.a, check.b);
                    const passes = meetsWcagAa(check.a, check.b);
                    return (
                      <div key={check.label} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted">{check.label}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 font-semibold ${
                            passes ? "bg-success-soft text-success" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                          }`}
                        >
                          {ratio ? ratio.toFixed(2) : "—"}:1 {passes ? "AA" : "fail"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeGroup === "typography" && (
            <div className="flex flex-col gap-4">
              <SelectField label="Heading font" value={effectiveTheme.typography.headingFont} options={FONT_OPTIONS} onChange={(v) => updateGroupField("typography", "headingFont", v)} preview={fontFamilyFor(effectiveTheme.typography.headingFont)} />
              <SelectField label="Sub-heading font" value={effectiveTheme.typography.subHeadingFont} options={FONT_OPTIONS} onChange={(v) => updateGroupField("typography", "subHeadingFont", v)} preview={fontFamilyFor(effectiveTheme.typography.subHeadingFont)} />
              <SelectField label="Body font" value={effectiveTheme.typography.bodyFont} options={FONT_OPTIONS} onChange={(v) => updateGroupField("typography", "bodyFont", v)} preview={fontFamilyFor(effectiveTheme.typography.bodyFont)} />
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <NumberField label="Body size (px)" value={effectiveTheme.typography.bodySize} min={14} max={24} step={1} onChange={(v) => updateGroupField("typography", "bodySize", v)} />
                <NumberField label="Heading scale" value={effectiveTheme.typography.headingScale} min={1} max={2} step={0.05} onChange={(v) => updateGroupField("typography", "headingScale", v)} />
                <NumberField label="Line height" value={effectiveTheme.typography.lineHeight} min={1} max={2.2} step={0.05} onChange={(v) => updateGroupField("typography", "lineHeight", v)} />
                <NumberField label="Letter spacing (em)" value={effectiveTheme.typography.letterSpacing} min={-0.05} max={0.1} step={0.01} onChange={(v) => updateGroupField("typography", "letterSpacing", v)} />
                <NumberField label="Paragraph spacing (rem)" value={effectiveTheme.typography.paragraphSpacing} min={0.5} max={3} step={0.05} onChange={(v) => updateGroupField("typography", "paragraphSpacing", v)} />
                <NumberField label="List indent (px)" value={effectiveTheme.typography.listIndentation} min={0} max={40} step={1} onChange={(v) => updateGroupField("typography", "listIndentation", v)} />
              </div>
            </div>
          )}

          {activeGroup === "layout" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <NumberField label="Reading width (px)" value={effectiveTheme.layout.readingWidth} min={620} max={840} step={10} onChange={(v) => updateGroupField("layout", "readingWidth", v)} />
                <NumberField label="Page padding (px)" value={effectiveTheme.layout.pagePadding} min={0} max={64} step={2} onChange={(v) => updateGroupField("layout", "pagePadding", v)} />
                <NumberField label="Section spacing (px)" value={effectiveTheme.layout.sectionSpacing} min={0} max={64} step={2} onChange={(v) => updateGroupField("layout", "sectionSpacing", v)} />
                <NumberField label="Border radius (px)" value={effectiveTheme.layout.borderRadius} min={0} max={16} step={1} onChange={(v) => updateGroupField("layout", "borderRadius", v)} />
              </div>
              <SelectField label="Shadow intensity" value={effectiveTheme.layout.shadowIntensity} options={[{ value: "none", label: "None" }, { value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }]} onChange={(v) => updateGroupField("layout", "shadowIntensity", v)} />
              <SelectField label="Table of contents" value={effectiveTheme.layout.tocPosition} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "top", label: "Top" }, { value: "hidden", label: "Hidden" }]} onChange={(v) => updateGroupField("layout", "tocPosition", v)} />
              <CheckboxField label="Show borders" checked={effectiveTheme.layout.borderVisible} onChange={(v) => updateGroupField("layout", "borderVisible", v)} />
            </div>
          )}

          {activeGroup === "components" && (
            <div className="flex flex-col gap-3">
              {(Object.keys(COMPONENT_LABELS) as NoteComponentKey[]).map((key) => {
                const style = effectiveTheme.components[key] ?? { background: "#FFFFFF", border: "#E5E7EB", text: "#172033" };
                return (
                  <div key={key} className="rounded-xl border border-border p-3">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="flex h-7 w-10 shrink-0 items-center justify-center rounded-md border text-[10px] font-bold"
                        style={{ backgroundColor: style.background, borderColor: style.border, color: style.text }}
                      >
                        Aa
                      </span>
                      <p className="text-sm font-semibold">{COMPONENT_LABELS[key]}</p>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      <ColorField compact label="Background" value={style.background} onChange={(v) => updateComponentField(key, "background", v)} />
                      <ColorField compact label="Border" value={style.border} onChange={(v) => updateComponentField(key, "border", v)} />
                      <ColorField compact label="Text" value={style.text} onChange={(v) => updateComponentField(key, "text", v)} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeGroup === "visuals" && (
            <div className="flex flex-col gap-5">
              <SwatchRow label="Node colors" colors={effectiveTheme.visuals.nodeColors} onChange={(i, v) => updateArrayField("visuals", "nodeColors", i, v)} />
              <SwatchRow label="Timeline colors" colors={effectiveTheme.visuals.timelineColors} onChange={(i, v) => updateArrayField("visuals", "timelineColors", i, v)} />
              <SwatchRow label="Chart palette" colors={effectiveTheme.visuals.chartPalette} onChange={(i, v) => updateArrayField("visuals", "chartPalette", i, v)} />

              <div className="flex flex-col gap-1">
                <ColorField label="Connector color" value={effectiveTheme.visuals.connectorColor} onChange={(v) => updateGroupField("visuals", "connectorColor", v)} />
                <ColorField label="Diagram background" value={effectiveTheme.visuals.diagramBackground} onChange={(v) => updateGroupField("visuals", "diagramBackground", v)} />
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                <SelectField label="Flowchart nodes" value={effectiveTheme.visuals.flowchartNodeStyle} options={[{ value: "rounded", label: "Rounded" }, { value: "sharp", label: "Sharp" }]} onChange={(v) => updateGroupField("visuals", "flowchartNodeStyle", v)} />
                <SelectField label="Arrowheads" value={effectiveTheme.visuals.arrowheadStyle} options={[{ value: "classic", label: "Classic" }, { value: "round", label: "Round" }]} onChange={(v) => updateGroupField("visuals", "arrowheadStyle", v)} />
                <NumberField label="Connector width" value={effectiveTheme.visuals.connectorThickness} min={1} max={4} step={0.5} onChange={(v) => updateGroupField("visuals", "connectorThickness", v)} />
              </div>

              <div>
                <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">Highlighted node</p>
                <div className="rounded-xl border border-border p-3">
                  <span
                    className="mb-2.5 flex h-7 w-16 items-center justify-center rounded-md text-[10px] font-bold"
                    style={{
                      backgroundColor: effectiveTheme.visuals.highlightedNode.background,
                      border: `1px solid ${effectiveTheme.visuals.highlightedNode.border}`,
                      color: effectiveTheme.visuals.highlightedNode.text,
                    }}
                  >
                    Node
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    <ColorField compact label="Background" value={effectiveTheme.visuals.highlightedNode.background} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, background: v })} />
                    <ColorField compact label="Border" value={effectiveTheme.visuals.highlightedNode.border} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, border: v })} />
                    <ColorField compact label="Text" value={effectiveTheme.visuals.highlightedNode.text} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, text: v })} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeGroup === "advanced" && (
            <div className="flex flex-col gap-5">
              <div>
                <p className="text-xs font-bold tracking-wider text-muted uppercase">Import / export</p>
                <div className="mt-3 flex flex-col gap-2">
                  <button type="button" onClick={exportJson} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-surface-muted">
                    <DownloadSimple size={15} weight="bold" /> Download theme JSON
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) importJson(file);
                      e.target.value = "";
                    }}
                  />
                  <button type="button" onClick={() => importInputRef.current?.click()} disabled={!!busy} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-50">
                    <UploadSimple size={15} weight="bold" /> Upload theme JSON
                  </button>
                </div>
              </div>
              <p className="rounded-xl bg-surface-muted p-3 text-xs leading-5 text-muted">
                {isPreset
                  ? "This is a built-in preset — duplicate it from the Note Designer list to customize a copy."
                  : "Card radius stays clamped 0–16px and reading width 620–840px regardless of what's imported, per the design system's own limits."}
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SwatchRow({ label, colors, onChange }: { label: string; colors: string[]; onChange: (index: number, value: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-wider text-muted uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colors.map((c, i) => (
          <label key={i} className="relative">
            <input type="color" value={c} onChange={(e) => onChange(i, e.target.value)} className="sr-only" />
            <span
              className="block size-9 cursor-pointer rounded-lg border border-border ring-offset-2 transition hover:ring-2 hover:ring-accent/30"
              style={{ backgroundColor: c }}
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  const displayLabel = label.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());

  if (compact) {
    return (
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-muted">{label}</span>
        <span className="relative flex h-8 items-center overflow-hidden rounded-lg border border-border">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="size-8 shrink-0 cursor-pointer border-0" />
          <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 bg-background px-1.5 font-mono text-[11px] outline-none" />
        </span>
      </label>
    );
  }

  return (
    <label className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-foreground/80">{displayLabel}</span>
      <span className="flex items-center gap-2">
        <span className="relative flex h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border">
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="size-full cursor-pointer border-0 p-0" />
        </span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right font-mono text-xs outline-none focus:border-accent"
        />
      </span>
    </label>
  );
}

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="min-h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
  preview,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  preview?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 w-full rounded-lg border border-border bg-background px-2.5 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15"
        style={preview ? { fontFamily: preview } : undefined}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-9 items-center justify-between gap-2 rounded-lg border border-border px-3">
      <span className="text-sm text-foreground/80">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-accent" />
    </label>
  );
}
