import type { Metadata } from "next";
import Link from "next/link";
import { JAM_EN_CUTOFFS } from "@/data/jam-economics/cutoffs";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { JamNav } from "@/components/jam/jam-nav";
import { JamFaqs } from "@/components/jam/jam-faqs";
import { CutoffCharts } from "@/components/jam/cutoff-charts";

export const metadata: Metadata = {
  title: "IIT JAM Economics Cutoff 2021–2026 — Category-wise Qualifying Marks",
  description:
    "IIT JAM Economics (EN) qualifying cutoffs for General, OBC-NCL/EWS and SC/ST/PwD from 2021 to 2026, with candidates registered, appeared and qualified and the raw marks range.",
  alternates: { canonical: "/jameco/cutoff" },
};

export const dynamic = "force-static";

const latest = JAM_EN_CUTOFFS[0];
const prev = JAM_EN_CUTOFFS[1];
const first = JAM_EN_CUTOFFS.at(-1)!;

const faqs = [
  {
    q: "What is the IIT JAM Economics cutoff for 2026?",
    a: `In JAM ${latest.year} the Economics (EN) qualifying cutoff was ${latest.cutoff!.gen} for General, ${latest.cutoff!.obc} for OBC-NCL/EWS and ${latest.cutoff!.sc} for SC/ST/PwD, out of 100 marks. ${latest.candidates!.qualified} of the ${latest.candidates!.appeared} candidates who appeared qualified.`,
  },
  {
    q: "How are the OBC-NCL/EWS and SC/ST/PwD cutoffs decided?",
    a: "JAM fixes the General cutoff first. The OBC-NCL/EWS cutoff is 90% of it and the SC/ST/PwD cutoff is 50% of it, truncated to two decimal places. That is why the three numbers always move together.",
  },
  {
    q: "Does clearing the cutoff guarantee admission to an IIT?",
    a: "No. The cutoff only makes you eligible to apply through the JAM admission portal. Seats are then allotted by All India Rank, category and your choices, and the closing ranks at the top IITs are far tighter than the qualifying mark.",
  },
  {
    q: "Why did the Economics cutoff jump in 2025?",
    a: `The General cutoff rose from ${JAM_EN_CUTOFFS.find((d) => d.year === 2024)!.cutoff!.gen} in 2024 to ${prev.cutoff!.gen} in 2025 and stayed high at ${latest.cutoff!.gen} in ${latest.year}. The qualifying mark is set by the organising IIT after the exam, based on how candidates performed; the top raw mark was ${prev.raw!.max} in 2025 and ${latest.raw!.max} in ${latest.year}. Plan for a cutoff near the recent level, not the 2021–2024 one.`,
  },
  {
    q: "Why is there no JAM Economics cutoff for 2022?",
    a: "The published JAM 2022 cutoff listing did not give a category-wise qualifying mark for Economics, so no reliable 2022 figure is shown here.",
  },
  {
    q: "What is the marking scheme of JAM Economics?",
    a: "The paper has 60 questions for 100 marks in 3 hours: 30 MCQs, 10 MSQs and 20 NAT questions. A wrong MCQ costs 1/3 of a mark (1-mark questions) or 2/3 of a mark (2-mark questions). MSQ and NAT questions have no negative marking and no partial credit.",
  },
  {
    q: "Is the cutoff applied to raw marks?",
    a: `Yes. The cutoff is compared with your marks out of 100 after negative marking. In ${latest.year} raw marks ranged from ${latest.raw!.min} to ${latest.raw!.max}.`,
  },
  {
    q: "What score should I target for a good IIT in JAM Economics?",
    a: `Qualifying is only the first step. With the General cutoff around ${Math.round(latest.cutoff!.gen)} in recent years, aim well above it: practise every past paper, then target accuracy on MSQ and NAT questions, which carry no negative marks.`,
  },
];

