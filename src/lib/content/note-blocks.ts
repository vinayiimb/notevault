// Pure parsers + solvers for the interactive note blocks (```game-matrix, ```game-tree, ```checklist).
// No React, no DOM: the components in components/content/notes/note-blocks.tsx only draw what these return,
// and src/lib/__tests__/note-blocks.test.ts checks the maths. Syntax is documented in docs/NOTES_BLOCKS.md.

/* ------------------------------------------------------------------ game-matrix */

export type MatrixGame = {
  rowPlayer: string;
  colPlayer: string;
  cols: string[];
  rows: string[];
  pay: [number, number][][]; // pay[row][col] = [row player's payoff, column player's payoff]
  caption: string;
};

const num = (s: string) => Number(s.replace(/[−–]/g, "-").trim());

/**
 *   Suspect 1 | Suspect 2        row player | column player
 *   Quiet, Fink                  the column player's actions
 *   Quiet: 2,2 | 0,3             one line per row action: "Action: p1,p2 | p1,p2"
 *   Fink: 3,0 | 1,1
 *   caption: Fig 1. optional
 */
export function parseGameMatrix(source: string): MatrixGame | null {
  const lines = source.split("\n").map((l) => l.trim()).filter(Boolean);
  let caption = "";
  const body: string[] = [];
  for (const l of lines) {
    const m = /^caption\s*:\s*(.+)$/i.exec(l);
    if (m) caption = m[1];
    else body.push(l);
  }
  if (body.length < 4) return null;
  const players = body[0].split("|").map((s) => s.trim());
  if (players.length !== 2 || !players[0] || !players[1]) return null;
  const cols = body[1].split(",").map((s) => s.trim()).filter(Boolean);
  if (cols.length < 2 || cols.length > 4) return null;
  const rows: string[] = [];
  const pay: [number, number][][] = [];
  for (const l of body.slice(2)) {
    const i = l.indexOf(":");
    if (i < 1) return null;
    const cells = l.slice(i + 1).split("|").map((c) => c.trim());
    if (cells.length !== cols.length) return null;
    const row: [number, number][] = [];
    for (const c of cells) {
      const parts = c.replace(/[()]/g, "").split(",").map(num);
      if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
      row.push([parts[0], parts[1]]);
    }
    rows.push(l.slice(0, i).trim());
    pay.push(row);
  }
  if (rows.length < 2 || rows.length > 4) return null;
  return { rowPlayer: players[0], colPlayer: players[1], cols, rows, pay, caption };
}

/** Best-response flags (the "star method") and the pure Nash equilibria of a two-player matrix game. */
export function solveMatrix(g: MatrixGame) {
  const R = g.rows.length;
  const C = g.cols.length;
  const br1 = g.rows.map(() => g.cols.map(() => false)); // row player's best reply in each column
  const br2 = g.rows.map(() => g.cols.map(() => false)); // column player's best reply in each row
  for (let j = 0; j < C; j++) {
    const best = Math.max(...g.pay.map((r) => r[j][0]));
    for (let i = 0; i < R; i++) br1[i][j] = g.pay[i][j][0] === best;
  }
  for (let i = 0; i < R; i++) {
    const best = Math.max(...g.pay[i].map((c) => c[1]));
    for (let j = 0; j < C; j++) br2[i][j] = g.pay[i][j][1] === best;
  }
  const nash: [number, number][] = [];
  for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (br1[i][j] && br2[i][j]) nash.push([i, j]);
  return { br1, br2, nash };
}

/* ------------------------------------------------------------------ game-tree */

export type TreeNode = {
  id: number;
  player: string; // decision nodes
  action: string; // label of the edge leading here ("" for the root)
  payoffs: number[] | null; // terminal nodes
  children: TreeNode[];
  height: number; // 0 for terminals, else 1 + tallest child
  chosen: number[]; // indexes of the best child(ren) once solved (ties keep all)
};

export type GameTree = { root: TreeNode; players: string[]; nodes: TreeNode[]; caption: string };

/**
 *   Challenger                   root = the player who moves first
 *     In -> Incumbent            "Action -> next player" (children indented 2+ spaces under it)
 *       Acquiesce -> 2, 1        "Action -> payoffs" ends the game; payoffs follow the players list
 *       Fight -> 0, 0
 *     Out -> 1, 2
 *   players: Challenger, Incumbent   optional; default = players in order of first appearance
 *   caption: Fig 3. optional
 */
