"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  NOTES_LAB_THEMES,
  NOTES_LAB_COLORBLIND_THEMES,
  NOTES_LAB_TOKEN_KEYS,
  type NotesLabColorTokens,
  type NotesLabTheme,
} from "@/lib/content/theme-presets";

export type ThemeMode = "system" | "light" | "dark";

export type ContentTypography = {
  bodyFont: "inter" | "manrope" | "merriweather";
  fontSize: number; // px, body text
  lineHeight: number;
  paragraphSpacing: number; // rem
  contentWidth: number; // ch
  headingScale: number; // multiplier
};

export type ContentReadingPrefs = {
  themeId: string;
  mode: ThemeMode;
  customTokens: Partial<NotesLabColorTokens> | null;
  typography: ContentTypography;
  borderRadius: number; // px
  shadowLevel: "none" | "small" | "medium" | "large";
};

export const DEFAULT_TYPOGRAPHY: ContentTypography = {
  bodyFont: "inter",
  fontSize: 16,
  lineHeight: 1.7,
  paragraphSpacing: 1.1,
  contentWidth: 72,
  headingScale: 1,
};

const SUBJECT_THEME_ID = "subject";
const STORAGE_KEY = "notevault:reading-prefs:v1";

function defaultPrefs(hasSubjectTheme: boolean): ContentReadingPrefs {
  return {
    themeId: hasSubjectTheme ? SUBJECT_THEME_ID : "ocean",
    mode: "system",
    customTokens: null,
    typography: DEFAULT_TYPOGRAPHY,
    borderRadius: 14,
    shadowLevel: "small",
  };
}

// A tiny module-level store (one browser tab only ever needs one copy of
// this) read/written through useSyncExternalStore — the standard,
// hydration-safe way to read a client-only external source (localStorage)
// without the "setState synchronously in an effect" anti-pattern: React
// itself manages recomputing the snapshot and re-rendering subscribers.
let cachedRaw: Partial<ContentReadingPrefs> | null | undefined;
const listeners = new Set<() => void>();

function readStoredPrefs(): Partial<ContentReadingPrefs> | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSnapshot(): Partial<ContentReadingPrefs> | null {
  if (cachedRaw === undefined) cachedRaw = readStoredPrefs();
  return cachedRaw;
}

function getServerSnapshot(): Partial<ContentReadingPrefs> | null {
  return null;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function writeStoredPrefs(next: ContentReadingPrefs) {
  cachedRaw = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private browsing, quota) — the in-memory cache
    // above still keeps the change live for this page view.
  }
  for (const listener of listeners) listener();
}

function useSystemPrefersDark(): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    () => false,
  );
}

type Ctx = {
  prefs: ContentReadingPrefs;
  resolvedMode: "light" | "dark";
  tokens: NotesLabColorTokens;
  allThemes: NotesLabTheme[];
  hasSubjectTheme: boolean;
  setThemeId: (id: string) => void;
  setMode: (mode: ThemeMode) => void;
  setCustomTokens: (tokens: Partial<NotesLabColorTokens> | null) => void;
  setTypography: (typography: Partial<ContentTypography>) => void;
  setBorderRadius: (px: number) => void;
  setShadowLevel: (level: ContentReadingPrefs["shadowLevel"]) => void;
  resetToDefault: () => void;
};

const ContentThemeContext = createContext<Ctx | null>(null);

