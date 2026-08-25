"use client";

import { useState } from "react";
import { GraduationCap, ArrowRight, WarningCircle, CheckCircle, Calculator } from "@phosphor-icons/react/dist/ssr";

export function DegreePlannerClient() {
  const [batch, setBatch] = useState("2024-25");
  const [progType, setProgType] = useState("HONOURS");
  const [sems, setSems] = useState("2");
  
  // Transcript
  const [dscCredits, setDscCredits] = useState(0);
  const [dseCredits, setDseCredits] = useState(0);
  const [geCredits, setGeCredits] = useState(0);
  const [geMinorCredits, setGeMinorCredits] = useState(0); // Credits in a specific minor subject
  const [secVacAecCredits, setSecVacAecCredits] = useState(0);
  
  // Research
  const [cgpa, setCgpa] = useState("");
  const [hasResearchMethodology, setHasResearchMethodology] = useState(false);

  const semesters = parseInt(sems) || 2;
  const totalCredits = dscCredits + dseCredits + geCredits + secVacAecCredits;

  // Logic Engine: Promotion
  const getPromotionStatus = () => {
    let required = 0;
    if (semesters === 2) required = 22;
    if (semesters === 4) required = 44;
    if (semesters === 6) required = 66;
    
    if (totalCredits >= required) {
      return { status: "PASS", message: `Eligible for promotion. Total: ${totalCredits} / ${required} required.` };
    }
    return { status: "FAIL", message: `Not eligible. You need ${required} credits, but have ${totalCredits}.` };
  };

  // Logic Engine: Minor
  const checkMinor = () => {
    // Minor requires 28 credits in a single discipline other than the major
    if (geMinorCredits >= 28) {
      return { status: "PASS", message: `You have earned a Minor! (${geMinorCredits} credits in a single GE/DSE discipline)` };
    }
    return { status: "FAIL", message: `No minor awarded. You need 28 credits in a single discipline outside your major (Currently: ${geMinorCredits}).` };
  };

  // Logic Engine: Fourth Year Track
  const getFourthYearTrack = () => {
    if (semesters < 6 || totalCredits < 132) {
      return "Not yet eligible for Semester VII.";
    }

    const currentCgpa = parseFloat(cgpa) || 0;
    if (currentCgpa >= 7.5 && hasResearchMethodology) {
      return "Eligible for 4-Year Bachelor's Degree (Honours with Research). Based on July 2026 rules, you will follow the new 10-credit structure per semester.";
    } else {
      return "Eligible for 4-Year Bachelor's Degree (Honours). You do not meet the Research track requirements (CGPA 7.5+ and Research Methodology).";
    }
  };

  const getExitOptions = () => {
    const options = [];
    if (totalCredits >= 44 && semesters >= 2) options.push("Undergraduate Certificate");
    if (totalCredits >= 88 && semesters >= 4) options.push("Undergraduate Diploma");
    if (totalCredits >= 132 && semesters >= 6) options.push("Bachelor's Degree");
    if (totalCredits >= 176 && semesters >= 8) options.push("4-Year Bachelor's Degree");
    return options;
  };

  const promotion = getPromotionStatus();
  const minor = checkMinor();
  const exits = getExitOptions();
  const track = getFourthYearTrack();

  return (
    <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Form */}
        <div className="space-y-6">
          <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
            <GraduationCap size={24} className="text-brand" />
            Transcript Analyzer
          </h2>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-muted uppercase mb-2">Batch</label>
              <select value={batch} onChange={(e) => setBatch(e.target.value)} className="w-full p-2.5 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none">
                <option value="2024-25">2024-25</option>
                <option value="2025-26">2025-26 (New Rules)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-muted uppercase mb-2">Semesters</label>
              <select value={sems} onChange={(e) => setSems(e.target.value)} className="w-full p-2.5 bg-surface-muted border border-border rounded-xl text-sm focus:ring-2 focus:ring-brand outline-none">
                <option value="2">Year 1 (Sem 1 & 2)</option>
                <option value="4">Year 2 (Sem 3 & 4)</option>
                <option value="6">Year 3 (Sem 5 & 6)</option>
                <option value="8">Year 4 (Sem 7 & 8)</option>
              </select>
            </div>
          </div>

          <div className="bg-surface-muted p-4 rounded-xl space-y-4">
            <h3 className="font-bold text-sm uppercase tracking-wider text-muted">Credits Earned</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-muted mb-1">DSC (Core)</label>
                <input type="number" value={dscCredits || ""} onChange={(e) => setDscCredits(parseInt(e.target.value)||0)} className="w-full p-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1">DSE (Elective)</label>
                <input type="number" value={dseCredits || ""} onChange={(e) => setDseCredits(parseInt(e.target.value)||0)} className="w-full p-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-muted mb-1">GE (General)</label>
                <input type="number" value={geCredits || ""} onChange={(e) => setGeCredits(parseInt(e.target.value)||0)} className="w-full p-2 border border-border rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-brand mb-1">Minor Subject GE</label>
                <input type="number" value={geMinorCredits || ""} onChange={(e) => setGeMinorCredits(parseInt(e.target.value)||0)} className="w-full p-2 border border-brand-soft rounded-lg text-sm bg-brand-soft/10" placeholder="e.g. 28" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-muted mb-1">SEC / VAC / AEC</label>
                <input type="number" value={secVacAecCredits || ""} onChange={(e) => setSecVacAecCredits(parseInt(e.target.value)||0)} className="w-full p-2 border border-border rounded-lg text-sm" />
              </div>
            </div>
          </div>

          {semesters >= 6 && (
            <div className="bg-brand-soft/20 p-4 rounded-xl space-y-4 border border-brand-soft">
              <h3 className="font-bold text-sm uppercase tracking-wider text-brand">Research Track (Year 4)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted mb-1">Current CGPA</label>
                  <input type="number" step="0.1" value={cgpa} onChange={(e) => setCgpa(e.target.value)} placeholder="e.g. 7.8" className="w-full p-2 border border-border rounded-lg text-sm" />
                </div>
                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={hasResearchMethodology} onChange={(e) => setHasResearchMethodology(e.target.checked)} className="w-4 h-4 rounded text-brand focus:ring-brand" />
                    <span className="text-sm font-bold text-foreground">Taken Research Methodology?</span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-surface-muted/50 p-6 rounded-2xl border border-border flex flex-col gap-5">
          
          <div className="flex justify-between items-end mb-2">
            <h3 className="font-bold text-xl text-foreground">Engine Results</h3>
            <div className="text-right">
              <p className="text-xs text-muted uppercase font-bold">Total Credits</p>
              <p className="text-2xl font-black text-brand">{totalCredits}</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider mb-2">Promotion</h4>
            <div className={`p-3 rounded-xl border flex items-start gap-3 ${promotion.status === "PASS" ? "bg-green-50 border-green-200 text-green-900" : "bg-red-50 border-red-200 text-red-900"}`}>
              {promotion.status === "PASS" ? <CheckCircle size={20} className="shrink-0 mt-0.5 text-green-600" /> : <WarningCircle size={20} className="shrink-0 mt-0.5 text-red-600" />}
              <p className="text-sm font-medium">{promotion.message}</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider mb-2">Minor Status</h4>
            <div className={`p-3 rounded-xl border flex items-start gap-3 ${minor.status === "PASS" ? "bg-blue-50 border-blue-200 text-blue-900" : "bg-surface border-border text-muted"}`}>
              {minor.status === "PASS" ? <CheckCircle size={20} className="shrink-0 mt-0.5 text-blue-600" /> : <Calculator size={20} className="shrink-0 mt-0.5" />}
              <p className="text-sm font-medium">{minor.message}</p>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-xs text-muted uppercase tracking-wider mb-2">Eligible Exits</h4>
            {exits.length > 0 ? (
              <ul className="space-y-1.5">
                {exits.map((opt, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm font-medium text-foreground bg-surface p-2.5 rounded-lg border border-border shadow-sm">
                    <ArrowRight size={16} className="text-brand" />
                    {opt}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted italic bg-surface p-3 rounded-lg border border-border">Not eligible for any exit option yet.</p>
            )}
          </div>

          {semesters >= 6 && (
            <div className="mt-auto pt-4 border-t border-border">
              <h4 className="font-bold text-xs text-brand uppercase tracking-wider mb-2">Fourth-Year Track (July 2026 Rules)</h4>
              <p className="text-sm font-medium text-foreground bg-brand-soft/20 p-3 rounded-lg border border-brand-soft">
                {track}
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
