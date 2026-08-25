"use client";

import React, { useState } from "react";
import { SubjectHierarchy, TopicItem } from "@/lib/upsc-data";

interface TopicAccordionProps {
  hierarchy: SubjectHierarchy[];
  selectedSubject: string | null;
  selectedTopic: string | null;
  onSelectSubject: (subject: string | null) => void;
  onSelectTopic: (topic: string | null, subject: string | null) => void;
}

export const TopicAccordion: React.FC<TopicAccordionProps> = ({
  hierarchy,
  selectedSubject,
  selectedTopic,
  onSelectSubject,
  onSelectTopic,
}) => {
  const [expandedSubjects, setExpandedSubjects] = useState<Record<string, boolean>>({
    "Modern History": true,
    "Indian Polity & Governance": true,
    "Indian Economy": true,
  });

  const toggleSubject = (subjectName: string) => {
    setExpandedSubjects((prev) => ({
      ...prev,
      [subjectName]: !prev[subjectName],
    }));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Subject & Topic Explorer
        </label>
        {(selectedSubject || selectedTopic) && (
          <button
            onClick={() => {
              onSelectSubject(null);
              onSelectTopic(null, null);
            }}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline font-medium"
          >
            Clear Topic
          </button>
        )}
      </div>

      <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
        {hierarchy.map((subj) => {
          const isSubjectActive = selectedSubject === subj.subject;
          const isExpanded = !!expandedSubjects[subj.subject] || isSubjectActive;

          return (
            <div
              key={subj.subject}
              className={`rounded-xl border transition-colors ${
                isSubjectActive
                  ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
                  : "border-border/60 bg-card/50 hover:bg-card"
              }`}
            >
              {/* Subject Header */}
              <div className="flex items-center justify-between p-2.5">
                <button
                  onClick={() => {
                    if (isSubjectActive && !selectedTopic) {
                      onSelectSubject(null);
                    } else {
                      onSelectSubject(subj.subject);
                      onSelectTopic(null, subj.subject);
                    }
                  }}
                  className="flex-1 text-left flex items-center gap-2 group"
                >
                  <span className="text-xs font-semibold text-foreground group-hover:text-amber-600 transition-colors">
                    {subj.subject}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                    {subj.total_questions}
                  </span>
                </button>

                <button
                  onClick={() => toggleSubject(subj.subject)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground text-xs"
                  aria-label="Toggle topics"
                >
                  {isExpanded ? "▲" : "▼"}
                </button>
              </div>

              {/* Topics Sub-list */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 pt-1 space-y-1 border-t border-border/40">
                  {subj.topics.map((t) => {
                    const isTopicActive = selectedTopic === t.name;
                    return (
                      <button
                        key={t.name}
                        onClick={() => {
                          if (isTopicActive) {
                            onSelectTopic(null, subj.subject);
                          } else {
                            onSelectSubject(subj.subject);
                            onSelectTopic(t.name, subj.subject);
                          }
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between transition-all ${
                          isTopicActive
                            ? "bg-amber-500 text-white font-medium shadow-2xs"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                        }`}
                      >
                        <span className="truncate pr-2">{t.name}</span>
                        <span
                          className={`text-[10px] font-mono shrink-0 ${
                            isTopicActive
                              ? "text-white/80"
                              : "text-muted-foreground/70"
                          }`}
                        >
                          {t.total_questions}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
