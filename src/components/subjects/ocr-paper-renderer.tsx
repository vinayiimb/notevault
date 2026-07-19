type OcrBlock =
  | { kind: "meta"; lines: string[] }
  | { kind: "question"; marker: string; text: string }
  | { kind: "subquestion"; marker: string; text: string }
  | { kind: "body"; lines: string[] }
  | { kind: "page"; text: string };

const META_LABEL = /^(?:sr\.?\s*no|serial|unique paper code|name of (?:the )?(?:paper|course)|course|subject|semester|duration|time|maximum marks|instructions|paper code|roll no)/i;
const QUESTION_MARKER = /^(\d{1,2})\.\s*(.*)$/;
const SUBQUESTION_MARKER = /^(\([a-z]\)|\([ivx]+\))\s*(.*)$/i;
const PAGE_MARKER = /^p\.?\s*t\.?\s*o\.?$/i;

function classifyOcr(text: string): OcrBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: OcrBlock[] = [];
  const body: string[] = [];
  const meta: string[] = [];
  let inHeader = true;

  const flushBody = () => {
    if (body.length > 0) blocks.push({ kind: "body", lines: body.splice(0) });
  };
  const flushMeta = () => {
    if (meta.length > 0) blocks.push({ kind: "meta", lines: meta.splice(0) });
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (body.length > 0) flushBody();
      continue;
    }
    if (PAGE_MARKER.test(trimmed)) {
      flushBody();
      flushMeta();
      blocks.push({ kind: "page", text: trimmed });
      continue;
    }
    if (inHeader && META_LABEL.test(trimmed)) {
      meta.push(line);
      continue;
    }

    const question = trimmed.match(QUESTION_MARKER);
    if (question && Number(question[1]) <= 20 && question[2].trim()) {
      flushBody();
      flushMeta();
      inHeader = false;
      blocks.push({ kind: "question", marker: `${question[1]}.`, text: question[2] });
      continue;
    }
    const subquestion = trimmed.match(SUBQUESTION_MARKER);
    if (subquestion) {
      flushBody();
      blocks.push({ kind: "subquestion", marker: subquestion[1], text: subquestion[2] });
      continue;
    }
    if (meta.length > 0) {
      meta.push(line);
    } else {
      body.push(line);
    }
  }
  flushBody();
  flushMeta();
  return blocks;
}

function OcrLines({ lines }: { lines: string[] }) {
  return (
    <div className="max-w-[78ch] text-[1rem] leading-8 text-foreground/90 sm:text-[1.04rem]">
      {lines.map((line, index) => (
        <span key={`${index}-${line.slice(0, 14)}`} className="block text-pretty">
          {line}
        </span>
      ))}
    </div>
  );
}

export function OcrPaperRenderer({ text }: { text: string }) {
  const blocks = classifyOcr(text);
  return (
    <div className="ocr-document space-y-7">
      {blocks.map((block, index) => {
        if (block.kind === "meta") {
          return (
            <section key={`meta-${index}`} className="rounded-2xl border border-accent/15 bg-accent-soft/30 p-5 sm:p-6">
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-accent">Paper details</p>
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {block.lines.map((line, lineIndex) => (
                  <p key={`${lineIndex}-${line.slice(0, 14)}`} className="border-b border-accent/10 pb-2 text-sm leading-6 text-foreground/80">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        }
        if (block.kind === "question") {
          return (
            <section key={`question-${index}`} className="scroll-mt-28 border-l-4 border-accent pl-5 sm:pl-7">
              <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                <span className="mr-3 text-accent">{block.marker}</span>
                <span className="text-foreground/50">Question</span>
              </h2>
              {block.text && <p className="mt-3 max-w-[78ch] text-[1.04rem] font-medium leading-8 text-foreground">{block.text}</p>}
            </section>
          );
        }
        if (block.kind === "subquestion") {
          return (
            <section key={`subquestion-${index}`} className="scroll-mt-28 border-l-2 border-accent/40 pl-5 sm:ml-3 sm:pl-6">
              <h3 className="font-display text-xl font-semibold leading-8 text-foreground sm:text-[1.35rem]">
                <span className="mr-2 text-accent">{block.marker}</span>
                {block.text}
              </h3>
            </section>
          );
        }
        if (block.kind === "page") {
          return (
            <div key={`page-${index}`} className="flex items-center gap-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              <span className="h-px flex-1 bg-border" />
              <span>{block.text}</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          );
        }
        return <OcrLines key={`body-${index}`} lines={block.lines} />;
      })}
    </div>
  );
}
