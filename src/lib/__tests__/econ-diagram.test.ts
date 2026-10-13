import { test } from "node:test";
import assert from "node:assert/strict";
import { curvePath, parseDiagram } from "@/lib/econ-diagram";

const toPx = (p: { x: number; y: number }): [number, number] => [p.x * 10, 100 - p.y * 10];

test("straight line for 2 points, clamped to the grid", () => {
  assert.equal(curvePath([{ x: 0, y: 12 }, { x: 10, y: 0 }], toPx), "M0,0 L100,100");
});

test("smooth curve passes through every point", () => {
  const d = curvePath([{ x: 1, y: 9 }, { x: 3, y: 4 }, { x: 9, y: 1 }], toPx);
  assert.match(d, /^M10,10 C.* 30,60 C.* 90,90$/);
});

test("parseDiagram rejects junk and accepts a valid spec", () => {
  assert.equal(parseDiagram("not json"), null);
  assert.equal(parseDiagram('{"title":"x"}'), null);
  const ok = parseDiagram(
    JSON.stringify({
      title: "Demand and supply",
      xLabel: "Quantity",
      yLabel: "Price",
      curves: [{ label: "D", points: [{ x: 1, y: 9 }, { x: 9, y: 1 }], dashed: false }],
      points: [],
      arrows: [],
    }),
  );
  assert.equal(ok?.curves[0].label, "D");
});

test("snapPoints moves a slightly-off equilibrium onto the curve crossing", async () => {
  const { snapPoints } = await import("@/lib/econ-diagram");
  const d = snapPoints({
    title: "",
    xLabel: "Q",
    yLabel: "P",
    curves: [
      { label: "D", points: [{ x: 1, y: 9 }, { x: 9, y: 1 }], dashed: false },
      { label: "S₂", points: [{ x: 0, y: 3 }, { x: 7, y: 10 }], dashed: true },
    ],
    points: [
      { label: "E₂", x: 4, y: 6, guides: true, xMark: "", yMark: "" },
      { label: "far", x: 9, y: 9, guides: false, xMark: "", yMark: "" },
    ],
    arrows: [],
  });
  assert.deepEqual([d.points[0].x, d.points[0].y], [3.5, 6.5]);
  assert.deepEqual([d.points[1].x, d.points[1].y], [9, 9]);
});
