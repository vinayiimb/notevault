import type { Metadata } from "next";
import { PracticalElectivesClient } from "@/components/subjects/practical-electives-client";

export const metadata: Metadata = {
  title: "Practical SEC & VAC Subjects | DU PYQ Online",
  description:
    "Explore the list of Skill Enhancement Courses (SEC) and Value Addition Courses (VAC) in Delhi University that have only practical exams for a lesser academic burden.",
  alternates: { canonical: "/practical-electives" },
};

export default function PracticalElectivesPage() {
  return <PracticalElectivesClient />;
}
