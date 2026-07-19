import { NotesRenderer } from "./notes-renderer";

export const AI_OCR_MARKER = "<!-- OCR_REFORMATTED_V2 -->";
const LEGACY_AI_OCR_MARKER = "<!-- AI_REFORMATTED_OCR_V1 -->";

export type OcrBlock =
  | { kind: "meta"; lines: string[] }
  | { kind: "question"; marker: string; text: string }
  | { kind: "subquestion"; marker: string; text: string }
  | { kind: "body"; lines: string[] }
  | { kind: "page"; text: string };

const META_LABEL = /^(?:sr\.?\s*no|serial|unique paper code|name of (?:the )?(?:paper|course)|course|subject|semester|duration|time|maximum marks|instructions|paper code|roll no)/i;
const QUESTION_MARKER = /^(\d{1,2})\.\s*(.*)$/;
const SUBQUESTION_MARKER = /^(\([a-z]\)|\([ivx]+\))\s*(.*)$/i;
const PAGE_MARKER = /^p\.?\s*t\.?\s*o\.?$/i;
const MARKDOWN_QUESTION_MARKER = /^#{2,3}\s+Question\s+(\d{1,2})\s*[:.-]?\s*(.*)$/i;
const MARKDOWN_SUBQUESTION_MARKER = /^#{3,4}\s+(\([a-z]\)|\([ivx]+\))\s*(.*)$/i;

export function classifyOcr(text: string): OcrBlock[] {
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
    if (PAGE_MARKER.test(trimmed) || /^\d{3,5}\s+\d{1,2}$/.test(trimmed)) {
      flushBody();
      flushMeta();
      blocks.push({ kind: "page", text: trimmed });
      continue;
    }
    const markdownQuestion = trimmed.match(MARKDOWN_QUESTION_MARKER);
    if (markdownQuestion) {
      flushBody();
      flushMeta();
      inHeader = false;
      blocks.push({ kind: "question", marker: `${markdownQuestion[1]}.`, text: markdownQuestion[2] });
      continue;
    }
    const markdownSubquestion = trimmed.match(MARKDOWN_SUBQUESTION_MARKER);
    if (markdownSubquestion) {
      flushBody();
      blocks.push({ kind: "subquestion", marker: markdownSubquestion[1], text: markdownSubquestion[2] });
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
    <div className="ocr-document space-y-8">
      {blocks.map((block, index) => {
        if (block.kind === "meta") {
          return (
            <section key={`meta-${index}`} className="rounded-2xl border border-sky/30 bg-white/70 p-5 shadow-[0_8px_24px_rgba(66,195,243,.08)] dark:bg-surface/70 sm:p-6">
              <p className="mb-4 font-display text-xl font-bold text-sky-dark">Paper details</p>
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                {block.lines.map((line, lineIndex) => (
                  <p key={`${lineIndex}-${line.slice(0, 14)}`} className="border-b border-sky/15 pb-2 text-sm leading-6 text-foreground/80">
                    {line}
                  </p>
                ))}
              </div>
            </section>
          );
        }
        if (block.kind === "question") {
          return (
            <section id={`ocr-question-${index}`} key={`question-${index}`} className="scroll-mt-28 border-l-4 border-sky pl-5 sm:pl-7">
              <h2 className="font-display text-3xl font-bold tracking-tight text-sky-dark sm:text-4xl">
                <span className="mr-3">{block.marker}</span>
                <span>Question</span>
              </h2>
              {block.text && <p className="mt-3 max-w-[78ch] text-[1.08rem] font-medium leading-8 text-foreground">{block.text}</p>}
            </section>
          );
        }
        if (block.kind === "subquestion") {
          return (
            <section id={`ocr-subquestion-${index}`} key={`subquestion-${index}`} className="scroll-mt-28 border-l-2 border-sky/35 pl-5 sm:ml-3 sm:pl-6">
              <h3 className="font-display text-xl font-bold leading-8 text-foreground sm:text-[1.35rem]">
                <span className="mr-2 text-accent">{block.marker}</span>
                {block.text}
              </h3>
            </section>
          );
        }
        if (block.kind === "page") {
          return (
            <div key={`page-${index}`} className="flex items-center gap-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-sky-dark">
              <span className="h-px flex-1 bg-sky/25" />
              <span>{block.text}</span>
              <span className="h-px flex-1 bg-sky/25" />
            </div>
          );
        }
        return <OcrLines key={`body-${index}`} lines={block.lines} />;
      })}
    </div>
  );
}

export function isAiReformattedOcr(text: string) {
  const value = text.trimStart();
  return value.startsWith(AI_OCR_MARKER) || value.startsWith(LEGACY_AI_OCR_MARKER);
}

export function FormattedOcrPaperRenderer({ text }: { text: string }) {
  const markdown = text.replace(new RegExp(`^\\s*(?:${AI_OCR_MARKER}|${LEGACY_AI_OCR_MARKER})\\s*`), "");
  return <NotesRenderer content={markdown} theme="sky" />;
}

export function OcrContents({ text }: { text: string }) {
  const allBlocks = classifyOcr(text);
  const blocks = allBlocks.filter((block) => block.kind === "question" || block.kind === "subquestion");
  if (blocks.length === 0) return null;

  return (
    <nav className="mb-10 border-y border-sky/25 py-7" aria-label="Paper contents">
      <h2 className="font-display text-3xl font-bold text-sky-dark">Contents</h2>
      <div className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2">
        {blocks.map((block, index) => {
          const isQuestion = block.kind === "question";
          const anchor = isQuestion ? `ocr-question-${allBlocks.indexOf(block)}` : `ocr-subquestion-${allBlocks.indexOf(block)}`;
          const label = isQuestion
            ? `${block.marker} Question`
            : `${block.marker} ${block.text.slice(0, 72)}${block.text.length > 72 ? "…" : ""}`;
          return (
            <a
              key={`${anchor}-${index}`}
              href={`#${anchor}`}
              className={`group flex items-start gap-3 rounded-lg px-2 py-1.5 text-foreground transition hover:bg-sky-soft hover:text-sky-dark ${isQuestion ? "font-semibold" : "pl-5 text-sm"}`}
            >
              <span className="mt-2 size-2 shrink-0 rounded-full bg-sky transition group-hover:scale-125" />
              <span>{label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}
