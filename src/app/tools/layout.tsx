import { FeatureGate } from "@/components/feature-flags-client";

// Action Engine, Migration Radar and Money Finder sit outside the (site)
// group, so they need the feature gate applied here as well.
export default function StandaloneToolsLayout({ children }: { children: React.ReactNode }) {
  return <FeatureGate>{children}</FeatureGate>;
}
