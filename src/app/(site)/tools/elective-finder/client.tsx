"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { MagnifyingGlass, BookOpenText, Target, Funnel, Star, GraduationCap, Briefcase } from "@phosphor-icons/react/dist/ssr";

export function ElectiveFinderClient({ courses }: { courses: any[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("ALL");
  const [practicalOnly, setPracticalOnly] = useState(false);
  const [credits, setCredits] = useState("ALL");
  const [majorFilter, setMajorFilter] = useState("");

  // Minor mapping for demo purposes. In a real db, this would be tied to the discipline.
  const isMinorEligible = (c: any) => c.totalCredits === 4 && (c.courseType === "GE" || c.courseType === "DSE");

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (!c.title) return false;

      // Text search
      if (query && !c.title.toLowerCase().includes(query.toLowerCase()) && !c.upcs.some((u:string) => u.toLowerCase().includes(query.toLowerCase()))) {
        return false;
      }

      // Category filter
      if (category !== "ALL" && c.courseType !== category) return false;

      // Practical Only
      if (practicalOnly && c.assessment.theoryMarks > 0) return false;

      // Credits
      if (credits !== "ALL" && c.totalCredits.toString() !== credits) return false;

      // GE Rule (Cannot take GE from own major)
      if (majorFilter && c.courseType === "GE") {
        if (c.title.toLowerCase().includes(majorFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [query, category, practicalOnly, credits, majorFilter, courses]);

  return (
    <div className="flex flex-col md:flex-row gap-6">
      {/* Sidebar Filters */}
      <div className="w-full md:w-64 shrink-0 space-y-6">
        <div className="bg-surface border border-border p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-2 font-bold mb-4">
            <Funnel size={20} className="text-brand" />
            <span>Filters</span>
          </div>
          
          <div className="space-y-4">
            {/* Practical Toggle */}
            <label className="flex items-center gap-3 cursor-pointer p-3 bg-brand-soft/20 rounded-xl border border-brand-soft hover:bg-brand-soft/40 transition">
              <input 
                type="checkbox" 
                checked={practicalOnly} 
                onChange={(e) => setPracticalOnly(e.target.checked)}
                className="w-4 h-4 rounded text-brand focus:ring-brand"
              />
              <span className="text-sm font-bold text-foreground">Practical Only (No Theory Exam)</span>
            </label>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Course Type</label>
              <select 
                value={category} 
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-2.5 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand"
              >
                <option value="ALL">All Electives</option>
                <option value="SEC">Skill Enhancement (SEC)</option>
                <option value="VAC">Value Addition (VAC)</option>
                <option value="AEC">Ability Enhancement (AEC)</option>
                <option value="GE">General Elective (GE)</option>
              </select>
            </div>

            {/* Credits */}
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Credits</label>
              <select 
                value={credits} 
                onChange={(e) => setCredits(e.target.value)}
                className="w-full p-2.5 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand"
              >
                <option value="ALL">Any Credits</option>
                <option value="4">4 Credits</option>
                <option value="2">2 Credits</option>
              </select>
            </div>

            {/* GE Eligibility Tool */}
            <div className="pt-4 border-t border-border">
              <label className="block text-xs font-bold text-brand uppercase tracking-wider mb-2">My Major Discipline</label>
              <p className="text-[10px] text-muted mb-2">GE courses from your own major will be hidden.</p>
              <input 
                type="text" 
                value={majorFilter} 
                onChange={(e) => setMajorFilter(e.target.value)}
                placeholder="e.g. Commerce, Physics"
                className="w-full p-2.5 bg-surface border border-brand-soft rounded-xl text-sm focus:ring-2 focus:ring-brand"
              />
            </div>

          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Search Input */}
        <div className="relative shadow-sm rounded-2xl">
          <MagnifyingGlass size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search electives by title or UPC..."
            className="w-full rounded-2xl border-2 border-border bg-surface py-3 pl-12 pr-4 text-sm text-foreground outline-none focus:border-brand focus:ring-4 focus:ring-brand-soft transition"
          />
        </div>

        {/* Results Grid */}
        <div className="bg-surface border border-border rounded-2xl shadow-sm p-4 sm:p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bold text-lg">Results ({filtered.length})</h2>
          </div>

          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filtered.map((c, i) => (
                <div key={i} className="border border-border rounded-xl p-4 hover:border-brand/50 transition bg-surface-muted/30 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="inline-flex items-center rounded bg-accent-soft px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                        {c.courseType || "General"}
                      </span>
                      <span className="text-[10px] font-bold text-muted bg-surface-muted px-2 py-0.5 rounded border border-border">
                        {c.totalCredits} CREDITS
                      </span>
                      {isMinorEligible(c) && (
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-700 border border-blue-200">
                          <GraduationCap size={12} /> Counts for Minor
                        </span>
                      )}
                      {c.title.toLowerCase().includes("data") || c.title.toLowerCase().includes("finance") || c.title.toLowerCase().includes("skill") ? (
                         <span className="inline-flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-700 border border-orange-200">
                         <Briefcase size={12} /> High Employability
                       </span>
                      ) : null}
                    </div>
                    <h3 className="font-bold text-base text-foreground mb-1">
                      {c.title}
                    </h3>
                    <div className="flex flex-wrap gap-4 text-xs text-muted mt-2">
                      <span className="flex items-center gap-1"><BookOpenText size={14} /> Theory: {c.structure.theory}</span>
                      <span className="flex items-center gap-1"><Target size={14} /> Practical: {c.structure.practical}</span>
                      <span className="flex items-center gap-1">UPC: {c.upcs[0]}</span>
                    </div>
                  </div>
                  
                  <Link href={`/course/${c.slug}`} className="shrink-0 bg-brand text-brand-foreground text-xs font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition whitespace-nowrap self-start sm:self-center text-center">
                    View Details
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted">
              <p>No electives match your current filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
