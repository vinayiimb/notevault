"use client";

import { useState } from "react";
import { Calendar, Info, MagnifyingGlass, WarningCircle, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

export function ERDecoderClient() {
  const [semester, setSemester] = useState("1");
  const [paperType, setPaperType] = useState("ER");
  const [paperTitle, setPaperTitle] = useState("");
  const [degreeLength, setDegreeLength] = useState("3");

  const semInt = parseInt(semester);
  const isOdd = semInt % 2 !== 0;
  const maxSpan = parseInt(degreeLength) + 2; // Maximum span is N+2 years

  let nextCycle = "";
  if (semInt === 5 || semInt === 6) {
    nextCycle = isOdd ? "Ex-Student (Next Odd Semester - Nov/Dec)" : "Ex-Student (Next Even Semester - May/June)";
  } else {
    nextCycle = isOdd ? `Semester ${semInt + 2} (Next Odd Semester - Nov/Dec)` : `Semester ${semInt + 2} (Next Even Semester - May/June)`;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Form */}
      <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm space-y-6">
        <h2 className="font-bold text-lg mb-2">Paper Details</h2>
        
        <div>
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Paper Title / Subject</label>
          <input 
            type="text" 
            value={paperTitle} 
            onChange={(e) => setPaperTitle(e.target.value)}
            placeholder="e.g. Constitutional Law"
            className="w-full p-3 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Semester</label>
            <select 
              value={semester} 
              onChange={(e) => setSemester(e.target.value)}
              className="w-full p-3 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none"
            >
              {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Degree Length</label>
            <select 
              value={degreeLength} 
              onChange={(e) => setDegreeLength(e.target.value)}
              className="w-full p-3 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none"
            >
              <option value="3">3 Years</option>
              <option value="4">4 Years</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">Type of Re-appearance</label>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border bg-surface hover:bg-surface-muted transition">
              <input 
                type="radio" name="type" value="ER" checked={paperType === "ER"} onChange={(e) => setPaperType(e.target.value)}
                className="w-4 h-4 text-brand focus:ring-brand"
              />
              <span className="text-sm font-bold">Essential Repeat (ER) / Failed</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-border bg-surface hover:bg-surface-muted transition">
              <input 
                type="radio" name="type" value="IMPROVEMENT" checked={paperType === "IMPROVEMENT"} onChange={(e) => setPaperType(e.target.value)}
                className="w-4 h-4 text-brand focus:ring-brand"
              />
              <span className="text-sm font-bold">Improvement (Passed, want better grade)</span>
            </label>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-6">
        <div className="bg-brand-soft/20 p-6 rounded-2xl border border-brand-soft shadow-sm">
          <h3 className="font-bold text-brand uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
            <Calendar size={16} /> When you can reappear
          </h3>
          <p className="text-2xl font-black text-foreground mb-4">{nextCycle}</p>
          
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-sm text-muted">
              <CheckCircle size={16} className="shrink-0 mt-0.5 text-green-600" />
              <p><strong>Odd/Even Rule:</strong> You can only appear for Odd semester papers in Odd semesters (Nov/Dec) and Even semester papers in Even semesters (May/June).</p>
            </div>
            
            <div className="flex items-start gap-2 text-sm text-muted">
              <WarningCircle size={16} className="shrink-0 mt-0.5 text-yellow-600" />
              <p><strong>Max Span Period:</strong> You must clear this paper within <strong>{maxSpan} years</strong> of your admission. After this, you will not be allowed to reappear.</p>
            </div>

            {paperType === "IMPROVEMENT" && (
              <div className="flex items-start gap-2 text-sm text-muted">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p><strong>Improvement Rule:</strong> You can only attempt an improvement exam <strong className="text-foreground">once</strong> per paper.</p>
              </div>
            )}
          </div>
        </div>

        {/* PYQ Integration */}
        <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
          <h3 className="font-bold text-lg mb-2">Preparation</h3>
          <p className="text-sm text-muted mb-4">The best way to clear an {paperType} is by practicing Previous Year Questions. {paperTitle && `Search for "${paperTitle}" papers below.`}</p>
          
          <Link
            href={`/papers?q=${encodeURIComponent(paperTitle)}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground hover:bg-brand-hover transition shadow-sm"
          >
            <MagnifyingGlass size={18} />
            Search PYQs {paperTitle ? `for ${paperTitle}` : ""}
          </Link>
        </div>
      </div>
    </div>
  );
}
