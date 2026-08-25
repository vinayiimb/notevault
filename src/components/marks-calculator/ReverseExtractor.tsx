"use client";
import { useState, useMemo } from "react";
import { Plus, Trash2, ArrowDown, Sparkles, Copy, Check } from "lucide-react";

interface ExtractorSubject {
  id: string;
  name: string;
  credits: number;
  gradePoint: number;
  totalMax: number;
  iaMarks: number;
  caMarks: number;
}

let idCounter = 1;
const makeSubject = (): ExtractorSubject => ({
  id: String(idCounter++),
  name: "",
  credits: 4,
  gradePoint: 0,
  totalMax: 160,
  iaMarks: 0,
  caMarks: 0,
});

export default function ReverseExtractor() {
  const [subjects, setSubjects] = useState<ExtractorSubject[]>([makeSubject()]);
  
  // Modals state
  const [activeModal, setActiveModal] = useState<"none" | "marksheet" | "internal">("none");
  const [importJson, setImportJson] = useState("");
  const [importError, setImportError] = useState("");
  const [isCopied, setIsCopied] = useState(false);

  const marksheetPrompt = `I am providing an image of my Delhi University Statement of Marks. Please extract the data into a JSON array of objects. For each row in the table, create an object with these keys: 'name' (string, derived from 'Paper Title'), 'credits' (number, derived from 'CRDT'), and 'gradePoint' (number, derived from 'GRPT'). Return ONLY the raw JSON array without markdown. Example: [{"name": "BUSINESS LAWS", "credits": 4, "gradePoint": 8}]`;
  
  const internalPrompt = `I am providing raw text from my Delhi University Internal Assessment portal. Extract the data into a JSON array of objects. For each subject, look for the 'Name of Paper', the 'IA' marks (which might be labeled as 'Obtain Out Of' near 'Total IA' or 'IA'), and the 'CA' marks (which might be labeled as 'CA'). Also find the 'Total Max' for the subject (usually 160, 80, etc.). Return ONLY a valid JSON array of objects with keys: 'name' (string), 'iaMarks' (number), 'caMarks' (number), 'totalMax' (number). Return ONLY the raw JSON array without markdown. Example: [{"name": "BUSINESS LAWS", "iaMarks": 25, "caMarks": 36, "totalMax": 160}]`;

  const getPercentageRange = (gp: number) => {
    if (gp === 10) return { min: 90, max: 100 };
    if (gp === 9) return { min: 80, max: 89.99 };
    if (gp === 8) return { min: 70, max: 79.99 };
    if (gp === 7) return { min: 60, max: 69.99 };
    if (gp === 6) return { min: 55, max: 59.99 };
    if (gp === 5) return { min: 50, max: 54.99 };
    if (gp === 4) return { min: 40, max: 49.99 };
    return { min: 0, max: 39.99 };
  };

  const copyPrompt = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const similarity = (s1: string, s2: string) => {
    const w1 = s1.toLowerCase().split(/\W+/).filter(Boolean);
    const w2 = s2.toLowerCase().split(/\W+/).filter(Boolean);
    const intersection = w1.filter((w) => w2.includes(w));
    return intersection.length / Math.max(w1.length, w2.length);
  };

  const handleImport = () => {
    try {
      setImportError("");
      let cleanJson = importJson.trim();
      const arrayMatch = cleanJson.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        cleanJson = arrayMatch[0];
      }
      
      const parsed = JSON.parse(cleanJson);
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");

      let currentSubjects = [...subjects];

      if (activeModal === "marksheet") {
        // Import final grades
        const newSubjects = parsed.map((item: any) => ({
          id: String(idCounter++),
          name: String(item.name || "Unknown"),
          credits: Number(item.credits) || 0,
          gradePoint: Number(item.gradePoint) || 0,
          totalMax: Number(item.credits) === 2 ? 80 : 160, // Default heuristic
          iaMarks: 0,
          caMarks: 0,
        }));
        
        // If current is just empty defaults, replace entirely. Otherwise append/merge.
        if (currentSubjects.length === 1 && !currentSubjects[0].name && currentSubjects[0].gradePoint === 0) {
          setSubjects(newSubjects);
        } else {
          setSubjects([...currentSubjects, ...newSubjects]);
        }
      } else if (activeModal === "internal") {
        // Import internal marks and try to merge them into existing subjects based on name
        const importedInternals = parsed.map((item: any) => ({
          name: String(item.name || ""),
          iaMarks: Number(item.iaMarks) || 0,
          caMarks: Number(item.caMarks) || 0,
          totalMax: Number(item.totalMax) || 160,
        }));

        importedInternals.forEach(importItem => {
          // Find best match in currentSubjects
          let bestMatchIndex = -1;
          let bestScore = 0;
          currentSubjects.forEach((sub, i) => {
            const score = similarity(sub.name, importItem.name);
            if (score > bestScore && score > 0.3) {
              bestScore = score;
              bestMatchIndex = i;
            }
          });

          if (bestMatchIndex !== -1) {
            // Merge
            currentSubjects[bestMatchIndex] = {
              ...currentSubjects[bestMatchIndex],
              iaMarks: importItem.iaMarks,
              caMarks: importItem.caMarks,
              totalMax: importItem.totalMax || currentSubjects[bestMatchIndex].totalMax,
            };
          } else {
            // Append as new
            currentSubjects.push({
              id: String(idCounter++),
              name: importItem.name,
              credits: importItem.totalMax === 80 ? 2 : 4,
              gradePoint: 0,
              totalMax: importItem.totalMax,
              iaMarks: importItem.iaMarks,
              caMarks: importItem.caMarks,
            });
          }
        });

        setSubjects([...currentSubjects]);
      }

      setActiveModal("none");
      setImportJson("");
    } catch (e: any) {
      setImportError("Import failed: " + (e.message || "Invalid JSON"));
    }
  };

  const updateSubject = (id: string, field: keyof ExtractorSubject, value: any) => {
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const removeSubject = (id: string) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Import both your Marksheet and Internal Marks to automatically extract your calculated Theory scores.
        </p>
        <div className="flex gap-2">
          <button onClick={() => setActiveModal("marksheet")} className="flex items-center gap-2 text-xs font-medium bg-surface border px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <Sparkles className="w-3 h-3 text-primary" /> Marksheet Import
          </button>
          <button onClick={() => setActiveModal("internal")} className="flex items-center gap-2 text-xs font-medium bg-surface border px-3 py-1.5 rounded-md hover:bg-muted/50 transition-colors">
            <Sparkles className="w-3 h-3 text-primary" /> Internal Marks Import
          </button>
        </div>
      </div>

      {activeModal !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setActiveModal("none")}>
          <div className="w-full max-w-[500px] bg-surface border rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-5 h-5 text-primary" /> 
                {activeModal === "marksheet" ? "AI Marksheet Import" : "AI Internal Marks Import"}
              </h2>
              <button onClick={() => setActiveModal("none")} className="text-muted-foreground hover:text-foreground">&times;</button>
            </div>
            <div className="space-y-4 p-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">1. Copy this prompt for ChatGPT:</p>
                <div className="relative">
                  <div className="p-3 bg-secondary/50 rounded-lg text-xs font-mono text-muted-foreground border break-words">
                    {activeModal === "marksheet" ? marksheetPrompt : internalPrompt}
                  </div>
                  <button
                    className="absolute top-2 right-2 h-7 px-2 text-xs font-medium bg-secondary border rounded hover:bg-secondary/80 flex items-center"
                    onClick={() => copyPrompt(activeModal === "marksheet" ? marksheetPrompt : internalPrompt)}
                  >
                    {isCopied ? <Check className="w-3 h-3 mr-1 text-success" /> : <Copy className="w-3 h-3 mr-1" />}
                    {isCopied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">2. Paste the JSON result here:</p>
                <textarea
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  placeholder="[\n  {\n    ...\n  }\n]"
                  className="w-full font-mono text-sm h-32 bg-secondary/30 border rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                {importError && <p className="text-xs text-destructive">{importError}</p>}
              </div>
              <button onClick={handleImport} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-2 rounded-md transition-colors">
                Import Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {subjects.map((sub, index) => {
          const range = getPercentageRange(sub.gradePoint);
          
          const minObtained = Math.ceil(sub.totalMax * (range.min / 100));
          const maxObtained = Math.floor(sub.totalMax * (range.max / 100));
          
          let minTheory = minObtained - sub.iaMarks - sub.caMarks;
          let maxTheory = maxObtained - sub.iaMarks - sub.caMarks;
          
          if (minTheory < 0) minTheory = 0;
          
          let theoryDisplay = "";
          if (sub.gradePoint === 0) {
            theoryDisplay = "FAIL";
          } else if (sub.gradePoint === 10) {
            theoryDisplay = `>= ${minTheory}`;
          } else {
            theoryDisplay = `${minTheory} - ${maxTheory}`;
          }

          return (
            <div key={sub.id} className="bg-surface rounded-xl border p-4 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-2">
                <input
                  type="text"
                  value={sub.name}
                  onChange={(e) => updateSubject(sub.id, "name", e.target.value)}
                  placeholder={`Subject ${index + 1}`}
                  className="bg-transparent border-none focus:ring-0 font-medium p-0 text-sm w-full max-w-[300px]"
                />
                <button
                  onClick={() => removeSubject(sub.id)}
                  className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase">Credits</label>
                  <input
                    type="number"
                    value={sub.credits}
                    onChange={(e) => updateSubject(sub.id, "credits", Number(e.target.value))}
                    className="w-full bg-secondary border rounded p-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase">Total Max</label>
                  <input
                    type="number"
                    value={sub.totalMax}
                    onChange={(e) => updateSubject(sub.id, "totalMax", Number(e.target.value))}
                    className="w-full bg-secondary border rounded p-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase">Grade Pt (Marksheet)</label>
                  <input
                    type="number"
                    step="1"
                    value={sub.gradePoint}
                    onChange={(e) => updateSubject(sub.id, "gradePoint", Number(e.target.value))}
                    className="w-full bg-secondary border rounded p-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase">IA Marks</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sub.iaMarks}
                    onChange={(e) => updateSubject(sub.id, "iaMarks", Number(e.target.value))}
                    className="w-full bg-secondary border rounded p-1.5 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground uppercase">CA Marks</label>
                  <input
                    type="number"
                    step="0.5"
                    value={sub.caMarks}
                    onChange={(e) => updateSubject(sub.id, "caMarks", Number(e.target.value))}
                    className="w-full bg-secondary border rounded p-1.5 text-sm"
                  />
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 flex justify-between items-center mt-2">
                <span className="text-sm font-medium text-primary">Inferred Theory Score:</span>
                <span className={`text-lg font-bold ${minTheory < 0 && sub.gradePoint > 0 ? "text-destructive" : "text-primary"}`}>
                  {theoryDisplay} <span className="text-xs font-normal text-muted-foreground">/ {sub.totalMax - 70}</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setSubjects([...subjects, makeSubject()])}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <Plus className="w-4 h-4" /> Add Subject Manually
      </button>

    </div>
  );
}
