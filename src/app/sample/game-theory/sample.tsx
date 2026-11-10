"use client";

import { useEffect, useRef } from "react";
import { BODY_HTML } from "./body";

type Cell = [number, number];
type Game = {
  r: string;
  c: string;
  rows: string[];
  cols: string[];
  p: Cell[][];
  msg: string;
};

const GAMES: Record<string, Game> = {
  pd: {
    r: "Suspect 1", c: "Suspect 2", rows: ["Quiet", "Fink"], cols: ["Quiet", "Fink"],
    p: [[[2, 2], [0, 3]], [[3, 0], [1, 1]]],
    msg: "Fink dono ke liye <b>dominant strategy</b> hai, isliye (Fink, Fink) unique NE hai. Dono Quiet rehte toh (2, 2) milta, lekin wo equilibrium nahi hai.",
  },
  bos: {
    r: "Person 1 (Bach fan)", c: "Person 2 (Stravinsky fan)", rows: ["Bach", "Stravinsky"], cols: ["Bach", "Stravinsky"],
    p: [[[2, 1], [0, 0]], [[0, 0], [1, 2]]],
    msg: "Do equilibria. Dono saath jaana chahte hain, par kahan, is par disagree karte hain. <b>Focal point</b> decide karta hai kaun sa chalega.",
  },
  stag: {
    r: "Player 1", c: "Player 2", rows: ["Stag", "Hare"], cols: ["Stag", "Hare"],
    p: [[[2, 2], [0, 1]], [[1, 0], [1, 1]]],
    msg: "(Stag, Stag) zyada payoff deta hai, (Hare, Hare) zyada safe hai. Yahan <b>trust</b> matter karta hai.",
  },
  mp: {
    r: "Player 1", c: "Player 2", rows: ["Head", "Tail"], cols: ["Head", "Tail"],
    p: [[[1, -1], [-1, 1]], [[-1, 1], [1, -1]]],
    msg: "Har cell mein koi na koi player deviate karna chahta hai. Solution sirf <b>mixed strategy</b> mein milta hai: (½, ½) dono ke liye.",
  },
};

const TREE_MSGS = [
  "Pehle poora tree dekho. Challenger pehle choose karta hai, Incumbent baad mein.",
  "<b>Step 1.</b> Aakhri mover Incumbent hai. Enter ho gaya toh Acquiesce (1) &gt; Fight (0), isliye wo <b>Acquiesce</b> karega. Fight branch cut.",
  "<b>Step 2.</b> Challenger jaanta hai ki In ke baad (2, 1) milega. In (2) &gt; Out (1), toh wo <b>In</b> choose karta hai. Outcome: <b>(In, Acquiesce)</b> with payoffs (2, 1).",
];

const NOTES = ["unit-1", "unit-2", "unit-3"];
const fmt = (n: number) => (n < 0 ? "−" + Math.abs(n) : String(n));

