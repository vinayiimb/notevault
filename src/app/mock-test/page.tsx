import type { Metadata } from "next";
import { CbtMockTest } from "@/components/mock-test/cbt-mock-test";

export const metadata: Metadata = {
  title: "AfterBoards IPMAT Indore 2026 CBT Mock Test | DU PYQ Online",
  description:
    "Interactive CBT Mock Test Console for IPMAT Indore 2026 & DU Entrance Drills. Features real test timers, question palette, scientific calculator, and instant evaluation.",
};

export default function MockTestPage() {
  return <CbtMockTest />;
}
