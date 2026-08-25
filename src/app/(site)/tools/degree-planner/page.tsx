import { Metadata } from "next";
import { DegreePlannerClient } from "./client";

export const metadata: Metadata = {
  title: "DU Degree & Fourth-Year Planner | DU Academic Intelligence",
  description: "Calculate your promotion, exit, and fourth-year eligibility based on official DU rules.",
};

export default function Page() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl mb-4">
          Degree & Fourth-Year Planner
        </h1>
        <p className="text-lg text-muted max-w-2xl mx-auto">
          Calculate your minor eligibility, promotion thresholds, and exit requirements. Fully updated for the July 2026 DU structural changes.
        </p>
      </div>
      <DegreePlannerClient />
    </div>
  );
}
