import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PATTERNS, calc, getNextGradeTarget, type CalcResult } from "@/lib/calculator";
import { CheckCircle, XCircle, Target, TrendingUp, Sparkles, Copy, Check } from "lucide-react";


const patternList = Object.values(PATTERNS);

export default function MarksCalculator() {
  const [patternId, setPatternId] = useState("4-0-0");
  const [marks, setMarks] = useState<Record<string, number>>({});
  const [importJson, setImportJson] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [importError, setImportError] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const promptText = `Extract the component marks for this subject from the screenshot. The components are: ${PATTERNS[patternId]?.components.map(c => c.label).join(", ")}. Return ONLY a valid JSON object mapping component ID strings (like "${PATTERNS[patternId]?.components.map(c => c.id).join('", "')}") to their obtained marks (numbers). No markdown or other text.`;

  const copyPrompt = () => {
    navigator.clipboard.writeText(promptText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleImport = () => {
    try {
      setImportError("");
      
      let cleanJson = importJson.trim();
      const objectMatch = cleanJson.match(/\[[\s\S]*\]/) || cleanJson.match(/\{[\s\S]*?\}/);
      if (objectMatch) {
        cleanJson = objectMatch[0];
      }
      
      const parsed = JSON.parse(cleanJson);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        throw new Error("Expected a JSON object mapping components. If you copied subject data, please use the CGPA Calculator tab instead.");
      }
      
      const newMarks = { ...marks };
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "number") {
          newMarks[key] = value;
        }
      }

      setMarks(newMarks);
      setIsDialogOpen(false);
      setImportJson("");
    } catch (e: any) {
      setImportError("Import failed: " + (e.message || "Invalid JSON"));
    }
  };

  const pattern = PATTERNS[patternId];

  const result: CalcResult = useMemo(
    () => calc(patternId, marks),
    [patternId, marks]
  );

  const nextGrade = useMemo(
    () => getNextGradeTarget(result.percentage),
    [result.percentage]
  );

  const handlePatternChange = (id: string) => {
    setPatternId(id);
    setMarks({});
  };

  const setMark = (compId: string, val: number) => {
    setMarks((prev) => ({ ...prev, [compId]: val }));
  };

  return (
    <div className="space-y-6">
      {/* Pattern selector */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="block text-sm font-medium text-muted-foreground">
            Paper Pattern
          </label>
          
          <button onClick={() => setIsDialogOpen(true)} className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors">
            <Sparkles className="w-4 h-4" /> AI Component Import
          </button>
          
          {isDialogOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setIsDialogOpen(false)}>
              <div className="w-full max-w-[500px] bg-surface border rounded-xl shadow-lg flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Sparkles className="w-5 h-5 text-primary" /> AI Marks Import
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
                      placeholder={'{\n  "IA": 25,\n  "TH": 60\n}'}
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
        
        <div className="flex flex-wrap gap-2">
          {patternList.map((p) => (
            <button
              key={p.id}
              onClick={() => handlePatternChange(p.id)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                patternId === p.id
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-secondary text-secondary-foreground hover:bg-muted"
              }`}
            >
              <span className="font-heading font-semibold">{p.label}</span>
              <span className="block text-xs opacity-70">{p.description}</span>
            </button>
          ))}
        </div>
      </div>


      {/* Inputs */}
      <div className="grid gap-4 sm:grid-cols-2">
        <AnimatePresence mode="wait">
          {pattern.components.map((comp) => {
            const cr = result.components.find((c) => c.id === comp.id);
            return (
              <motion.div
                key={comp.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-surface rounded-xl border p-4 space-y-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="font-heading font-semibold text-sm">{comp.label}</span>
                  <span className="text-xs text-muted-foreground">
                    Max: {comp.maxMarks} · Pass: {cr?.passThreshold}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={comp.maxMarks}
                  value={marks[comp.id] || 0}
                  onChange={(e) => setMark(comp.id, Number(e.target.value))}
                  className="w-full accent-accent h-2 rounded-full"
                />
                <div className="flex items-center justify-between">
                  <input
                    type="number"
                    min={0}
                    max={comp.maxMarks}
                    value={marks[comp.id] || 0}
                    onChange={(e) =>
                      setMark(comp.id, Math.min(Number(e.target.value), comp.maxMarks))
                    }
                    className="w-20 bg-secondary border rounded-lg px-3 py-1.5 text-sm font-medium text-center"
                  />
                  <div className="flex items-center gap-1.5">
                    {cr?.passed ? (
                      <CheckCircle className="w-4 h-4 text-success" />
                    ) : (
                      <XCircle className="w-4 h-4 text-destructive" />
                    )}
                    <span
                      className={`text-xs font-medium ${
                        cr?.passed ? "text-success" : "text-destructive"
                      }`}
                    >
                      {cr?.percentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Result */}
      <motion.div
        layout
        className={`rounded-xl border p-5 space-y-4 shadow-sm ${
          result.passed
            ? "border-success/30 bg-success/5"
            : "border-destructive/30 bg-destructive/5"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="font-heading text-2xl font-bold">
              {result.totalObtained}/{result.totalMax}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Percentage</p>
            <p className="font-heading text-2xl font-bold">
              {result.percentage.toFixed(2)}%
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold ${
                result.passed
                  ? "bg-success text-success-foreground"
                  : "bg-destructive text-destructive-foreground"
              }`}
            >
              {result.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
              {result.passed ? "PASS" : "FAIL"}
            </span>
            <span className="font-heading font-bold text-lg">
              Grade {result.grade.grade}
            </span>
            <span className="text-sm text-muted-foreground">
              GP {result.grade.gradePoint}
            </span>
          </div>
        </div>

        {result.failedComponents.length > 0 && (
          <p className="text-sm text-destructive">
            Failed components: {result.failedComponents.join(", ")}
          </p>
        )}

        {/* What-if */}
        {nextGrade && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Target className="w-4 h-4 text-accent" />
            <span className="text-sm">
              Need <strong>{(nextGrade.target - result.percentage).toFixed(1)}%</strong> more
              ({Math.ceil(((nextGrade.target - result.percentage) / 100) * result.totalMax)} marks)
              to reach <strong>Grade {nextGrade.grade}</strong>
            </span>
          </div>
        )}

        {/* Component-wise what-if */}
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <TrendingUp className="w-4 h-4" /> Component Details
          </div>
          {result.components.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-sm">
              <span>{c.label}</span>
              <span className="text-muted-foreground">
                {c.obtained}/{c.max} ·{" "}
                {!c.passed && (
                  <span className="text-destructive">
                    Need {c.passThreshold - c.obtained} more to pass
                  </span>
                )}
                {c.passed && <span className="text-success">✓ Passed</span>}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
