import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { computeCGPA, simulateImprovement, type SubjectEntry } from "@/lib/calculator";
import { Plus, Trash2, TrendingUp, Sparkles, Copy, Check } from "lucide-react";

let idCounter = 1;
const makeSubject = (): SubjectEntry => ({
  id: String(idCounter++),
  name: `Subject ${idCounter - 1}`,
  credits: 4,
  gradePoint: 7,
});

export default function CGPACalculator() {
  const [subjects, setSubjects] = useState<SubjectEntry[]>([makeSubject(), makeSubject()]);
  const [importJson, setImportJson] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [importError, setImportError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const promptText = `I am providing an image of my Delhi University Statement of Marks. Please extract the data into a JSON array of objects. For each row in the table, create an object with these exact keys: 'name' (string, derived from the 'Paper Title' column), 'credits' (number, derived from the 'CRDT' column), and 'gradePoint' (number, derived from the 'GRPT' column). Return ONLY the raw JSON array without any markdown formatting, backticks, or additional text. Example: [{"name": "BUSINESS LAWS", "credits": 4, "gradePoint": 8}]`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
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
      
      const newSubjects = parsed.map((item: any) => ({
        id: String(idCounter++),
        name: String(item.name || "Unknown"),
        credits: Number(item.credits) || 0,
        gradePoint: Number(item.gradePoint) || 0,
      }));

      setSubjects(newSubjects);
      setIsDialogOpen(false);
      setImportJson("");
    } catch (e: any) {
      setImportError("Import failed: " + (e.message || "Invalid JSON"));
    }
  };

  const result = useMemo(() => computeCGPA(subjects), [subjects]);

  const addSubject = () => setSubjects((prev) => [...prev, makeSubject()]);

  const removeSubject = (id: string) =>
    setSubjects((prev) => prev.filter((s) => s.id !== id));

  const updateSubject = (id: string, field: keyof SubjectEntry, value: string | number) =>
    setSubjects((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );

  return (
    <div className="space-y-6">
      {/* Subject list */}
      <div className="space-y-3">
        {subjects.map((sub, i) => (
          <motion.div
            key={sub.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border p-4 grid grid-cols-[1fr_80px_80px_40px] gap-3 items-center shadow-sm"
          >
            <input
              value={sub.name}
              onChange={(e) => updateSubject(sub.id, "name", e.target.value)}
              className="bg-transparent border-b border-border/50 px-1 py-1 text-sm font-medium focus:outline-none focus:border-accent"
              placeholder="Subject name"
            />
            <div className="text-center">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Credits</label>
              <input
                type="number"
                min={1}
                max={10}
                value={sub.credits}
                onChange={(e) => updateSubject(sub.id, "credits", Number(e.target.value))}
                className="w-full bg-secondary rounded-lg px-2 py-1 text-center text-sm font-medium"
              />
            </div>
            <div className="text-center">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">GP</label>
              <input
                type="number"
                min={0}
                max={10}
                value={sub.gradePoint}
                onChange={(e) => updateSubject(sub.id, "gradePoint", Number(e.target.value))}
                className="w-full bg-secondary rounded-lg px-2 py-1 text-center text-sm font-medium"
              />
            </div>
            <button
              onClick={() => removeSubject(sub.id)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={addSubject}
          className="flex items-center gap-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Subject
        </button>
        
        <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
          <Sparkles className="w-4 h-4" /> AI Subject Import
        </button>
        
        {isDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setIsDialogOpen(false)}>
            <div className="w-full max-w-[500px] bg-card border rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b">
                <h2 className="flex items-center gap-2 font-semibold">
                  <Sparkles className="w-5 h-5 text-primary" /> AI Data Import
                </h2>
                <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground">&times;</button>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">1. Copy this prompt for ChatGPT:</p>
                  <div className="relative">
                    <div className="p-3 bg-secondary/50 rounded-lg text-xs font-mono text-muted-foreground border break-words">
                      {promptText}
                    </div>
                    <button
                      className="absolute top-2 right-2 h-7 px-2 text-xs font-medium bg-secondary border rounded hover:bg-secondary/80 flex items-center"
                      onClick={copyPrompt}
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
                    placeholder={'[\n  {\n    "name": "Financial Accounting",\n    "credits": 4,\n    "gradePoint": 9\n  }\n]'}
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
      </div>

      {/* Result */}
      <div className="bg-card rounded-xl border p-5 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">CGPA</p>
            <p className="font-heading text-3xl font-bold">{result.cgpa.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Credits</p>
            <p className="font-heading text-xl font-bold">{result.totalCredits}</p>
          </div>
        </div>

        {/* Contributions */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Weighted Contributions
          </p>
          {result.contributions.map((c, i) => (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>{c.name}</span>
                <span className="text-muted-foreground">
                  {c.contribution.toFixed(2)} ({c.weight.toFixed(0)}%)
                </span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${c.weight}%` }}
                  className="h-full bg-accent rounded-full"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Improvement simulator */}
        <div className="pt-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="w-4 h-4" /> Improvement Simulator
          </div>
          <p className="text-xs text-muted-foreground">
            If any subject's GP increases by 1:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {subjects.map((sub) => {
              if (sub.gradePoint >= 10) return null;
              const newCgpa = simulateImprovement(subjects, sub.id, 1);
              const diff = newCgpa - result.cgpa;
              return (
                <div
                  key={sub.id}
                  className="bg-secondary rounded-lg px-3 py-2 text-sm flex justify-between"
                >
                  <span className="truncate">{sub.name}</span>
                  <span className="text-success font-medium">+{diff.toFixed(3)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
