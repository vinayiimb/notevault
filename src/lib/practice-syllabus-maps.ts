// Hand-authored Mermaid topic maps for the practice page, keyed by Subject
// id (not slug — slugs here aren't guaranteed to agree with what the
// practice page independently re-derives from the PYQ catalog's course/
// subject display names, see practice-questions/_route-impl.ts). Optional
// and additive: a subject with no entry here just doesn't show a topic map
// — this is not a required field on every subject, and nothing
// auto-generates entries (matches the "no fabricated content" stance the
// practice-questions route already documents above).
export const SYLLABUS_MAPS_BY_SUBJECT_ID: Record<string, string> = {
  // "DSC-5.2 — Business Economics" (B.Com (Hons) — DU Official Syllabus, Semester 5)
  cms48ngf9001nrpyubb5ibdw2: `flowchart TD
  ROOT[Business Economics Sem 5]

  ROOT --> DS[Demand and Supply]
  DS --> DS1[Law of Demand]
  DS --> DS2[Demand Schedules]
  DS --> DS3[Law of Supply]
  DS --> DS4[Market Equilibrium]
  DS --> DS5[Shifts in Demand and Supply]

  ROOT --> EL[Elasticity]
  EL --> EL1[Price Elasticity of Demand]
  EL --> EL2[Cross Elasticity of Demand]
  EL --> EL3[Price Elasticity of Supply]
  EL --> EL4[Total Expenditure Method]
  EL --> EL5[Geometric and Arc Methods]

  ROOT --> CB[Consumer Behaviour]
  CB --> CB1[Indifference Curves]
  CB1 --> CB1a[Convexity and MRS]
  CB1 --> CB1b[Concave Curve Anomaly]
  CB --> CB2[Budget Line]
  CB2 --> CB2a[Intercepts and Slope]
  CB2 --> CB2b[Shifts: Income vs Price]
  CB --> CB3[Consumer Equilibrium]
  CB --> CB4[Income Consumption Curve and Engel Curve]
  CB --> CB5[Substitution and Income Effect]
  CB --> CB6[Lump-sum vs Excise Subsidy]

  ROOT --> PT[Production Theory]
  PT --> PT1[Stages of Production]
  PT --> PT2[Isoquants]
  PT --> PT3[MRTS]
  PT --> PT4[Producer Equilibrium]
  PT --> PT5[Returns to Scale]
  PT --> PT6[Expansion Path: Short-run vs Long-run]

  ROOT --> CC[Cost Curves]
  CC --> CC1[Short-run Cost Curves]
  CC --> CC2[Long-run Average Cost Curve]
  CC --> CC3[LAC as Envelope and Planning Curve]
  CC --> CC4[Production-Cost Relationship]

  ROOT --> MS[Market Structures]
  MS --> PC[Perfect Competition]
  PC --> PC1[Short-run Equilibrium]
  PC --> PC2[Long-run Equilibrium and Entry-Exit]
  PC --> PC3[Shut-down Point]

  MS --> MO[Monopoly]
  MO --> MO1[Equilibrium via MC=MR]
  MO --> MO2[Indeterminate Supply Curve]

  MS --> MC2[Monopolistic Competition]
  MC2 --> MC2a[Short-run and Long-run Equilibrium]
  MC2 --> MC2b[Excess Capacity Hypothesis]

  MS --> OL[Oligopoly]
  OL --> OL1[Cournot Duopoly and Reaction Curves]
  OL --> OL2[Kinked Demand Curve]
  OL --> OL3[Prisoner's Dilemma]
  OL --> OL4[Price Rigidity]

  ROOT --> PP[Pricing Practices and Welfare]
  PP --> PP1[Price Discrimination: 1st 2nd 3rd Degree]
  PP --> PP2[Peak Load Pricing]
  PP --> PP3[Rent Control]
  PP --> PP4[Floor Price]
  PP --> PP5[Backward-Bending Labour Supply]`,
};
