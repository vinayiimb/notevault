"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Score 8+ CGPA \u{1F3AF}",
  "Fetching your PYQs \u{1F4DA}",
  "Toppers do this before every exam ✨",
  "Good notes, better grades \u{1F4C8}",
  "Almost there…",
  "Loading toppers' secrets \u{1F525}",
];

// A branded "this is taking a moment" indicator — a spinner plus a
// rotating line of DU-student-flavored copy, used wherever a plain spinner
// would otherwise sit for more than a second or two (route loading.tsx
// fallbacks, AI generation, uploads).
export function GamifiedLoader({ size = "md" }: { size?: "sm" | "md" }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % MESSAGES.length), 1800);
    return () => clearInterval(id);
  }, []);

  const spinnerSize = size === "sm" ? "size-5" : "size-8";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
      <span
        className={`${spinnerSize} animate-spin rounded-full border-[3px] border-accent-soft border-t-accent`}
        aria-hidden
      />
      <p className={`${textSize} font-medium text-muted transition-opacity duration-300`} key={index}>
        {MESSAGES[index]}
      </p>
    </div>
  );
}
