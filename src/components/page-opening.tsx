"use client";

import { useEffect, useState } from "react";
import { MascotArt } from "@/components/landing/mascot";

const STEPS = [
  "Opening your notes…",
  "Unrolling the units…",
  "Lining up the exam points…",
  "Dusting off the diagrams…",
  "Almost there — hang tight!",
];

/** Friendly full-page placeholder while a slow notes / subject page renders on the server. */
export function PageOpening({ label }: { label?: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, STEPS.length - 1)), 2200);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      className="flex min-h-[70vh] items-center justify-center px-6"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Apple-style frosted card: squircle app icon, hairline progress, soft crossfading text */}
      <div className="w-full max-w-[320px] rounded-[32px] border border-black/5 bg-white/70 px-8 pb-8 pt-9 text-center shadow-[0_1px_2px_rgba(0,0,0,.04),0_24px_60px_rgba(0,0,0,.08)] backdrop-blur-2xl motion-safe:animate-[pv-in_.5s_cubic-bezier(.22,1,.36,1)]">
        <div className="mx-auto mb-6 flex size-[88px] items-center justify-center overflow-hidden rounded-[22px] bg-gradient-to-b from-[#f4ffd6] to-[#d9f59a] shadow-[inset_0_0_0_1px_rgba(255,255,255,.7),0_8px_24px_rgba(120,170,20,.28)]">
          <div className="mt-3 w-[76px] motion-safe:[animation:mascot-bob_2.4s_ease-in-out_infinite]">
            <MascotArt priority />
          </div>
        </div>

        <p
          key={i}
          className="text-[17px] font-semibold tracking-[-0.022em] text-[#1d1d1f] motion-safe:animate-[pv-in_.45s_cubic-bezier(.22,1,.36,1)]"
        >
          {label && i === 0 ? label : STEPS[i]}
        </p>
        <p className="mt-1 text-[13px] text-[#6e6e73]">Just a moment</p>

        <div className="relative mx-auto mt-6 h-[5px] w-full overflow-hidden rounded-full bg-black/[0.07]">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[#0071e3] transition-[width] duration-[1800ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ width: `${((i + 1) / STEPS.length) * 92}%` }}
          />
          <span className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent motion-safe:animate-[opening-sweep_1.6s_ease-in-out_infinite]" />
        </div>
      </div>
    </div>
  );
}
