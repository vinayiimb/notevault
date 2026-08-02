import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { StructuredNote, CalloutType } from "@/lib/note-schema";
import type { ThemeValues, NoteComponentKey } from "@/lib/note-theme";
import { VisualRenderer } from "./visuals/visual-renderer";

const FONT_VARS: Record<string, string> = {
  winkle: "var(--font-winkle)",
  inter: "var(--font-inter)",
  manrope: "var(--font-manrope)",
  fraunces: "var(--font-fraunces)",
  comic: "var(--font-comic)",
};

/** Resolves a theme's stored font key ("winkle", "inter", ...) to the actual
 * loaded CSS variable from src/app/layout.tsx, falling back to treating an
 * unrecognized value as a literal font-family string (e.g. a system font
 * name typed directly into the designer). */
export function fontFamilyFor(key: string) {
  return FONT_VARS[key] ?? key;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";
}

const CALLOUT_LABELS: Record<Exclude<CalloutType, "none">, string> = {
  definition: "Definition",
  important: "Important",
  warning: "Warning",
  "exam-tip": "Exam tip",
};
const CALLOUT_COMPONENT_KEY: Record<Exclude<CalloutType, "none">, NoteComponentKey> = {
  definition: "definitions",
  important: "important",
  warning: "warning",
  "exam-tip": "examTip",
};

function ComponentCard({
  componentKey,
  theme,
  children,
  className = "",
}: {
  componentKey: NoteComponentKey;
  theme: ThemeValues;
  children: React.ReactNode;
  className?: string;
}) {
  const style = theme.components[componentKey];
  return (
    <div
      className={`rounded-[var(--note-radius)] p-5 sm:p-6 ${theme.layout.borderVisible ? "border" : ""} ${className}`}
      style={{
        backgroundColor: style?.background ?? theme.colors.surface,
        borderColor: style?.border ?? theme.colors.border,
        color: style?.text ?? theme.colors.primaryText,
      }}
    >
      {children}
    </div>
  );
}

