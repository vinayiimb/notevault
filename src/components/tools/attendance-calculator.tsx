"use client";

import { useState } from "react";
import { attendancePlan } from "@/lib/attendance";

const num = (v: string) => Math.max(0, Math.min(9999, Number(v) || 0));

export default function AttendanceCalculator() {
  const [attended, setAttended] = useState("30");
  const [held, setHeld] = useState("40");
  const [target, setTarget] = useState("75");

  const r = attendancePlan(num(attended), num(held), num(target) / 100);
  const field =
    "mt-1 w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          Classes attended
          <input type="number" inputMode="numeric" min={0} value={attended} onChange={(e) => setAttended(e.target.value)} className={field} />
        </label>
        <label className="text-sm font-medium">
          Classes held so far
          <input type="number" inputMode="numeric" min={0} value={held} onChange={(e) => setHeld(e.target.value)} className={field} />
        </label>
        <label className="text-sm font-medium">
          Required attendance (%)
          <input type="number" inputMode="numeric" min={1} max={99} value={target} onChange={(e) => setTarget(e.target.value)} className={field} />
        </label>
      </div>

      <div className="mt-6 rounded-xl bg-accent-soft p-5" aria-live="polite">
        <p className="text-sm text-muted">Your attendance</p>
        <p className="text-4xl font-bold tracking-tight">{r.status === "empty" ? "—" : `${r.pct.toFixed(1)}%`}</p>
        <p className="mt-3 leading-7">
          {r.status === "empty" && "Enter the classes held so far."}
          {r.status === "short" && (
            <>You are below {num(target)}%. Attend the next <strong>{r.count}</strong> classes in a row, without missing any, to reach it.</>
          )}
          {r.status === "safe" && (
            <>You are at or above {num(target)}%. You can miss at most <strong>{r.count}</strong> more {r.count === 1 ? "class" : "classes"} and stay there.</>
          )}
        </p>
      </div>
    </div>
  );
}
