"use client";

import { useEffect, useId, useRef, useState } from "react";

// Renders a ```mermaid code block (from admin-pasted notes) into an actual
// diagram client-side, instead of showing the raw Mermaid source as text.
export function MermaidDiagram({ chart }: { chart: string }) {
  const id = useId().replace(/:/g, "-");
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      try {
        const { svg } = await mermaid.render(`mermaid-${id}`, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setError("Couldn't render this diagram.");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (error) {
    return <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-xs">{chart}</pre>;
  }
  return <div ref={ref} className="my-4 flex justify-center overflow-x-auto" />;
}
