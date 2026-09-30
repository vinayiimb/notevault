"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Hourglass } from "@phosphor-icons/react";
import { defaultFlags, featureForPath, type FeatureFlagMap } from "@/lib/feature-flags";

// One request per page load, shared by the header, sidebar and page gate.
let flagsPromise: Promise<FeatureFlagMap> | null = null;
function loadFlags() {
  flagsPromise ??= fetch("/api/feature-flags")
    .then((res) => (res.ok ? res.json() : defaultFlags()))
    .catch(() => defaultFlags());
  return flagsPromise;
}

// Renders with the defaults (what the static HTML contains), then swaps in
// the admin's overrides once they arrive.
export function useFeatureFlags(): { flags: FeatureFlagMap; loaded: boolean } {
  const [state, setState] = useState({ flags: defaultFlags(), loaded: false });
  useEffect(() => {
    let active = true;
    loadFlags().then((flags) => active && setState({ flags, loaded: true }));
    return () => {
      active = false;
    };
  }, []);
  return state;
}

export function FeatureGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { flags, loaded } = useFeatureFlags();
  const feature = featureForPath(pathname);
  if (!feature) return <>{children}</>;

  const status = flags[feature.key];
  // Until the real flags arrive, a tool that is off by default renders
  // nothing, so a broken page never flashes before the notice.
  if (!loaded && feature.defaultStatus !== "live") return <div className="min-h-[60vh]" />;
  if (status === "live") return <>{children}</>;

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        <Hourglass size={28} weight="duotone" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">
        {status === "soon" ? `${feature.label} is coming soon` : `${feature.label} isn’t available right now`}
      </h1>
      <p className="mt-2 text-base text-muted">
        {status === "soon"
          ? "We’re rebuilding this tool so it works properly. Check back shortly."
          : "This tool has been switched off for now."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link href="/papers" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition hover:bg-brand-hover">
          Browse papers
        </Link>
        <Link href="/exam-help/datesheet" className="rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-foreground transition hover:bg-surface-muted">
          Datesheet
        </Link>
      </div>
    </div>
  );
}
