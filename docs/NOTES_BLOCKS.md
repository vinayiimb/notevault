# Notes blocks: the authoring standard

How diagrams and interactive parts go into a note. Every block is plain text inside a Markdown fence, so it works in the
admin editor, `.md` uploads (`/api/notes-import`) and the Paper OCR Studio publish step. Nothing here needs HTML or JavaScript.

Live example of everything below: `docs/examples/game-theory-blocks.md`.

## Which tier to use

| Need | Use | Why |
|---|---|---|
| Table, callout, formula | Markdown, `> **Exam tip:** …`, `$…$` (KaTeX) | already styled by the reader |
| Flowchart, mind map, timeline | ` ```mermaid ` | renders in the note theme |
| Simple bar / line / area / pie | ` ```chart ` (`type`, `title`, `labels`, `values`) | one series, no code |
| Curves, axes, supply-demand, best-response lines | inline `<svg class="diagram">` | drawn to scale, classes below |
| Payoff matrix with best replies and Nash cells | ` ```game-matrix ` | computed, tappable |
| Sequential game solved by backward induction | ` ```game-tree ` | computed, step buttons |
| Revision checklist that remembers ticks | ` ```checklist ` | saved in the reader's browser |
| Icon cards | ` ```cards ` | see `info-cards.tsx` |

Never put `<script>`, `<style>`, `style="…"` or event handlers in a note. The sanitiser strips them on purpose: notes are
rendered on dupyq.online for every reader.

## ```game-matrix

```game-matrix
Suspect 1 | Suspect 2
Quiet, Fink
Quiet: 2,2 | 0,3
Fink: 3,0 | 1,1
caption: Fig 1. Prisoner's Dilemma.
```

- Line 1: row player | column player. Line 2: the column player's actions (2 to 4).
- Then one line per row action (2 to 4): `Action: p1,p2 | p1,p2`, payoffs are (row player, column player). Negatives are fine.
- `caption:` is optional.
- The block draws the table, adds the ★ best replies in three steps (row player, column player, equilibrium) and highlights every
  pure Nash equilibrium. With none it says so and points to a mixed-strategy solution.
- Wrong shape (ragged rows, non-numbers) renders nothing. Check the note preview.

## ```game-tree

```game-tree
Challenger
  In -> Incumbent
    Acquiesce -> 2, 1
    Fight -> 0, 0
  Out -> 1, 2
players: Challenger, Incumbent
caption: Fig 4. Entry Game.
```

- First line: the player who moves first. Each child is `Action -> next player` (more children indented 2 spaces under it) or
  `Action -> payoffs` (a terminal node).
- Payoffs follow the `players:` order. If you leave `players:` out it is the order players first appear.
- 2 or 3 players, every decision node needs at least 2 actions, at most 24 nodes.
- The block solves it by backward induction and gives one button per step, last mover first. Ties keep every best action.

## ```checklist

```checklist
title: Revision checklist
- State Nash Equilibrium using best responses
- Solve the Entry Game by backward induction
```

Up to 20 items. Ticks are stored in the reader's own browser (`localStorage`), keyed to the list text, so nothing is sent
anywhere and editing the wording starts a fresh list.

## Inline SVG diagrams (`svg.diagram`)

Use for anything on axes. Keep the SVG free of blank lines (a blank line ends the HTML block in Markdown). Allowed tags:
`svg g path rect circle ellipse line polyline polygon text tspan defs marker title desc`. Colour only through classes:

- `axis`, `curve` with `blue` / `green` / `red` / `purple` / `gray`, `dash`, `guide`, `dot`
- text: `b` (bold), `bl` (blue), `r` (red)
- always add `role="img"` and an `aria-label` that says what the chart shows.

Draw to scale: pick the maths mapping first (for example x = 70 + 4.2·q1, y = 360 − 3.6·q2) and compute every point from it.
Do not eyeball positions, and never draw a chart as ASCII art.

## For other subjects

The same blocks fit any 2-player table (Micro: duopoly and pricing games, Public Economics: voting and public goods) and any
sequential choice (entry, bargaining, ultimatum). Macro and Micro curves go in as `svg.diagram`.

## Adding a new block

1. Pure parser and solver in `src/lib/content/note-blocks.ts`, with a test in `src/lib/__tests__/note-blocks.test.ts`
   (`npm test`).
2. A component in `src/components/content/notes/note-blocks.tsx`. Colours from `--nt-*` tokens only, so every subject theme
   and the Apple look work for free.
3. One line in the `code` renderer of `notes-markdown.tsx`, styles in the "Interactive blocks" section of
   `src/app/notes-content.css`, and a section here.

Invalid input must render nothing, never a broken box. Keep step buttons hidden in print (`.nt-blk-ctl`).

Gotcha: the renderer reads the fence label with `\w+`, which stops at `-`, so hyphenated labels are matched with
`[\w-]+` in `notes-markdown.tsx`.

## Keeping a premium note fully locked (`<!-- preview-end -->`)

Paid notes show a free preview of about the first 30% of the text. For a note whose teaching content should be **entirely**
paid, put this on its own line right after the title page:

```
<!-- preview-end -->
```

Everything above the marker is the free preview, everything below is paid and is only sent to a logged-in student who has
bought it. The marker is an HTML comment, so it is invisible in the full note. Without a marker the 30% rule applies. A marker
at the very top shows just the title line; a marker with nothing below it locks nothing.
