"use client";
import { useState } from 'react';
import { FilePdf, FirstAidKit, Stethoscope, CaretRight, CheckCircle, Warning, MagnifyingGlass, Info } from "@phosphor-icons/react";

export default function ResultDoctorPage() {
  const [uploaded, setUploaded] = useState(false);

  return (
    <div className="container max-w-4xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <header className="mb-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-brand-soft text-brand mb-4">
          <Stethoscope size={32} weight="fill" />
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-foreground mb-3">
          Result Doctor
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Upload your marksheets to diagnose ERs, analyze revaluation chances, and get clear next steps.
        </p>
      </header>

      {!uploaded ? (
        <div className="max-w-2xl mx-auto">
          <div 
            className="border-2 border-dashed border-border rounded-3xl p-12 text-center bg-surface-muted/30 hover:bg-surface-muted/50 transition cursor-pointer group"
            onClick={() => setUploaded(true)}
          >
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-brand/10 p-4 group-hover:scale-110 transition-transform">
                <FilePdf size={48} className="text-brand" weight="duotone" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Upload Marksheet (PDF)</h3>
            <p className="text-muted max-w-md mx-auto mb-6">
              Drop your official DU marksheet here, or click to browse. We'll instantly diagnose your results.
            </p>
            <button className="rounded-xl bg-brand px-6 py-2.5 font-bold text-brand-foreground shadow-sm">
              Select File
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4">
          {/* Summary Card */}
          <div className="rounded-3xl border border-border bg-surface p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 pb-6 border-b border-border gap-4">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-1">Result Health Summary</h2>
                <p className="text-muted font-medium">B.Sc Zoology • Semester 3 • Nov/Dec 2025</p>
              </div>
              <div className="rounded-2xl bg-red-500/10 px-4 py-2 border border-red-500/20">
                <span className="font-bold text-red-600 dark:text-red-400 flex items-center gap-2">
                  <FirstAidKit size={20} weight="fill" /> Attention Required
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="rounded-2xl bg-surface-muted p-5 text-center border border-border">
                <div className="text-3xl font-extrabold text-foreground mb-1">6</div>
                <div className="text-sm font-bold text-muted uppercase tracking-wider">Papers OK</div>
              </div>
              <div className="rounded-2xl bg-red-500/10 p-5 text-center border border-red-500/20">
                <div className="text-3xl font-extrabold text-red-600 dark:text-red-400 mb-1">1</div>
                <div className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">ER (Essential Repeat)</div>
              </div>
              <div className="rounded-2xl bg-amber-500/10 p-5 text-center border border-amber-500/20">
                <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 mb-1">1</div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Suspicious Result</div>
              </div>
            </div>
          </div>

          {/* Deep Dive Diagnosis */}
          <h3 className="text-xl font-bold text-foreground px-2 flex items-center gap-2">
            <MagnifyingGlass size={24} className="text-brand" /> Detailed Diagnosis
          </h3>
          
          <div className="rounded-3xl border border-border bg-surface overflow-hidden shadow-sm">
            {/* Suspicious ER */}
            <div className="p-6 sm:p-8 border-b border-border bg-red-500/5">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-red-500/20 p-2 text-red-600 dark:text-red-400 mt-1">
                  <Warning size={24} weight="fill" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <h4 className="text-lg font-bold text-foreground">Genetics (Core)</h4>
                    <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">ER</span>
                  </div>
                  <p className="text-muted leading-relaxed mb-4">
                    <strong className="text-foreground">Diagnosis:</strong> You scored 22/25 in Internal Assessment, but only 12/75 in the Theory Exam. This massive discrepancy is highly unusual. It is very likely a totaling error or an unchecked sheet.
                  </p>
                  
                  <div className="rounded-2xl bg-surface p-4 border border-border">
                    <h5 className="font-bold text-foreground mb-2 flex items-center gap-2">
                      <CheckCircle size={18} className="text-brand" weight="fill" /> Recommended Action
                    </h5>
                    <p className="text-sm text-muted mb-4">
                      Apply for <strong className="text-foreground">Revaluation (₹1000)</strong> immediately. Do not apply for Rechecking (₹750), as rechecking only recounts the marks and does not re-evaluate answers.
                    </p>
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-red-500">Deadline: 15 Feb 2026</span>
                      <button className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-brand-foreground shadow-sm hover:bg-brand/90 transition flex items-center gap-1">
                        Start Revaluation Process <CaretRight size={16} weight="bold" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Normal Paper */}
            <div className="p-6 sm:p-8 flex items-start gap-4">
              <div className="rounded-xl bg-green-500/20 p-2 text-green-600 dark:text-green-400 mt-1">
                <CheckCircle size={24} weight="fill" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-foreground mb-1">Ecology (Core)</h4>
                <p className="text-muted">Cleared with an A grade. No action needed.</p>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center pt-4">
             <button 
               className="text-sm font-bold text-muted hover:text-foreground transition underline flex items-center gap-1"
               onClick={() => setUploaded(false)}
             >
               Upload a different marksheet
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
