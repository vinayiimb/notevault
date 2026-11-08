import { CaretDown, CaretRight } from "@phosphor-icons/react/dist/ssr";
import type { ContentHeading } from "@/lib/content/toc";

const UNIT = /^(Unit\s+[\w.]+)\s*[—–:-]\s+(.*)$/i;
const QUESTION = /^Q(\d+)\.\s+(.*)$/;

type Row = { head: ContentHeading; items: ContentHeading[] };

// "## Unit 1 — …" followed by its "### Q1. …" questions makes one row; a "##" with nothing under it ("Unit-wise
// weightage", "Most repeated questions") is a plain link row.
function toRows(headings: ContentHeading[]): Row[] {
  const rows: Row[] = [];
  for (const h of headings) {
    if (h.level === 3 && rows.length > 0) rows[rows.length - 1].items.push(h);
    else rows.push({ head: h, items: [] });
  }
  return rows;
}

// The note's contents, shown once near the top: each unit opens to its questions (native <details>, no JS). It replaces
// the old side list, so the reading column gets the whole width and a phone is not pushed down by 70 headings.
export function NotesIndex({ headings, id }: { headings: ContentHeading[]; id: string }) {
  if (headings.length === 0) return null;
  const rows = toRows(headings);
  const questions = headings.filter((h) => QUESTION.test(h.text)).length;

  return (
    <nav className="nt-index nt-no-print" id={id} aria-label="Contents">
      <div className="nt-index-head">
        <p className="nt-index-title">Contents</p>
        {questions > 0 && <p className="nt-index-count">{questions} questions</p>}
      </div>
      <div className="nt-index-card">
        {rows.map(({ head, items }) => {
          const unit = UNIT.exec(head.text);
          const label = (
            <>
              {unit && <span className="nt-unit-tag">{unit[1]}</span>}
              <span className="nt-index-name">{unit ? unit[2] : head.text}</span>
            </>
          );
          if (items.length === 0) {
            return (
              <a key={head.slug} href={`#${head.slug}`} className="nt-index-row nt-index-link">
                {label}
                <CaretRight size={14} weight="bold" className="nt-index-caret" aria-hidden />
              </a>
            );
          }
          const allQuestions = items.every((i) => QUESTION.test(i.text));
          return (
            <details key={head.slug} className="nt-index-group">
              <summary className="nt-index-row">
                {label}
                <span className="nt-index-n">
                  {items.length} {allQuestions ? "question" : "section"}
                  {items.length === 1 ? "" : "s"}
                </span>
                <CaretDown size={14} weight="bold" className="nt-index-caret" aria-hidden />
              </summary>
              <ol className="nt-index-list">
                {items.map((q) => {
                  const m = QUESTION.exec(q.text);
                  return (
                    <li key={q.slug}>
                      <a href={`#${q.slug}`} className="nt-index-q">
                        {m && <span className="nt-index-qno">Q{m[1]}</span>}
                        <span className="nt-index-qtext">{m ? m[2] : q.text}</span>
                      </a>
                    </li>
                  );
                })}
              </ol>
            </details>
          );
        })}
      </div>
    </nav>
  );
}