export function StructuredNoteRenderer({
  note,
  theme,
  breadcrumb,
}: {
  note: StructuredNote;
  theme: ThemeValues;
  breadcrumb?: React.ReactNode;
}) {
  const shadowClass =
    theme.layout.shadowIntensity === "none"
      ? ""
      : theme.layout.shadowIntensity === "medium"
        ? "shadow-md"
        : "shadow-sm";

  const toc = note.sections.map((s) => ({ id: s.id || slugify(s.heading), heading: s.heading }));

  return (
    <div
      className="mx-auto"
      style={{
        maxWidth: theme.layout.readingWidth,
        backgroundColor: theme.colors.background,
        color: theme.colors.primaryText,
        fontFamily: fontFamilyFor(theme.typography.bodyFont),
        fontSize: theme.typography.bodySize,
        lineHeight: theme.typography.lineHeight,
        letterSpacing: `${theme.typography.letterSpacing}em`,
        // Custom property consumed by ComponentCard/inner elements so every
        // themed surface shares one radius without threading it as a prop.
        ["--note-radius" as string]: `${theme.layout.borderRadius}px`,
      }}
    >
      <div style={{ padding: theme.layout.pagePadding }}>
        {/* 1. Breadcrumb and subject */}
        <div className="flex flex-wrap items-center gap-1.5 text-sm" style={{ color: theme.colors.secondaryText }}>
          {breadcrumb}
          <span>{note.metadata.subject}</span>
          {note.metadata.chapter && (
            <>
              <CaretRight size={12} weight="bold" />
              <span>{note.metadata.chapter}</span>
            </>
          )}
        </div>

        {/* 2. Large note title */}
        <h1
          className="mt-2 font-semibold tracking-tight"
          style={{
            fontFamily: fontFamilyFor(theme.typography.headingFont),
            fontSize: theme.typography.bodySize * theme.typography.headingScale * 1.6,
          }}
        >
          {note.metadata.title}
        </h1>
        <p className="mt-1 text-sm" style={{ color: theme.colors.secondaryText }}>
          {note.metadata.estimatedReadingMinutes} min read
          {note.metadata.tags.length > 0 && ` · ${note.metadata.tags.join(", ")}`}
        </p>

        {/* 3. Short summary */}
        <p className="mt-6 leading-relaxed" style={{ marginTop: `${theme.typography.paragraphSpacing}rem` }}>
          {note.summary}
        </p>

        {/* 4. Key facts */}
        {note.keyFacts.length > 0 && (
          <ComponentCard componentKey="keyFacts" theme={theme} className="mt-6">
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              Key facts
            </p>
            <ul className="mt-2 flex flex-col gap-1.5" style={{ paddingLeft: theme.typography.listIndentation }}>
              {note.keyFacts.map((fact, i) => (
                <li key={i} className="list-disc">
                  {fact}
                </li>
              ))}
            </ul>
          </ComponentCard>
        )}

        {/* 5. Table of contents */}
        {toc.length > 1 && theme.layout.tocPosition !== "hidden" && (
          <nav
            aria-label="On this page"
            className={`mt-6 rounded-[var(--note-radius)] p-4 text-sm ${theme.layout.borderVisible ? "border" : ""}`}
            style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.surface }}
          >
            <p className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              On this page
            </p>
            <ol className="mt-2 flex flex-col gap-1">
              {toc.map((item) => (
                <li key={item.id}>
                  <a href={`#${item.id}`} style={{ color: theme.colors.link }} className="hover:underline">
                    {item.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        )}

        {/* 6. Main explanation, divided into sections with inline callouts */}
        <div className="mt-8 flex flex-col" style={{ gap: theme.layout.sectionSpacing }}>
          {note.sections.map((section) => {
            const id = section.id || slugify(section.heading);
            return (
              <section key={id} id={id} className="scroll-mt-24">
                <h2
                  className="font-semibold"
                  style={{ fontFamily: fontFamilyFor(theme.typography.subHeadingFont), fontSize: theme.typography.bodySize * theme.typography.headingScale }}
                >
                  {section.heading}
                </h2>
                <p className="mt-3 leading-relaxed">{section.content}</p>
                {section.callout && section.callout.type !== "none" && (
                  <ComponentCard
                    componentKey={CALLOUT_COMPONENT_KEY[section.callout.type]}
                    theme={theme}
                    className="mt-4"
                  >
                    <p className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
                      {CALLOUT_LABELS[section.callout.type]}
                    </p>
                    <p className="mt-1.5 leading-relaxed">{section.callout.text}</p>
                  </ComponentCard>
                )}
              </section>
            );
          })}
        </div>

        {/* 7. Definitions and formulas */}
        {(note.definitions.length > 0 || note.formulas.length > 0) && (
          <div className="mt-10 flex flex-col gap-4">
            {note.definitions.length > 0 && (
              <ComponentCard componentKey="definitions" theme={theme}>
                <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
                  Definitions
                </h3>
                <dl className="mt-2 flex flex-col gap-2.5">
                  {note.definitions.map((d) => (
                    <div key={d.term}>
                      <dt className="font-semibold">{d.term}</dt>
                      <dd className="mt-0.5">{d.definition}</dd>
                    </div>
                  ))}
                </dl>
              </ComponentCard>
            )}
            {note.formulas.length > 0 && (
              <ComponentCard componentKey="formulas" theme={theme}>
                <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
                  Formulas
                </h3>
                <ul className="mt-2 flex flex-col gap-3">
                  {note.formulas.map((f) => (
                    <li key={f.name}>
                      <p className="font-semibold">{f.name}</p>
                      <p className="mt-0.5 overflow-x-auto rounded-lg bg-black/5 px-3 py-1.5 font-mono text-sm">
                        {f.expression}
                      </p>
                      {f.description && <p className="mt-1 text-sm" style={{ color: theme.colors.secondaryText }}>{f.description}</p>}
                    </li>
                  ))}
                </ul>
              </ComponentCard>
            )}
          </div>
        )}

        {/* 8. Relevant visual */}
        {note.visual.type !== "none" && (
          <div className="mt-10">
            <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              {note.visual.title}
            </h3>
            <div
              className={`mt-3 rounded-[var(--note-radius)] p-4 ${theme.layout.borderVisible ? "border" : ""} ${shadowClass}`}
              style={{ backgroundColor: theme.visuals.diagramBackground, borderColor: theme.colors.border }}
            >
              <VisualRenderer visual={note.visual} visuals={theme.visuals} />
            </div>
          </div>
        )}

        {/* 9. Examples */}
        {note.examples.length > 0 && (
          <ComponentCard componentKey="examples" theme={theme} className="mt-10">
            <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              Examples
            </h3>
            <ul className="mt-2 flex flex-col gap-4">
              {note.examples.map((ex, i) => (
                <li key={i}>
                  {ex.title && <p className="font-semibold">{ex.title}</p>}
                  <p className="mt-1">{ex.prompt}</p>
                  <p className="mt-1.5 rounded-lg bg-black/5 px-3 py-2 text-sm">{ex.solution}</p>
                </li>
              ))}
            </ul>
          </ComponentCard>
        )}

        {/* 10. Common mistakes */}
        {note.commonMistakes.length > 0 && (
          <ComponentCard componentKey="warning" theme={theme} className="mt-10">
            <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              Common mistakes
            </h3>
            <ul className="mt-2 flex flex-col gap-1.5" style={{ paddingLeft: theme.typography.listIndentation }}>
              {note.commonMistakes.map((mistake, i) => (
                <li key={i} className="list-disc">
                  {mistake}
                </li>
              ))}
            </ul>
          </ComponentCard>
        )}

        {/* 11. Final takeaway */}
        <ComponentCard componentKey="takeaway" theme={theme} className="mt-10">
          <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
            Takeaway
          </h3>
          <p className="mt-1.5 leading-relaxed font-medium">{note.takeaway}</p>
        </ComponentCard>

        {/* 12. Sources */}
        {note.sources.length > 0 && (
          <ComponentCard componentKey="sources" theme={theme} className="mt-6">
            <h3 className="text-xs font-bold tracking-wide uppercase" style={{ color: theme.colors.secondaryText }}>
              Sources
            </h3>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {note.sources.map((source, i) => (
                <li key={i}>{source}</li>
              ))}
            </ul>
          </ComponentCard>
        )}
      </div>
    </div>
  );
}
