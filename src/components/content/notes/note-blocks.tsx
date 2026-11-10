"use client";

import { useEffect, useMemo, useState } from "react";
import {
  hashKey, layoutTree, parseChecklist, parseGameMatrix, parseGameTree, solveMatrix, solveTree,
  type TreeNode,
} from "@/lib/content/note-blocks";

// Interactive note blocks. Authors write a few lines inside a ```game-matrix / ```game-tree / ```checklist fence
// (syntax: docs/NOTES_BLOCKS.md); these components compute and draw everything. Colours come from the note theme
// (--nt-*), so every subject theme and the Apple reading look apply without extra work. Invalid input renders
// nothing rather than a broken box, same as ```cards.

function Steps<T extends string | number>({
  label, value, onChange, items,
}: { label: string; value: T; onChange: (v: T) => void; items: { v: T; text: string }[] }) {
  return (
    <div className="nt-blk-seg nt-blk-ctl" role="group" aria-label={label}>
      {items.map((it) => (
        <button key={String(it.v)} type="button" aria-pressed={value === it.v} onClick={() => onChange(it.v)}>
          {it.text}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- game-matrix */

export function GameMatrixBlock({ source }: { source: string }) {
  const g = useMemo(() => parseGameMatrix(source), [source]);
  const [step, setStep] = useState<1 | 2 | 3>(3);
  if (!g) return null;
  const { br1, br2, nash } = solveMatrix(g);
  const names = nash.map(([i, j]) => `(${g.rows[i]}, ${g.cols[j]})`);
  const fmt = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));

  return (
    <figure className="nt-blk nt-gm">
      <Steps
        label="Star method step"
        value={step}
        onChange={setStep}
        items={[
          { v: 1, text: `1 · ${g.rowPlayer}` },
          { v: 2, text: `2 · ${g.colPlayer}` },
          { v: 3, text: "3 · Equilibrium" },
        ]}
      />
      <div className="nt-blk-scroll">
        <table className="nt-gm-table">
          <thead>
            <tr>
              <th className="nt-gm-corner">{g.rowPlayer} ↓ / {g.colPlayer} →</th>
              {g.cols.map((c) => <th key={c} scope="col">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {g.rows.map((r, i) => (
              <tr key={r}>
                <th scope="row">{r}</th>
                {g.cols.map((c, j) => {
                  const isNash = step === 3 && br1[i][j] && br2[i][j];
                  return (
                    <td key={c} className={isNash ? "nt-gm-nash" : undefined}>
                      <span className="nt-gm-pay">
                        ({fmt(g.pay[i][j][0])}{step >= 1 && br1[i][j] && <sup>★</sup>}, {fmt(g.pay[i][j][1])}{step >= 2 && br2[i][j] && <sup>★</sup>})
                      </span>
                      <span className="nt-gm-tag">{isNash ? "Nash" : ""}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="nt-blk-msg" aria-live="polite">
        {step === 1 && <>★ marks <b>{g.rowPlayer}</b>&rsquo;s best reply: the highest payoff in each column.</>}
        {step === 2 && <>★ marks <b>{g.colPlayer}</b>&rsquo;s best reply: the highest payoff in each row.</>}
        {step === 3 && (names.length
          ? <>Pure Nash equilibrium{names.length > 1 ? "s" : ""}: <b>{names.join(" and ")}</b>. Both stars in one cell means nobody gains by deviating alone.</>
          : <><b>No pure-strategy Nash equilibrium.</b> Look for a mixed-strategy equilibrium.</>)}
      </p>
      <figcaption>{g.caption || `Payoffs are (${g.rowPlayer}, ${g.colPlayer}). ★ marks a best reply.`}</figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------- game-tree */

function valueOf(n: TreeNode): number[] {
  return n.payoffs ?? valueOf(n.children[n.chosen[0]]);
}

export function GameTreeBlock({ source }: { source: string }) {
  const model = useMemo(() => {
    const t = parseGameTree(source);
    if (!t) return null;
    const solved = solveTree(t);
    return { t, solved, lay: layoutTree(t) };
  }, [source]);
  const total = model?.solved.steps ?? 0;
  const [step, setStep] = useState<number | null>(null); // null = fully solved (complete at rest)
  if (!model) return null;
  const { t, solved, lay } = model;
  const s = step ?? total;

  const PADX = 96, PADT = 44, PADB = 64;
  const W = lay.width + PADX * 2;
  const H = lay.height + PADT + PADB;
  const at = (id: number) => ({ x: lay.pos[id].x + PADX, y: lay.pos[id].y + PADT });
  const onPath = new Set(solved.path.map((n) => n.id));
  const parentX = new Map<number, number>();
  for (const n of t.nodes) for (const c of n.children) parentX.set(c.id, at(n.id).x);
  const pay = (v: number[]) => `(${v.join(", ")})`;

  const edges: React.ReactNode[] = [];
  const marks: React.ReactNode[] = [];
  const labels: React.ReactNode[] = [];
  for (const n of t.nodes) {
    n.children.forEach((c, i) => {
      const a = at(n.id), b = at(c.id);
      const resolved = n.height <= s && s > 0;
      const chosen = resolved && n.chosen.includes(i);
      const pruned = resolved && !n.chosen.includes(i);
      edges.push(
        <line key={`e${c.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
          className={`nt-gt-edge${chosen ? " is-chosen" : ""}${pruned ? " is-pruned" : ""}`} />,
      );
      if (pruned) {
        const mx = a.x + (b.x - a.x) * 0.64, my = a.y + (b.y - a.y) * 0.64;
        marks.push(<path key={`x${c.id}`} className="nt-gt-x" d={`M${mx - 7} ${my - 7} L${mx + 7} ${my + 7} M${mx + 7} ${my - 7} L${mx - 7} ${my + 7}`} />);
      }
      const mx = a.x + (b.x - a.x) * 0.45, my = a.y + (b.y - a.y) * 0.45;
      const left = b.x < a.x - 1;
      labels.push(
        <text key={`l${c.id}`} className="nt-gt-act" x={mx + (left ? -9 : 9)} y={my - 4} textAnchor={left ? "end" : "start"}>{c.action}</text>,
      );
    });
  }

  const msgs: React.ReactNode[] = [];
  if (s === 0) msgs.push("Read the tree from the top. To solve it, start at the last mover and work backwards.");
  else {
    for (const n of t.nodes) {
      if (n.height !== s || n.payoffs) continue;
      const k = t.players.indexOf(n.player);
      const picked = n.children[n.chosen[0]];
      const best = valueOf(picked)[k];
      const rest = n.children.filter((_, i) => !n.chosen.includes(i)).map((c) => valueOf(c)[k]);
      msgs.push(
        <span key={n.id}>
          <b>{n.player}</b> picks <b>{n.chosen.map((i) => n.children[i].action).join(" or ")}</b>
          {rest.length ? <> ({best} {n.chosen.length > 1 ? "ties with" : ">"} {Math.max(...rest)})</> : null}.{" "}
        </span>,
      );
    }
    if (s === total) {
      msgs.push(<span key="out">Outcome: <b>{solved.path.slice(1).map((n) => n.action).join(" → ")}</b>, payoffs <b>{pay(solved.payoffs)}</b> for {t.players.join(", ")}.</span>);
    }
  }

  const steps = [{ v: 0, text: "Game tree" }, ...Array.from({ length: total }, (_, i) => ({
    v: i + 1,
    text: `Step ${i + 1}`,
  }))];

  return (
    <figure className="nt-blk nt-gt">
      <Steps label="Backward induction step" value={s} onChange={setStep} items={steps} />
      <div className="nt-blk-scroll">
      <svg className="nt-gt-svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Game tree for ${t.players.join(" and ")}. Backward induction outcome: ${solved.path.slice(1).map((n) => n.action).join(", then ")}, payoffs ${pay(solved.payoffs)}.`}>
        {edges}
        {marks}
        {labels}
        {t.nodes.map((n) => {
          const p = at(n.id);
          return n.payoffs ? (
            <g key={n.id}>
              <rect className={`nt-gt-term${s === total && onPath.has(n.id) ? " is-path" : ""}`} x={p.x - 7} y={p.y - 7} width="14" height="14" rx="3" />
              <text className="nt-gt-pay" x={p.x} y={p.y + 30} textAnchor="middle">{pay(n.payoffs)}</text>
            </g>
          ) : (
            <g key={n.id}>
              <circle className="nt-gt-node" cx={p.x} cy={p.y} r="12" />
              {/* name goes on the side away from the edge that arrives from the parent, so it never sits on a line */}
              <text className="nt-gt-who"
                x={n.id === t.root.id ? p.x : p.x + (parentX.get(n.id)! > p.x ? -18 : 18)}
                y={n.id === t.root.id ? p.y - 22 : p.y - 8}
                textAnchor={n.id === t.root.id ? "middle" : parentX.get(n.id)! > p.x ? "end" : "start"}>{n.player}</text>
            </g>
          );
        })}
        <text className="nt-gt-key" x={W / 2} y={H - 8} textAnchor="middle">Payoffs: {t.players.join(", ")}</text>
      </svg>
      </div>
      <p className="nt-blk-msg" aria-live="polite">{msgs}</p>
      <figcaption>{t.caption || "Solid line = backward induction path. Dashed line with ✕ = action ruled out."}</figcaption>
    </figure>
  );
}

/* ---------------------------------------------------------------- checklist */

export function ChecklistBlock({ source }: { source: string }) {
  const data = useMemo(() => parseChecklist(source), [source]);
  const key = data ? `nt-ck:${hashKey(data.items.join("|"))}` : "";
  const [done, setDone] = useState<boolean[]>([]);
  useEffect(() => {
    if (!key) return;
    try {
      const saved = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(saved)) setDone(saved.map(Boolean)); // eslint-disable-line react-hooks/set-state-in-effect -- reading browser storage after mount
    } catch {}
  }, [key]);
  if (!data) return null;
  const toggle = (i: number) => {
    const next = data.items.map((_, k) => (k === i ? !done[k] : !!done[k]));
    setDone(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  };
  return (
    <section className="nt-blk nt-ck">
      {data.title && <h4 className="nt-ck-title">{data.title}</h4>}
      <ul>
        {data.items.map((it, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={!!done[i]} onChange={() => toggle(i)} />
              <span>{it}</span>
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
