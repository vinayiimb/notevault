"use client";

import React from "react";
import { FilterState } from "@/lib/upsc-data";

interface PracticeModeToggleProps {
  mode: FilterState["mode"];
  onChangeMode: (mode: FilterState["mode"]) => void;
}

export const PracticeModeToggle: React.FC<PracticeModeToggleProps> = ({
  mode,
  onChangeMode,
}) => {
  const modes: { id: FilterState["mode"]; label: string; icon: string; desc: string }[] = [
    { id: "browse", label: "Browse", icon: "📖", desc: "Read questions & instant solutions" },
    { id: "practice", label: "Practice", icon: "✍️", desc: "Test yourself before viewing answers" },
    { id: "revision", label: "Revision", icon: "🔄", desc: "Saved bookmarks & mistaken questions" },
    { id: "drill", label: "Topic Drill", icon: "🎯", desc: "Intense single topic focus" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-1 bg-muted/60 border border-border/80 rounded-xl">
      {modes.map((m) => {
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onChangeMode(m.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              active
                ? "bg-card text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
            title={m.desc}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        );
      })}
    </div>
  );
};