// Wraps rendered note content with the shared --nt-* CSS token system. When
// `subjectTheme` is provided (the admin's resolved Note Designer palette for
// this subject, via src/lib/content/theme-tokens.ts), it becomes an extra
// "Subject theme" entry at the top of the picker and the default selection —
// so every note renders with the admin's chosen look by default, exactly as
// the DB-backed theme system already promises, while a student can still
// pick one of the built-in presets or customize colors, persisted per
// browser (localStorage) as a personal override on top of that default.
export function ContentThemeProvider({
  subjectTheme,
  children,
  forceMode,
}: {
  subjectTheme?: { light: NotesLabColorTokens; dark: NotesLabColorTokens } | null;
  children: React.ReactNode;
  forceMode?: "light" | "dark";
}) {
  const hasSubjectTheme = Boolean(subjectTheme);
  const allThemes = useMemo<NotesLabTheme[]>(() => {
    const builtIns = [...NOTES_LAB_THEMES, ...NOTES_LAB_COLORBLIND_THEMES];
    if (!subjectTheme) return builtIns;
    const subjectEntry: NotesLabTheme = {
      id: SUBJECT_THEME_ID,
      label: "Subject theme",
      description: "The color palette set for this subject in Note Designer.",
      swatch: [subjectTheme.light.primary, subjectTheme.light.secondary, subjectTheme.light.background],
      light: subjectTheme.light,
      dark: subjectTheme.dark,
    };
    return [subjectEntry, ...builtIns];
  }, [subjectTheme]);

  const initial = useMemo(() => defaultPrefs(hasSubjectTheme), [hasSubjectTheme]);

  // On the server (and the client's first hydration pass), the stored
  // snapshot is always null, so `prefs` equals `initial` on both sides —
  // no hydration mismatch. Once mounted, useSyncExternalStore re-renders
  // with the real stored value, same as the old effect-based approach, but
  // without a manual setState call in an effect body.
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const prefs: ContentReadingPrefs = useMemo(
    () =>
      stored
        ? { ...initial, ...stored, typography: { ...DEFAULT_TYPOGRAPHY, ...stored.typography } }
        : initial,
    [stored, initial],
  );

  const systemPrefersDark = useSystemPrefersDark();
  const resolvedMode: "light" | "dark" = forceMode
    ? forceMode
    : prefs.mode === "system"
    ? (systemPrefersDark ? "dark" : "light")
    : prefs.mode;

  const tokens: NotesLabColorTokens = useMemo(() => {
    const theme = allThemes.find((t) => t.id === prefs.themeId) ?? allThemes[0];
    const base = resolvedMode === "dark" ? theme.dark : theme.light;
    return prefs.customTokens ? { ...base, ...prefs.customTokens } : base;
  }, [allThemes, prefs.themeId, prefs.customTokens, resolvedMode]);

  const update = useCallback((patch: Partial<ContentReadingPrefs> | ((p: ContentReadingPrefs) => ContentReadingPrefs)) => {
    const current = cachedRaw
      ? { ...defaultPrefs(hasSubjectTheme), ...cachedRaw, typography: { ...DEFAULT_TYPOGRAPHY, ...cachedRaw.typography } }
      : defaultPrefs(hasSubjectTheme);
    const next = typeof patch === "function" ? patch(current) : { ...current, ...patch };
    writeStoredPrefs(next);
  }, [hasSubjectTheme]);

  const setThemeId = useCallback((id: string) => update({ themeId: id }), [update]);
  const setMode = useCallback((mode: ThemeMode) => update({ mode }), [update]);
  const setCustomTokens = useCallback((t: Partial<NotesLabColorTokens> | null) => update({ customTokens: t }), [update]);
  const setTypography = useCallback(
    (t: Partial<ContentTypography>) => update((p) => ({ ...p, typography: { ...p.typography, ...t } })),
    [update],
  );
  const setBorderRadius = useCallback((px: number) => update({ borderRadius: px }), [update]);
  const setShadowLevel = useCallback((level: ContentReadingPrefs["shadowLevel"]) => update({ shadowLevel: level }), [update]);
  const resetToDefault = useCallback(() => writeStoredPrefs(defaultPrefs(hasSubjectTheme)), [hasSubjectTheme]);

  const value: Ctx = {
    prefs, resolvedMode, tokens, allThemes, hasSubjectTheme, setThemeId, setMode, setCustomTokens,
    setTypography, setBorderRadius, setShadowLevel, resetToDefault,
  };

  const style = useMemo(() => {
    const vars: Record<string, string> = {};
    for (const key of NOTES_LAB_TOKEN_KEYS) {
      vars[`--nt-${kebab(key)}`] = tokens[key];
    }
    vars["--nt-font-size"] = `${prefs.typography.fontSize}px`;
    vars["--nt-line-height"] = String(prefs.typography.lineHeight);
    vars["--nt-paragraph-spacing"] = `${prefs.typography.paragraphSpacing}rem`;
    vars["--nt-content-width"] = `${prefs.typography.contentWidth}ch`;
    vars["--nt-heading-scale"] = String(prefs.typography.headingScale);
    vars["--nt-radius"] = `${prefs.borderRadius}px`;
    vars["--nt-shadow"] = SHADOW_LEVELS[prefs.shadowLevel];
    vars["--nt-body-font"] = BODY_FONTS[prefs.typography.bodyFont];
    return vars as React.CSSProperties;
  }, [tokens, prefs]);

  return (
    <ContentThemeContext.Provider value={value}>
      <div
        data-nt-theme={prefs.themeId}
        data-nt-mode={resolvedMode}
        style={style}
        className="nt-root"
      >
        {children}
      </div>
    </ContentThemeContext.Provider>
  );
}

const SHADOW_LEVELS: Record<ContentReadingPrefs["shadowLevel"], string> = {
  none: "none",
  small: "0 1px 2px rgba(0,0,0,.06), 0 2px 8px rgba(0,0,0,.05)",
  medium: "0 2px 6px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.10)",
  large: "0 4px 12px rgba(0,0,0,.10), 0 16px 40px rgba(0,0,0,.16)",
};

const BODY_FONTS: Record<ContentTypography["bodyFont"], string> = {
  inter: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  manrope: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
  merriweather: "Georgia, 'Times New Roman', serif",
};

function kebab(s: string) {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

export function useContentTheme() {
  const ctx = useContext(ContentThemeContext);
  if (!ctx) throw new Error("useContentTheme must be used inside ContentThemeProvider");
  return ctx;
}
