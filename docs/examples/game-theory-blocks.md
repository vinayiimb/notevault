# Game Theory: Strategic Interactions

Sample of the interactive note blocks on one page.

## Unit I · Nash Equilibrium

A Nash Equilibrium is an action profile where **no player gains by deviating alone**. Tap the steps to see the star method: ★ marks each player's best reply, and a cell with both stars is an equilibrium.

```game-matrix
Suspect 1 | Suspect 2
Quiet, Fink
Quiet: 2,2 | 0,3
Fink: 3,0 | 1,1
caption: Fig 1. Prisoner's Dilemma. Higher number = better outcome.
```

Fink is a dominant strategy for both players, so (Fink, Fink) is the only equilibrium even though (Quiet, Quiet) pays more.

```game-matrix
Person 1 | Person 2
Bach, Stravinsky
Bach: 2,1 | 0,0
Stravinsky: 0,0 | 1,2
caption: Fig 2. Bach or Stravinsky. Two equilibria, so a focal point decides.
```

```game-matrix
Player 1 | Player 2
Head, Tail
Head: 1,-1 | -1,1
Tail: -1,1 | 1,-1
caption: Fig 3. Matching Pennies. No pure equilibrium, so the answer is a mixed strategy.
```

## Unit II · Backward Induction

Solve from the last mover backwards. Use the steps to watch the non-credible threat (Out, Fight) get cut.

```game-tree
Challenger
  In -> Incumbent
    Acquiesce -> 2, 1
    Fight -> 0, 0
  Out -> 1, 2
caption: Fig 4. Entry Game. Payoffs are (Challenger, Incumbent).
```

> **Exam tip:** (In, Acquiesce) is subgame perfect. (Out, Fight) is a Nash equilibrium but rests on a threat the Incumbent would never carry out.

## Unit III · Cournot Duopoly

With a − c = 90, each firm's best response is q = (90 − other)/2. The lines cross at (30, 30).

<svg class="diagram" viewBox="0 0 520 420" role="img" aria-label="Best response lines of two Cournot firms crossing at 30, 30">
<line class="guide" x1="196" y1="252" x2="196" y2="360"/>
<line class="guide" x1="70" y1="252" x2="196" y2="252"/>
<line class="axis" x1="70" y1="360" x2="448" y2="360"/>
<line class="axis" x1="70" y1="36" x2="70" y2="360"/>
<path class="curve blue" d="M259 360 L70 36"/>
<path class="curve green" d="M70 198 L448 360"/>
<circle class="dot" cx="196" cy="252" r="6"/>
<text x="70" y="378" text-anchor="middle">0</text>
<text x="196" y="378" text-anchor="middle">30</text>
<text x="322" y="378" text-anchor="middle">60</text>
<text x="448" y="378" text-anchor="middle">90</text>
<text x="62" y="364" text-anchor="end">0</text>
<text x="62" y="256" text-anchor="end">30</text>
<text x="62" y="148" text-anchor="end">60</text>
<text x="62" y="40" text-anchor="end">90</text>
<text class="b bl" x="112" y="92">Firm 1: q1 = (90 − q2)/2</text>
<text class="b" x="292" y="286">Firm 2: q2 = (90 − q1)/2</text>
<text class="b" x="210" y="244">Cournot NE (30, 30)</text>
<text x="259" y="404" text-anchor="middle">q1, Firm 1's output</text>
<text x="40" y="198" text-anchor="middle">q2</text>
</svg>

## Revision

```checklist
title: Revision checklist
- State Nash Equilibrium using best responses
- Find a pure equilibrium with the star method
- Solve the Entry Game by backward induction
- Derive the Cournot best response function
```
