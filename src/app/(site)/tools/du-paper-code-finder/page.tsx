import { Metadata } from "next";
import { DuPaperCodeClient } from "./client";
import fs from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "DU Paper Code / UPC Finder & Course Structure Decoder",
  description: "Search official DU courses by UPC or title. View official L-T-P structures and assessment mappings.",
};

export default async function Page() {
  const filePath = path.join(process.cwd(), "public/data/du-courses-catalog.json");
  let initialCourses = [];
  try {
    initialCourses = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (e) {
    console.error("Failed to load DU courses catalog");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          DU Paper Code / UPC Finder & Course Structure Decoder
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Search our database of official DU courses by Unique Paper Code (UPC) or title to instantly decode the course structure (L-T-P) and assessment rules.
        </p>
      </div>

      <DuPaperCodeClient initialCourses={initialCourses} />
    </div>
  );
}
