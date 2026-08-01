"use client";

import { ArrowCounterClockwise, X } from "@phosphor-icons/react";
import { useContentTheme } from "./theme-provider";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";

const COLOR_FIELDS: { key: keyof NotesLabColorTokens; label: string }[] = [
  { key: "primary", label: "Primary" },
  { key: "secondary", label: "Secondary" },
  { key: "accent", label: "Accent" },
  { key: "background", label: "Background" },
  { key: "surface", label: "Card surface" },
  { key: "text", label: "Text" },
  { key: "border", label: "Border" },
];

const FONT_OPTIONS = [
  { value: "inter", label: "Inter (clean, body text)" },
  { value: "manrope", label: "Manrope (friendly, rounded)" },
  { value: "merriweather", label: "Merriweather (serif, long-form)" },
] as const;

export function ContentThemeCustomizer({ onClose }: { onClose: () => void }) {
  const { tokens, prefs, hasSubjectTheme, setCustomTokens, setTypography, setBorderRadius, setShadowLevel, resetToDefault } =
    useContentTheme();

  function updateColor(key: keyof NotesLabColorTokens, value: string) {
    setCustomTokens({ ...(prefs.customTokens ?? {}), [key]: value });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close customizer" className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-l p-5"
        style={{ background: "var(--nt-surface)", borderColor: "var(--nt-border)", color: "var(--nt-text)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Customize theme</h2>
          <button type="button" onClick={onClose} className="nt-btn nt-btn-ghost !p-1.5" aria-label="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Live preview */}
        <div className="nt-card definition mb-5">
          <div className="nt-card-head">Live preview</div>
          <p style={{ color: "var(--nt-text)" }}>This card, the page behind this panel, and every note update instantly as you adjust colors below.</p>
          <button type="button" className="nt-btn nt-btn-primary mt-2">Sample button</button>
        </div>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--nt-text-muted)" }}>Colors</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {COLOR_FIELDS.map((f) => (
              <label key={f.key} className="flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={toHex(tokens[f.key])}
                  onChange={(e) => updateColor(f.key, e.target.value)}
                  className="size-8 shrink-0 cursor-pointer rounded-lg border"
                  style={{ borderColor: "var(--nt-border)" }}
                  aria-label={f.label}
                />
                <span>{f.label}</span>
              </label>
            ))}
          </div>
        </section>

        <section className="mb-5">
          <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--nt-text-muted)" }}>Typography</h3>
          <label className="mb-2 block text-sm">
            Body font
            <select
              value={prefs.typography.bodyFont}
              onChange={(e) => setTypography({ bodyFont: e.target.value as (typeof FONT_OPTIONS)[number]["value"] })}
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--nt-border)", background: "var(--nt-surface)" }}
            >
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </label>
          <RangeField
            label={`Font size (${prefs.typography.fontSize}px)`}
            min={14} max={20} step={1}
            value={prefs.typography.fontSize}
            onChange={(v) => setTypography({ fontSize: v })}
          />
          <RangeField
            label={`Line height (${prefs.typography.lineHeight.toFixed(1)})`}
            min={1.4} max={2.0} step={0.1}
            value={prefs.typography.lineHeight}
            onChange={(v) => setTypography({ lineHeight: v })}
          />
          <RangeField
            label={`Content width (${prefs.typography.contentWidth}ch)`}
            min={56} max={96} step={2}
            value={prefs.typography.contentWidth}
            onChange={(v) => setTypography({ contentWidth: v })}
          />
          <RangeField
            label={`Heading scale (${prefs.typography.headingScale.toFixed(2)}×)`}
            min={0.85} max={1.3} step={0.05}
            value={prefs.typography.headingScale}
            onChange={(v) => setTypography({ headingScale: v })}
          />
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--nt-text-muted)" }}>Layout</h3>
          <RangeField
            label={`Corner roundness (${prefs.borderRadius}px)`}
            min={0} max={24} step={2}
            value={prefs.borderRadius}
            onChange={setBorderRadius}
          />
          <label className="mb-1 block text-sm">
            Shadow strength
            <select
              value={prefs.shadowLevel}
              onChange={(e) => setShadowLevel(e.target.value as typeof prefs.shadowLevel)}
              className="mt-1 w-full rounded-lg border px-2 py-1.5 text-sm"
              style={{ borderColor: "var(--nt-border)", background: "var(--nt-surface)" }}
            >
              <option value="none">None</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
        </section>

        <button
          type="button"
          onClick={resetToDefault}
          className="nt-btn nt-btn-ghost w-full justify-center"
        >
          <ArrowCounterClockwise size={15} weight="bold" />
          {hasSubjectTheme ? "Reset to subject theme" : "Reset to default"}
        </button>
      </div>
    </div>
  );
}

function RangeField({
  label, min, max, step, value, onChange,
}: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mb-2.5 block text-sm">
      {label}
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--nt-primary)]"
      />
    </label>
  );
}

// <input type="color"> requires a #rrggbb value; our tokens are already hex
// in every preset, but color-mix()/named values would break the picker, so
// this guards against anything that isn't already a plain hex string.
function toHex(value: string): string {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : "#888888";
}