export default function JamCutoffPage() {
  const rows = JAM_EN_CUTOFFS;
  return (
    <div className="mx-auto max-w-6xl px-3 pb-12 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "IIT JAM Economics", url: "/jameco" },
          { name: "Cutoffs", url: "/jameco/cutoff" },
        ]}
      />
      <JamNav active="/jameco/cutoff" />
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">IIT JAM Economics Cutoffs</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Category-wise qualifying marks for JAM Economics (EN), {first.year}–{latest.year}.{" "}
        <Link href="/jameco" className="font-medium text-foreground hover:underline">
          View past year questions →
        </Link>
      </p>

      <CutoffCharts data={rows} />

      <div className="mt-12">
        <JamFaqs faqs={faqs} />
      </div>

      <section className="mt-12 border-t border-border pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold text-foreground">JAM Economics cutoffs</h2>
          <span className="text-xs text-muted">Marks out of 100</span>
        </div>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Economics (EN) has been a JAM test paper since 2021. It is a single 100-mark paper covering Mathematics, Statistics, Microeconomics,
          Macroeconomics and the Indian Economy. The qualifying cutoff has risen from {first.cutoff!.gen} (General) in {first.year} to{" "}
          {latest.cutoff!.gen} in {latest.year}, with the biggest jump in 2025.
        </p>

        <h3 className="mb-2 mt-6 text-[15px] font-semibold text-foreground">Category-wise cutoff marks by year</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                <th className="py-2.5 pr-4 font-medium">Year</th>
                <th className="py-2.5 pr-4 text-right font-medium">General</th>
                <th className="py-2.5 pr-4 text-right font-medium">OBC-NCL / EWS</th>
                <th className="py-2.5 pr-4 text-right font-medium">SC / ST / PwD</th>
                <th className="py-2.5 pr-4 text-right font-medium">Highest raw</th>
                <th className="py-2.5 text-right font-medium">Lowest raw</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.year} className="border-b border-border/70 text-muted">
                  <td className="py-2.5 pr-4 font-semibold text-foreground">{d.year}</td>
                  {d.cutoff ? (
                    <>
                      <td className="py-2.5 pr-4 text-right text-foreground">{d.cutoff.gen}</td>
                      <td className="py-2.5 pr-4 text-right text-foreground">{d.cutoff.obc}</td>
                      <td className="py-2.5 pr-4 text-right text-foreground">{d.cutoff.sc}</td>
                    </>
                  ) : (
                    <td colSpan={3} className="py-2.5 pr-4 text-right">
                      Not published
                    </td>
                  )}
                  <td className="py-2.5 pr-4 text-right">{d.raw?.max ?? "—"}</td>
                  <td className="py-2.5 text-right">{d.raw?.min ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mb-2 mt-8 text-[15px] font-semibold text-foreground">Applicants &amp; qualified candidates</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-foreground">
                {["Year", "Registered", "Appeared", "Qualified", "% of appeared", "GEN", "EWS", "OBC-NCL", "SC", "ST", "PwD*"].map((h, i) => (
                  <th key={h} className={`py-2.5 pr-3 font-medium ${i ? "text-right" : ""}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((d) => d.candidates)
                .map((d) => (
                  <tr key={d.year} className="border-b border-border/70 text-foreground">
                    <td className="py-2.5 pr-3 font-semibold">{d.year}</td>
                    <td className="py-2.5 pr-3 text-right">{d.candidates!.registered.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 pr-3 text-right">{d.candidates!.appeared.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 pr-3 text-right">{d.candidates!.qualified.toLocaleString("en-IN")}</td>
                    <td className="py-2.5 pr-3 text-right">{((d.candidates!.qualified / d.candidates!.appeared) * 100).toFixed(1)}%</td>
                    {(["GEN", "EWS", "OBC-NCL", "SC", "ST", "PwD"] as const).map((k) => (
                      <td key={k} className="py-2.5 pr-3 text-right text-muted">
                        {d.qualifiedBy![k]}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted">
          Sources: JAM 2025 Statistical and Performance Report (IIT Delhi) and JAM 2026 Statistical and Performance Report (IIT Bombay); cutoffs
          for earlier years as published with the JAM results. *PwD candidates are also counted within their own category (GEN, OBC-NCL, SC, ST or
          EWS), so the category columns add up to the qualified total without PwD.
        </p>
      </section>
    </div>
  );
}
