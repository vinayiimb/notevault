type SolutionSheetVisual = {
  title: string;
  steps: { step: number; description: string; expression: string | null }[];
  annotations: string[];
};

export function SolutionSheetVisual({ visual }: { visual: SolutionSheetVisual }) {
  return (
    <div>
      <ol className="flex flex-col gap-3">
        {visual.steps.map((step) => (
          <li key={step.step} className="flex gap-3 rounded-xl border border-border p-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold">
              {step.step}
            </span>
            <div className="min-w-0 flex-1">
              <p className="leading-relaxed text-foreground">{step.description}</p>
              {step.expression && (
                <p className="mt-1.5 overflow-x-auto rounded-lg bg-surface-muted px-3 py-1.5 font-mono text-sm">
                  {step.expression}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>
      {visual.annotations.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1 text-sm text-muted">
          {visual.annotations.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
