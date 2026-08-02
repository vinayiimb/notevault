"use client";

import { useState } from "react";
import { Check, Desktop, Moon, Palette, Sun } from "@phosphor-icons/react";
import { useContentTheme } from "./theme-provider";
import { ContentThemeCustomizer } from "./theme-customizer-panel";

export function ContentThemeSwitcher() {
  const { prefs, setThemeId, setMode, allThemes } = useContentTheme();
  const [open, setOpen] = useState(false);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="nt-btn nt-btn-ghost"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Choose a color theme"
      >
        <Palette size={16} weight="bold" />
        <span className="hidden sm:inline">Theme</span>
      </button>

      {open && (
        <>
          <button
            aria-label="Close theme menu"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            className="nt-glass absolute right-0 z-40 mt-2 w-80 rounded-2xl p-3 shadow-lg"
            style={{ boxShadow: "var(--nt-shadow)" }}
            role="menu"
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--nt-text-muted)" }}>
                Appearance
              </span>
              <div className="flex gap-1">
                {(
                  [
                    ["system", Desktop, "Match device"],
                    ["light", Sun, "Light"],
                    ["dark", Moon, "Dark"],
                  ] as const
                ).map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-label={label}
                    aria-pressed={prefs.mode === mode}
                    onClick={() => setMode(mode)}
                    className="nt-btn nt-btn-ghost !p-1.5"
                    style={prefs.mode === mode ? { color: "var(--nt-primary)", borderColor: "var(--nt-primary)" } : undefined}
                  >
                    <Icon size={14} weight="bold" />
                  </button>
                ))}
              </div>
            </div>

            <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto p-1">
              {allThemes.map((theme) => {
                const active = prefs.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      setThemeId(theme.id);
                      setOpen(false);
                    }}
                    className="flex flex-col gap-1.5 rounded-xl border p-2 text-left transition"
                    style={{
                      borderColor: active ? "var(--nt-primary)" : "var(--nt-border)",
                      background: active ? "color-mix(in srgb, var(--nt-primary) 8%, var(--nt-surface))" : "var(--nt-surface)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {theme.swatch.map((c, i) => (
                          <span key={i} className="size-3.5 rounded-full border" style={{ background: c, borderColor: "rgba(0,0,0,.08)" }} />
                        ))}
                      </div>
                      {active && <Check size={13} weight="bold" style={{ color: "var(--nt-primary)" }} />}
                    </div>
                    <span className="text-xs font-semibold" style={{ color: "var(--nt-text)" }}>{theme.label}</span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="nt-btn nt-btn-ghost mt-2 w-full justify-center"
              onClick={() => {
                setCustomizerOpen(true);
                setOpen(false);
              }}
            >
              Customize theme…
            </button>
          </div>
        </>
      )}

      {customizerOpen && <ContentThemeCustomizer onClose={() => setCustomizerOpen(false)} />}
    </div>
  );
}
