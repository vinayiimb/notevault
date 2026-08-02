import { CALLOUT_ICONS, CANONICAL_HEADING, type CalloutKind } from "@/lib/content/callouts";

const VARIANT_TO_KIND: Record<"info" | "important" | "warning" | "tip" | "definition", CalloutKind> = {
  info: "note",
  important: "important",
  warning: "warning",
  tip: "tip",
  definition: "definition",
};

// The standalone form of the callout card Markdown content gets "for free"
// via a typed label paragraph (src/components/content/notes/notes-markdown.tsx)
// — used wherever a callout is authored directly as structured data (a
// StudyContentBlock) rather than detected from typed text, so there's no
// original label to echo and CANONICAL_HEADING (or an explicit title) is
// used instead.
export function CalloutBox({
  variant,
  title,
  content,
}: {
  variant: "info" | "important" | "warning" | "tip" | "definition";
  title?: string;
  content: string;
}) {
  const kind = VARIANT_TO_KIND[variant];
  const Icon = CALLOUT_ICONS[kind];
  return (
    <div className={`nt-card ${kind}`}>
      <div className="nt-card-head">
        <Icon size={14} weight="bold" />
        {title || CANONICAL_HEADING[kind]}
      </div>
      <p>{content}</p>
    </div>
  );
}
