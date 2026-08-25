
"use client";
import { useState } from "react";
import MarksCalculator from "./MarksCalculator";
import CGPACalculator from "./CGPACalculator";
import ReverseExtractor from "./ReverseExtractor";
import HowItWorks from "./HowItWorks";
import { GraduationCap, Calculator, Target, BookOpen, Info } from "lucide-react";

type TabId = "marks" | "cgpa" | "reverse" | "info";

const tabs: { id: TabId; label: string; icon: any }[] = [
  { id: "marks", label: "Marks Planner", icon: Calculator },
  { id: "cgpa", label: "CGPA Calculator", icon: Target },
  { id: "reverse", label: "Reverse Extractor", icon: BookOpen },
  { id: "info", label: "How it Works", icon: Info },
];

export default function Index() {
  const [activeTab, setActiveTab] = useState<TabId>("marks");

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-surface sticky top-0 z-50">
        <div className="container max-w-4xl py-4 mx-auto px-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-heading text-lg font-bold leading-tight">
                DU Marks Calculator
              </h1>
              <p className="text-xs text-muted-foreground">
                Intelligent academic planner for Delhi University
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b bg-surface-muted/50">
        <div className="container max-w-4xl mx-auto px-4">
          <nav className="flex gap-1 overflow-x-auto py-2 -mb-px scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-all whitespace-nowrap rounded-t-md ${
                  activeTab === tab.id
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50 border-b-2 border-transparent"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="container max-w-4xl py-8 mx-auto px-4 relative z-40">
        {activeTab === "marks" && <MarksCalculator />}
        {activeTab === "cgpa" && <CGPACalculator />}
        {activeTab === "reverse" && <ReverseExtractor />}
        {activeTab === "info" && <HowItWorks />}
      </main>
    </div>
  );
}
