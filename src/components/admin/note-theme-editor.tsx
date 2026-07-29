"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowClockwise,
  ArrowLeft,
  Check,
  DesktopTower,
  DeviceMobile,
  DeviceTablet,
  DownloadSimple,
  UploadSimple,
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

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-6 py-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/note-themes" className="flex items-center gap-1 text-sm text-muted hover:text-foreground">
            <ArrowLeft size={16} /> Note Designer
          </Link>
          <div>
            <p className="font-semibold">
              {name} <span className="text-xs font-normal text-muted">({scope.toLowerCase()}{subjectName ? ` · ${subjectName}` : ""})</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={undo} disabled={historyIndex === 0} className="rounded-lg p-2 text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Undo">
            <ArrowCounterClockwise size={16} />
          </button>
          <button type="button" onClick={redo} disabled={historyIndex >= history.length - 1} className="rounded-lg p-2 text-muted hover:bg-surface-muted disabled:opacity-30" aria-label="Redo">
            <ArrowClockwise size={16} />
          </button>
          <div className="mx-1 flex items-center gap-1 rounded-lg border border-border p-0.5">
            <button type="button" onClick={() => setPreviewWidth("desktop")} className={`rounded-md p-1.5 ${previewWidth === "desktop" ? "bg-accent-soft text-accent" : "text-muted"}`} aria-label="Desktop preview">
              <DesktopTower size={15} />
            </button>
            <button type="button" onClick={() => setPreviewWidth("tablet")} className={`rounded-md p-1.5 ${previewWidth === "tablet" ? "bg-accent-soft text-accent" : "text-muted"}`} aria-label="Tablet preview">
              <DeviceTablet size={15} />
            </button>
            <button type="button" onClick={() => setPreviewWidth("mobile")} className={`rounded-md p-1.5 ${previewWidth === "mobile" ? "bg-accent-soft text-accent" : "text-muted"}`} aria-label="Mobile preview">
              <DeviceMobile size={15} />
            </button>
          </div>
          <button type="button" disabled={!!busy} onClick={saveDraft} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:opacity-50">
            Save draft
          </button>
          <button type="button" disabled={!!busy} onClick={publish} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:opacity-50">
            Publish
          </button>
          {scope === "GLOBAL" && !isDefaultGlobal && publishedJson != null && (
            <button type="button" disabled={!!busy} onClick={makeDefault} className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:opacity-50">
              Set as site default
            </button>
          )}
        </div>
      </header>

      {message && <p className="border-b border-border bg-accent-soft px-6 py-2 text-sm text-accent">{message}</p>}

      <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[220px_1fr_320px]">
        {/* Left panel: presets + group navigator + version history */}
        <aside className="overflow-y-auto border-b border-border bg-surface-muted/40 p-4 lg:border-r lg:border-b-0">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Presets</p>
          <div className="mt-2 flex flex-col gap-1">
            {NOTE_THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => applyPreset(preset.values)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface"
              >
                <span className="size-3 rounded-full border border-black/10" style={{ backgroundColor: preset.values.colors.primaryAccent }} />
                Apply {preset.name}
              </button>
            ))}
          </div>

          <p className="mt-5 text-xs font-bold tracking-wide text-muted uppercase">Groups</p>
          <div className="mt-2 flex flex-col gap-1">
            {GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setActiveGroup(g.key)}
                className={`rounded-lg px-2 py-1.5 text-left text-sm ${activeGroup === g.key ? "bg-accent-soft font-semibold text-accent" : "hover:bg-surface"}`}
              >
                {g.label}
                {scope !== "GLOBAL" && g.key !== "advanced" && (draft as Record<string, unknown>)[g.key] ? " •" : ""}
              </button>
            ))}
          </div>

          {versions.length > 0 && (
            <>
              <p className="mt-5 text-xs font-bold tracking-wide text-muted uppercase">Version history</p>
              <ul className="mt-2 flex flex-col gap-1">
                {versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{new Date(v.createdAt).toLocaleString()}</span>
                    <button type="button" disabled={!!busy} onClick={() => restoreVersion(v.id)} className="rounded px-1.5 py-0.5 font-semibold text-accent hover:bg-accent-soft disabled:opacity-50">
                      Restore
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>

        {/* Center panel: live preview */}
        <main className="overflow-y-auto bg-surface-muted/30 p-6">
          <div className="mx-auto transition-all" style={{ maxWidth: previewMaxWidth }}>
            <div className="rounded-2xl border border-border bg-white shadow-sm">
              <StructuredNoteRenderer note={SAMPLE_NOTE} theme={effectiveTheme} />
            </div>
          </div>
        </main>

        {/* Right panel: controls for the active group */}
        <aside className="overflow-y-auto border-t border-border bg-surface p-4 lg:border-t-0 lg:border-l">
          {scope !== "GLOBAL" && activeGroup !== "advanced" && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-surface-muted p-2 text-xs">
              <span>{(draft as Record<string, unknown>)[activeGroup] ? "Overriding this group" : "Inheriting from global"}</span>
              <button type="button" onClick={() => resetGroup(activeGroup)} className="font-semibold text-accent hover:underline">
                Reset to inherited
              </button>
            </div>
          )}

          {activeGroup === "colors" && (
            <div className="flex flex-col gap-3">
              {(Object.keys(effectiveTheme.colors) as (keyof ThemeValues["colors"])[]).map((key) => (
                <ColorField
                  key={key}
                  label={key}
                  value={effectiveTheme.colors[key]}
                  onChange={(v) => updateGroupField("colors", key, v)}
                />
              ))}
              <p className="mt-2 text-xs font-bold tracking-wide text-muted uppercase">Contrast (WCAG AA)</p>
              {contrastChecks.map((check) => {
                const ratio = contrastRatio(check.a, check.b);
                const passes = meetsWcagAa(check.a, check.b);
                return (
                  <div key={check.label} className="flex items-center justify-between text-xs">
                    <span className="text-muted">{check.label}</span>
                    <span className={passes ? "font-semibold text-success" : "font-semibold text-red-600"}>
                      {ratio ? ratio.toFixed(2) : "—"}:1 {passes ? <Check size={11} weight="bold" className="inline" /> : "fail"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {activeGroup === "typography" && (
            <div className="flex flex-col gap-3">
              <SelectField label="Body font" value={effectiveTheme.typography.bodyFont} options={FONT_OPTIONS} onChange={(v) => updateGroupField("typography", "bodyFont", v)} preview={fontFamilyFor(effectiveTheme.typography.bodyFont)} />
              <SelectField label="Heading font" value={effectiveTheme.typography.headingFont} options={FONT_OPTIONS} onChange={(v) => updateGroupField("typography", "headingFont", v)} preview={fontFamilyFor(effectiveTheme.typography.headingFont)} />
              <NumberField label="Body size (px)" value={effectiveTheme.typography.bodySize} min={14} max={24} step={1} onChange={(v) => updateGroupField("typography", "bodySize", v)} />
              <NumberField label="Heading scale" value={effectiveTheme.typography.headingScale} min={1} max={2} step={0.05} onChange={(v) => updateGroupField("typography", "headingScale", v)} />
              <NumberField label="Line height" value={effectiveTheme.typography.lineHeight} min={1} max={2.2} step={0.05} onChange={(v) => updateGroupField("typography", "lineHeight", v)} />
              <NumberField label="Letter spacing (em)" value={effectiveTheme.typography.letterSpacing} min={-0.05} max={0.1} step={0.01} onChange={(v) => updateGroupField("typography", "letterSpacing", v)} />
              <NumberField label="Paragraph spacing (rem)" value={effectiveTheme.typography.paragraphSpacing} min={0.5} max={3} step={0.05} onChange={(v) => updateGroupField("typography", "paragraphSpacing", v)} />
              <NumberField label="List indentation (px)" value={effectiveTheme.typography.listIndentation} min={0} max={40} step={1} onChange={(v) => updateGroupField("typography", "listIndentation", v)} />
            </div>
          )}

          {activeGroup === "layout" && (
            <div className="flex flex-col gap-3">
              <NumberField label="Reading width (px)" value={effectiveTheme.layout.readingWidth} min={620} max={840} step={10} onChange={(v) => updateGroupField("layout", "readingWidth", v)} />
              <NumberField label="Page padding (px)" value={effectiveTheme.layout.pagePadding} min={0} max={64} step={2} onChange={(v) => updateGroupField("layout", "pagePadding", v)} />
              <NumberField label="Section spacing (px)" value={effectiveTheme.layout.sectionSpacing} min={0} max={64} step={2} onChange={(v) => updateGroupField("layout", "sectionSpacing", v)} />
              <NumberField label="Border radius (px)" value={effectiveTheme.layout.borderRadius} min={0} max={16} step={1} onChange={(v) => updateGroupField("layout", "borderRadius", v)} />
              <CheckboxField label="Show borders" checked={effectiveTheme.layout.borderVisible} onChange={(v) => updateGroupField("layout", "borderVisible", v)} />
              <SelectField label="Shadow intensity" value={effectiveTheme.layout.shadowIntensity} options={[{ value: "none", label: "None" }, { value: "subtle", label: "Subtle" }, { value: "medium", label: "Medium" }]} onChange={(v) => updateGroupField("layout", "shadowIntensity", v)} />
              <SelectField label="Table of contents" value={effectiveTheme.layout.tocPosition} options={[{ value: "left", label: "Left" }, { value: "right", label: "Right" }, { value: "top", label: "Top" }, { value: "hidden", label: "Hidden" }]} onChange={(v) => updateGroupField("layout", "tocPosition", v)} />
            </div>
          )}

          {activeGroup === "components" && (
            <div className="flex flex-col gap-4">
              {(Object.keys(COMPONENT_LABELS) as NoteComponentKey[]).map((key) => (
                <div key={key} className="rounded-lg border border-border p-2">
                  <p className="text-xs font-semibold">{COMPONENT_LABELS[key]}</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                    <ColorField compact label="bg" value={effectiveTheme.components[key]?.background ?? "#FFFFFF"} onChange={(v) => updateComponentField(key, "background", v)} />
                    <ColorField compact label="border" value={effectiveTheme.components[key]?.border ?? "#E5E7EB"} onChange={(v) => updateComponentField(key, "border", v)} />
                    <ColorField compact label="text" value={effectiveTheme.components[key]?.text ?? "#172033"} onChange={(v) => updateComponentField(key, "text", v)} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeGroup === "visuals" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold">Node colors</p>
              <div className="grid grid-cols-5 gap-1.5">
                {effectiveTheme.visuals.nodeColors.map((c, i) => (
                  <input key={i} type="color" value={c} onChange={(e) => updateArrayField("visuals", "nodeColors", i, e.target.value)} className="h-8 w-full rounded border border-border" />
                ))}
              </div>
              <SelectField label="Flowchart node style" value={effectiveTheme.visuals.flowchartNodeStyle} options={[{ value: "rounded", label: "Rounded" }, { value: "sharp", label: "Sharp" }]} onChange={(v) => updateGroupField("visuals", "flowchartNodeStyle", v)} />
              <ColorField label="Connector color" value={effectiveTheme.visuals.connectorColor} onChange={(v) => updateGroupField("visuals", "connectorColor", v)} />
              <NumberField label="Connector thickness" value={effectiveTheme.visuals.connectorThickness} min={1} max={4} step={0.5} onChange={(v) => updateGroupField("visuals", "connectorThickness", v)} />
              <SelectField label="Arrowhead style" value={effectiveTheme.visuals.arrowheadStyle} options={[{ value: "classic", label: "Classic" }, { value: "round", label: "Round" }]} onChange={(v) => updateGroupField("visuals", "arrowheadStyle", v)} />
              <ColorField label="Diagram background" value={effectiveTheme.visuals.diagramBackground} onChange={(v) => updateGroupField("visuals", "diagramBackground", v)} />
              <p className="text-xs font-semibold">Timeline colors</p>
              <div className="grid grid-cols-4 gap-1.5">
                {effectiveTheme.visuals.timelineColors.map((c, i) => (
                  <input key={i} type="color" value={c} onChange={(e) => updateArrayField("visuals", "timelineColors", i, e.target.value)} className="h-8 w-full rounded border border-border" />
                ))}
              </div>
              <p className="text-xs font-semibold">Chart palette</p>
              <div className="grid grid-cols-4 gap-1.5">
                {effectiveTheme.visuals.chartPalette.map((c, i) => (
                  <input key={i} type="color" value={c} onChange={(e) => updateArrayField("visuals", "chartPalette", i, e.target.value)} className="h-8 w-full rounded border border-border" />
                ))}
              </div>
              <p className="text-xs font-semibold">Highlighted node</p>
              <div className="grid grid-cols-3 gap-1.5">
                <ColorField compact label="bg" value={effectiveTheme.visuals.highlightedNode.background} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, background: v })} />
                <ColorField compact label="border" value={effectiveTheme.visuals.highlightedNode.border} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, border: v })} />
                <ColorField compact label="text" value={effectiveTheme.visuals.highlightedNode.text} onChange={(v) => updateGroupField("visuals", "highlightedNode", { ...effectiveTheme.visuals.highlightedNode, text: v })} />
              </div>
            </div>
          )}

          {activeGroup === "advanced" && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-bold tracking-wide text-muted uppercase">Import / export</p>
                <div className="mt-2 flex flex-col gap-2">
                  <button type="button" onClick={exportJson} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted">
                    <DownloadSimple size={15} /> Download theme JSON
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
                  <button type="button" onClick={() => importInputRef.current?.click()} disabled={!!busy} className="flex items-center justify-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-surface-muted disabled:opacity-50">
                    <UploadSimple size={15} /> Upload theme JSON
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted">
                {isPreset ? "This is a built-in preset — duplicate it from the Note Designer list to customize a copy." : "Card radius stays clamped 0–16px and reading width 620–840px regardless of what's imported, per the design system's own limits."}
              </p>
            </div>
          )}
        </aside>
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
  return (
    <label className="flex items-center gap-2 text-xs">
      {!compact && <span className="w-32 shrink-0 text-muted capitalize">{label.replace(/([A-Z])/g, " $1")}</span>}
      <input type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-7 w-9 shrink-0 rounded border border-border" />
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className="min-w-0 flex-1 rounded border border-border bg-background px-1.5 py-1 font-mono text-xs" />
      {compact && <span className="shrink-0 text-muted">{label}</span>}
    </label>
  );
}

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-20 rounded border border-border bg-background px-1.5 py-1 text-xs"
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
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-muted">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded border border-border bg-background px-1.5 py-1 text-xs" style={preview ? { fontFamily: preview } : undefined}>
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
    <label className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4" />
    </label>
  );
}