export function parseGameTree(source: string): GameTree | null {
  let caption = "";
  let playersLine: string[] | null = null;
  const rows: { depth: number; text: string }[] = [];
  for (const raw of source.split("\n")) {
    if (!raw.trim()) continue;
    const cap = /^\s*caption\s*:\s*(.+)$/i.exec(raw);
    if (cap) { caption = cap[1].trim(); continue; }
    const pl = /^\s*players\s*:\s*(.+)$/i.exec(raw);
    if (pl) { playersLine = pl[1].split(",").map((s) => s.trim()).filter(Boolean); continue; }
    const depth = raw.length - raw.trimStart().length;
    rows.push({ depth, text: raw.trim() });
  }
  if (rows.length < 3 || rows[0].text.includes("->")) return null;

  const nodes: TreeNode[] = [];
  const mk = (player: string, action: string, payoffs: number[] | null): TreeNode => {
    const n: TreeNode = { id: nodes.length, player, action, payoffs, children: [], height: 0, chosen: [] };
    nodes.push(n);
    return n;
  };
  const root = mk(rows[0].text, "", null);
  const stack: { depth: number; node: TreeNode }[] = [{ depth: rows[0].depth, node: root }];
  for (const r of rows.slice(1)) {
    const m = /^(.+?)\s*->\s*(.+)$/.exec(r.text);
    if (!m) return null;
    while (stack.length && stack[stack.length - 1].depth >= r.depth) stack.pop();
    const parent = stack[stack.length - 1]?.node;
    if (!parent || parent.payoffs) return null;
    const target = m[2].trim();
    const asPay = target.split(",").map(num);
    const isPay = asPay.length >= 2 && asPay.every(Number.isFinite);
    const node = mk(isPay ? "" : target, m[1].trim(), isPay ? asPay : null);
    parent.children.push(node);
    if (!isPay) stack.push({ depth: r.depth, node });
  }
  // every decision node needs at least two choices, every terminal the same number of payoffs
  const players = playersLine ?? [];
  if (!playersLine) for (const n of nodes) if (!n.payoffs && !players.includes(n.player)) players.push(n.player);
  for (const n of nodes) {
    if (n.payoffs) { if (n.payoffs.length !== players.length) return null; continue; }
    if (n.children.length < 2) return null;
    if (!players.includes(n.player)) return null;
  }
  if (players.length < 2 || players.length > 3 || nodes.length > 24) return null;
  return { root, players, nodes, caption };
}

/** Backward induction. Fills `height` and `chosen` on every node; returns the equilibrium path and its payoffs. */
export function solveTree(t: GameTree) {
  const solve = (n: TreeNode): number[] => {
    if (n.payoffs) { n.height = 0; return n.payoffs; }
    const vals = n.children.map(solve);
    n.height = 1 + Math.max(...n.children.map((c) => c.height));
    const k = t.players.indexOf(n.player);
    const best = Math.max(...vals.map((v) => v[k]));
    n.chosen = vals.flatMap((v, i) => (v[k] === best ? [i] : []));
    return vals[n.chosen[0]];
  };
  const payoffs = solve(t.root);
  const path: TreeNode[] = [];
  for (let n = t.root; ; ) {
    path.push(n);
    if (n.payoffs) break;
    n = n.children[n.chosen[0]];
  }
  return { payoffs, path, steps: t.root.height };
}

export type Pt = { x: number; y: number };
/** Tidy layout: leaves evenly spaced, parents centred over their children. Returns a point per node id. */
export function layoutTree(t: GameTree, leafGap = 150, levelGap = 100): { pos: Pt[]; width: number; height: number } {
  const pos: Pt[] = new Array(t.nodes.length);
  let leaf = 0;
  let maxDepth = 0;
  const walk = (n: TreeNode, depth: number) => {
    maxDepth = Math.max(maxDepth, depth);
    if (!n.children.length) { pos[n.id] = { x: leaf++ * leafGap, y: depth * levelGap }; return; }
    n.children.forEach((c) => walk(c, depth + 1));
    const xs = n.children.map((c) => pos[c.id].x);
    pos[n.id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: depth * levelGap };
  };
  walk(t.root, 0);
  return { pos, width: Math.max(0, leaf - 1) * leafGap, height: maxDepth * levelGap };
}

/* ------------------------------------------------------------------ checklist */

export type ChecklistData = { title: string; items: string[] };

/**
 *   title: Revision checklist    optional
 *   - first item
 *   - second item
 */
export function parseChecklist(source: string): ChecklistData | null {
  let title = "";
  const items: string[] = [];
  for (const raw of source.split("\n")) {
    const l = raw.trim();
    if (!l) continue;
    const t = /^title\s*:\s*(.+)$/i.exec(l);
    if (t) { title = t[1]; continue; }
    const m = /^(?:[-*]\s*(?:\[[ xX]\]\s*)?)(.+)$/.exec(l);
    if (m) items.push(m[1].trim());
  }
  return items.length ? { title, items: items.slice(0, 20) } : null;
}

/** Small stable hash so a checklist can remember its ticks per page without needing an id in the markdown. */
export function hashKey(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
