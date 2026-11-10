import type { Metadata } from "next";
import "./game-theory.css";
import { GameTheorySample } from "./sample";

export const metadata: Metadata = {
  title: "Game Theory Notes – Free Sample (DU B.A. Hons Economics Sem 5)",
  description:
    "Read a free sample of the Game Theory & Strategic Interactions notes: payoff matrices you can tap, a backward-induction game tree and Cournot charts drawn to scale.",
  alternates: { canonical: "/sample/game-theory" },
};

export default function GameTheorySamplePage() {
  return <GameTheorySample />;
}
