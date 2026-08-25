"use client";

import { useState } from "react";
import { FileText, WarningCircle, Bell, ArrowRight, ShieldCheck, XCircle } from "@phosphor-icons/react/dist/ssr";

export default function RevaluationPage() {
  const [examType, setExamType] = useState("THEORY");

  const isEligible = examType === "THEORY";

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          Revaluation & Exam Branch Hub
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Access the latest examination branch rules, check your eligibility, and securely find your private result portal.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Rules & Status */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-start gap-3 text-yellow-900 shadow-sm">
            <Bell size={24} className="shrink-0 mt-0.5 text-yellow-600" />
            <div>
              <h3 className="font-bold text-sm mb-1">New Notice: Exam Branch (August 2026)</h3>
              <p className="text-sm">
                The portal for applying for Revaluation / Rechecking for Even Semester results is currently active. You must apply within <strong>15 days</strong> of the declaration of your result.
              </p>
            </div>
          </div>

          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm space-y-6">
            <h2 className="font-bold text-lg mb-2">Eligibility Checker</h2>
            
            <div>
              <label className="block text-xs font-bold text-muted uppercase tracking-wider mb-2">What component do you want to re-evaluate?</label>
              <select 
                value={examType} 
                onChange={(e) => setExamType(e.target.value)}
                className="w-full p-3 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none mb-4"
              >
                <option value="THEORY">Theory Exam (Written)</option>
                <option value="PRACTICAL">Practical Exam</option>
                <option value="IA">Internal Assessment (IA)</option>
                <option value="CA">Continuous Assessment (CA)</option>
                <option value="VIVA">Viva Voce</option>
              </select>

              {isEligible ? (
                <div className="p-4 rounded-xl border bg-green-50 border-green-200 text-green-900 flex items-start gap-3">
                  <ShieldCheck size={20} className="shrink-0 mt-0.5 text-green-600" />
                  <p className="text-sm font-medium">You are eligible to apply for Revaluation or Rechecking for Theory exams.</p>
                </div>
              ) : (
                <div className="p-4 rounded-xl border bg-red-50 border-red-200 text-red-900 flex items-start gap-3">
                  <XCircle size={20} className="shrink-0 mt-0.5 text-red-600" />
                  <div>
                    <p className="text-sm font-bold mb-1">Not Eligible</p>
                    <p className="text-sm">Under DU UGCF rules, revaluation is strictly prohibited for {examType}. Marks awarded by your college for internal/practical components are final.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className={`bg-surface border p-5 rounded-2xl transition flex flex-col ${isEligible ? "border-border shadow-sm" : "border-border opacity-50 grayscale"}`}>
              <h3 className="font-bold text-lg mb-2">Revaluation</h3>
              <p className="text-sm text-muted mb-4 flex-1">
                Complete re-evaluation of your answer script by an independent examiner.
              </p>
              <div className="space-y-2 mb-4 text-xs font-medium bg-surface-muted p-3 rounded-lg">
                <div className="flex justify-between"><span>Fee:</span> <span className="text-foreground">₹1000 / paper</span></div>
              </div>
              <button disabled={!isEligible} className="bg-brand text-brand-foreground font-bold text-sm w-full py-2.5 rounded-xl disabled:bg-surface-muted disabled:text-muted">Apply Online</button>
            </div>

            <div className={`bg-surface border p-5 rounded-2xl transition flex flex-col ${isEligible ? "border-border shadow-sm" : "border-border opacity-50 grayscale"}`}>
              <h3 className="font-bold text-lg mb-2">Rechecking</h3>
              <p className="text-sm text-muted mb-4 flex-1">
                Only the totaling of marks is verified. Answers are not re-evaluated.
              </p>
              <div className="space-y-2 mb-4 text-xs font-medium bg-surface-muted p-3 rounded-lg">
                <div className="flex justify-between"><span>Fee:</span> <span className="text-foreground">₹750 / paper</span></div>
              </div>
              <button disabled={!isEligible} className="bg-brand text-brand-foreground font-bold text-sm w-full py-2.5 rounded-xl disabled:bg-surface-muted disabled:text-muted">Apply Online</button>
            </div>
          </div>
        </div>

        {/* Right Column: Private Result */}
        <div className="space-y-6">
          <div className="bg-brand-soft/20 border border-brand-soft p-6 rounded-2xl shadow-sm">
            <h3 className="font-bold text-brand uppercase tracking-wider text-xs mb-3 flex items-center gap-2">
              <FileText size={16} />
              Private Result Lookup
            </h3>
            <p className="text-sm text-muted mb-6">Enter your enrollment details to be securely redirected to your Samarth result portal.</p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">College Name</label>
                <input type="text" placeholder="e.g. Hansraj College" className="w-full p-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Exam Roll No.</label>
                <input type="text" placeholder="e.g. 23029XXXXXX" className="w-full p-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-brand" />
              </div>
              <div>
                <label className="block text-xs font-bold text-foreground uppercase mb-1">Date of Birth</label>
                <input type="date" className="w-full p-2.5 bg-surface border border-border rounded-lg text-sm outline-none focus:border-brand" />
              </div>
            </div>

            <a href="https://slc.uod.ac.in/" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full rounded-xl bg-brand py-3 text-sm font-bold text-brand-foreground hover:bg-brand-hover transition shadow-sm">
              Proceed to Samarth <ArrowRight size={16} />
            </a>
          </div>

          <div className="bg-surface-muted/50 p-6 rounded-2xl border border-border">
            <h3 className="font-bold text-foreground text-sm mb-3">Rules to remember</h3>
            <ul className="list-disc list-inside space-y-2 text-xs text-muted">
              <li>If the revaluated marks are lower, the original marks are restored (you cannot lose marks).</li>
              <li>Revaluation usually takes 2-3 months to process.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
