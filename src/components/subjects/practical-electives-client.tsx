"use client";

import { useState } from "react";
import { Info } from "@phosphor-icons/react/dist/ssr";

const SEC_SUBJECTS = [
  "Basic IT Tools",
  "Programming Using Python",
  "Statistics with R",
  "Essentials of Python",
  "Digital Marketing",
  "Rachnatmak Lekhan",
  "Rangmanch",
  "Front-End Web Development",
  "Negotiation and Leadership",
  "Creative Writing",
  "Yoga in Practice",
  "Sericulture (Mulberry)",
  "E-Tourism",
  "Communication in Everyday Life",
  "Communication in Professional Life",
];

const VAC_SUBJECTS = ["Digital Empowerment", "Fit India", "Sports for Life"];

export function PracticalElectivesClient() {
  const [searchQuery, setSearchQuery] = useState("");

  const filterSubjects = (subjects: string[]) => {
    return subjects.filter((subject) =>
      subject.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filteredSec = filterSubjects(SEC_SUBJECTS);
  const filteredVac = filterSubjects(VAC_SUBJECTS);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Practical SEC & VAC Subjects
        </h1>
        <p className="mt-2 text-lg text-muted">
          Lesser academic burden subjects based only on practical exams.
        </p>
      </div>

      {/* Alert */}
      <div className="mx-auto max-w-3xl rounded-xl border border-green-200 bg-green-50 p-4 mb-10 flex items-start gap-3">
        <Info size={24} className="text-green-600 shrink-0 mt-0.5" weight="fill" />
        <p className="text-sm font-medium text-green-800">
          Note: These subjects are evaluated based on practical exams/assessments only, meaning no written end-semester theory exam.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-10 rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-foreground mb-4">How it works</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-muted">
          <li>Browse the list of practical-only SEC and VAC subjects below.</li>
          <li>Use the search bar to quickly find a specific subject.</li>
          <li>Choose these subjects during your college preference selection for a lighter academic load.</li>
        </ol>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <input
          type="text"
          placeholder="Search for subjects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </div>

      {/* 2-Column Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SEC Column */}
        <div className="rounded-2xl border border-border bg-surface-muted/30 overflow-hidden">
          <div className="bg-surface border-b border-border p-4">
            <h3 className="font-semibold text-foreground">
              Skill Enhancement Courses (SEC)
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredSec.length === 0 ? (
              <p className="text-sm text-muted col-span-full py-4 text-center">
                No SEC subjects found.
              </p>
            ) : (
              filteredSec.map((subject) => (
                <div
                  key={subject}
                  className="flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-3 text-center text-[13px] font-medium text-muted transition hover:border-brand hover:text-foreground cursor-default"
                >
                  {subject}
                </div>
              ))
            )}
          </div>
        </div>

        {/* VAC Column */}
        <div className="rounded-2xl border border-border bg-surface-muted/30 overflow-hidden self-start">
          <div className="bg-surface border-b border-border p-4">
            <h3 className="font-semibold text-foreground">
              Value Addition Courses (VAC)
            </h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filteredVac.length === 0 ? (
              <p className="text-sm text-muted col-span-full py-4 text-center">
                No VAC subjects found.
              </p>
            ) : (
              filteredVac.map((subject) => (
                <div
                  key={subject}
                  className="flex items-center justify-center rounded-lg border border-border bg-surface px-3 py-3 text-center text-[13px] font-medium text-muted transition hover:border-brand hover:text-foreground cursor-default"
                >
                  {subject}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
