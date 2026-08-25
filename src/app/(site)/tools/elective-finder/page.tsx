import { Metadata } from "next";
import { ElectiveFinderClient } from "./client";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "DU Elective Finder | DU Academic Intelligence",
  description: "Find SEC and VAC courses, filter by practical-only, and view credits and assessment rules.",
};

export default async function Page() {
  const filePath = path.join(process.cwd(), "public/data/du-courses-catalog.json");
  let courses = [];
  try {
    courses = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error("Failed to load DU courses catalog");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          DU Elective Finder
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Discover SEC, VAC, and AEC courses. Use the practical filter to find courses with no written exams for a lighter academic burden.
        </p>
      </div>
      <ElectiveFinderClient courses={courses} />
    </div>
  );
}
