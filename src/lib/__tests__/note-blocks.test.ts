import { test } from "node:test";
import assert from "node:assert/strict";
import { hashKey, layoutTree, parseChecklist, parseGameMatrix, parseGameTree, solveMatrix, solveTree } from "../content/note-blocks";

const PD = `Suspect 1 | Suspect 2
Quiet, Fink
Quiet: 2,2 | 0,3
Fink: 3,0 | 1,1
caption: Fig 1`;

const names = (g: NonNullable<ReturnType<typeof parseGameMatrix>>, cells: [number, number][]) =>
  cells.map(([i, j]) => `${g.rows[i]}/${g.cols[j]}`);

test("matrix: Prisoner's Dilemma has the single equilibrium (Fink, Fink)", () => {
  const g = parseGameMatrix(PD)!;
  assert.equal(g.caption, "Fig 1");
  assert.deepEqual(names(g, solveMatrix(g).nash), ["Fink/Fink"]);
});

test("matrix: Bach or Stravinsky and Stag Hunt have two equilibria, Matching Pennies none", () => {
  const bos = parseGameMatrix("A | B\nBach, Stravinsky\nBach: 2,1 | 0,0\nStravinsky: 0,0 | 1,2")!;
  assert.deepEqual(names(bos, solveMatrix(bos).nash), ["Bach/Bach", "Stravinsky/Stravinsky"]);
  const stag = parseGameMatrix("A | B\nStag, Hare\nStag: 2,2 | 0,1\nHare: 1,0 | 1,1")!;
  assert.deepEqual(names(stag, solveMatrix(stag).nash), ["Stag/Stag", "Hare/Hare"]);
  const mp = parseGameMatrix("A | B\nHead, Tail\nHead: 1,-1 | -1,1\nTail: -1,1 | 1,-1")!;
  assert.deepEqual(solveMatrix(mp).nash, []);
});

test("matrix: rejects malformed input", () => {
  assert.equal(parseGameMatrix("A | B\nX, Y\nX: 1,2 | 3"), null);
  assert.equal(parseGameMatrix("nothing here"), null);
  assert.equal(parseGameMatrix("A | B\nX, Y\nX: 1,a | 3,4\nY: 1,1 | 2,2"), null);
});

const ENTRY = `Challenger
  In -> Incumbent
    Acquiesce -> 2, 1
    Fight -> 0, 0
  Out -> 1, 2
caption: Fig 3`;

test("tree: Entry Game backward induction gives (In, Acquiesce) with payoffs 2,1", () => {
  const t = parseGameTree(ENTRY)!;
  assert.deepEqual(t.players, ["Challenger", "Incumbent"]);
  const s = solveTree(t);
  assert.deepEqual(s.payoffs, [2, 1]);
  assert.deepEqual(s.path.map((n) => n.action || "(root)"), ["(root)", "In", "Acquiesce"]);
  assert.equal(s.steps, 2);
  const inc = t.nodes.find((n) => n.player === "Incumbent")!;
  assert.equal(inc.height, 1);
  assert.deepEqual(inc.chosen, [0]); // Acquiesce
});

test("tree: layout centres a parent over its children and keeps leaves apart", () => {
  const t = parseGameTree(ENTRY)!;
  const { pos, width } = layoutTree(t);
  assert.equal(width, 300);
  const [root, incumbent] = [t.root, t.nodes.find((n) => n.player === "Incumbent")!];
  // leaves: Acquiesce 0, Fight 150, Out 300 → Incumbent sits at 75, root halfway between Incumbent and Out
  assert.equal(pos[incumbent.id].x, 75);
  assert.equal(pos[root.id].x, (75 + 300) / 2);
});

test("tree: rejects a single-choice node and mismatched payoffs", () => {
  assert.equal(parseGameTree("A\n  x -> B\n    y -> 1,2\n  z -> 0,0"), null);
  assert.equal(parseGameTree("A\n  x -> 1,2,3\n  y -> 0,0"), null);
});

test("checklist: parses dashes, task syntax and an optional title", () => {
  const c = parseChecklist("title: Revise\n- one\n- [ ] two\n* three")!;
  assert.equal(c.title, "Revise");
  assert.deepEqual(c.items, ["one", "two", "three"]);
  assert.equal(parseChecklist("just prose"), null);
  assert.equal(hashKey("a"), hashKey("a"));
  assert.notEqual(hashKey("a"), hashKey("b"));
});
