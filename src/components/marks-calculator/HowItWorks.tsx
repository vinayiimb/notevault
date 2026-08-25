import { Calculator, Target, GraduationCap, ArrowLeftRight, Layers } from "lucide-react";

const items = [
  {
    icon: Calculator,
    title: "Marks Engine",
    desc: "Calculate total, percentage, grade, and pass/fail with component-wise validation. Each component must individually meet 40% threshold.",
  },
  {
    icon: Target,
    title: "What-If Engine",
    desc: "See how many marks you need for the next grade, minimum pass requirements, and live impact of changing any mark.",
  },
  {
    icon: GraduationCap,
    title: "CGPA Engine",
    desc: "Add multiple subjects with credits and grade points. Weighted CGPA calculation with an improvement simulator.",
  },
  {
    icon: ArrowLeftRight,
    title: "Reverse Extraction",
    desc: "Work backwards from a target percentage to find how many total and theory marks you need.",
  },
  {
    icon: Layers,
    title: "Pattern-Based Design",
    desc: "Supports 7+ DU paper patterns (3-1-0, 3-0-1, 4-0-0, etc.). The UI adapts automatically based on the selected pattern.",
  },
];

export default function HowItWorks() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.title} className="bg-surface rounded-xl border p-5 space-y-3">
          <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
            <item.icon className="w-5 h-5 text-accent" />
          </div>
          <h3 className="font-heading font-semibold">{item.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
        </div>
      ))}
    </div>
  );
}