export function GameTheorySample() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const ac = new AbortController();
    const { signal } = ac;
    const $ = (id: string) => root.querySelector<HTMLElement>("#" + id)!;

    /* ---- note switching (hash routing) ---- */
    const show = (id: string) => {
      if (!NOTES.includes(id)) id = "unit-1";
      NOTES.forEach((n) => { $(n).hidden = n !== id; });
      root.querySelectorAll<HTMLElement>(".item[data-note]").forEach((b) => {
        b.setAttribute("aria-current", b.dataset.note === id ? "true" : "false");
      });
    };
    root.querySelectorAll<HTMLElement>(".item[data-note]").forEach((b) => {
      b.addEventListener("click", () => {
        const id = b.dataset.note!;
        show(id);
        try { history.replaceState(null, "", "#" + id); } catch { location.hash = id; }
        const shell = root.querySelector<HTMLElement>(".shell");
        window.scrollTo({ top: Math.max(0, (shell?.offsetTop ?? 0) - 14), behavior: "instant" as ScrollBehavior });
      }, { signal });
    });
    window.addEventListener("hashchange", () => show(location.hash.slice(1)), { signal });
    show(location.hash.slice(1));

    /* ---- payoff matrices with computed best responses ---- */
    let cur = "pd";
    let step = 3;
    const press = (group: string, attr: string, val: string | number) => {
      root.querySelectorAll<HTMLElement>("#" + group + " button").forEach((b) => {
        b.setAttribute("aria-pressed", String(b.dataset[attr] === String(val)));
      });
    };
    const drawGame = () => {
      const g = GAMES[cur];
      const R = g.rows.length, C = g.cols.length;
      const b1: boolean[][] = Array.from({ length: R }, () => []);
      const b2: boolean[][] = Array.from({ length: R }, () => []);
      for (let j = 0; j < C; j++) {
        let m = -1e9;
        for (let i = 0; i < R; i++) m = Math.max(m, g.p[i][j][0]);
        for (let i = 0; i < R; i++) b1[i][j] = g.p[i][j][0] === m;
      }
      for (let i = 0; i < R; i++) {
        let m = -1e9;
        for (let j = 0; j < C; j++) m = Math.max(m, g.p[i][j][1]);
        for (let j = 0; j < C; j++) b2[i][j] = g.p[i][j][1] === m;
      }
      let h = '<tr><th class="corner">' + g.r + " ↓ &nbsp;/&nbsp; " + g.c + " →</th>";
      for (let j = 0; j < C; j++) h += '<th class="col">' + g.cols[j] + "</th>";
      h += "</tr>";
      const nes: string[] = [];
      for (let i = 0; i < R; i++) {
        h += '<tr><th class="rw">' + g.rows[i] + "</th>";
        for (let j = 0; j < C; j++) {
          const ne = b1[i][j] && b2[i][j];
          if (ne) nes.push("(" + g.rows[i] + ", " + g.cols[j] + ")");
          const s1 = step >= 1 && b1[i][j] ? "<sup>★</sup>" : "";
          const s2 = step >= 2 && b2[i][j] ? "<sup>★</sup>" : "";
          const isNE = step >= 3 && ne;
          h += '<td class="cell' + (isNE ? " ne" : "") + '">(' + fmt(g.p[i][j][0]) + s1 + ", " + fmt(g.p[i][j][1]) + s2 + ')<span class="tag">' + (isNE ? "Nash" : "") + "</span></td>";
        }
        h += "</tr>";
      }
      $("mx").innerHTML = h;
      $("mx-res").innerHTML =
        step < 3
          ? step === 1
            ? "Player 1 ke best replies mark hue: <b>har column</b> mein sabse bada payoff."
            : "Ab Player 2 ke best replies: <b>har row</b> mein sabse bada payoff."
          : (nes.length ? "Pure NE: <b>" + nes.join(" and ") + "</b>. " : "<b>No pure NE.</b> ") + g.msg;
    };
    $("game-seg").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      cur = b.dataset.g!; press("game-seg", "g", cur); drawGame();
    }, { signal });
    $("star-seg").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (!b) return;
      step = Number(b.dataset.s); press("star-seg", "s", step); drawGame();
    }, { signal });
    drawGame();

    /* ---- game tree stepper ---- */
    const drawTree = (n: number) => {
      $("tree").setAttribute("data-step", String(n));
      $("tree-msg").innerHTML = TREE_MSGS[n];
      press("tree-seg", "t", n);
    };
    $("tree-seg").addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("button");
      if (b) drawTree(Number(b.dataset.t));
    }, { signal });
    drawTree(2);

    /* ---- checklists, remembered per viewer (optional) ---- */
    root.querySelectorAll<HTMLElement>(".chk").forEach((ul) => {
      const key = "gt-sample-" + ul.dataset.key;
      let saved: boolean[] = [];
      try { saved = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
      const boxes = ul.querySelectorAll<HTMLInputElement>("input");
      boxes.forEach((bx, i) => {
        bx.checked = !!saved[i];
        bx.addEventListener("change", () => {
          const arr = Array.from(boxes, (x) => x.checked);
          try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
        }, { signal });
      });
    });

    return () => ac.abort();
  }, []);

  return <div className="gts" ref={ref} dangerouslySetInnerHTML={{ __html: BODY_HTML }} />;
}
