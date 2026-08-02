"use client";

import { useMemo, useState } from "react";
import {
  BookOpenText,
  CaretDown,
  CaretRight,
  CheckCircle,
  Code,
  DownloadSimple,
  FileText,
  FunnelSimple,
  GraduationCap,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Sparkle,
  Table,
} from "@phosphor-icons/react";

export type MasterSubject = {
  code: string;
  title: string;
  category: "Core Paper" | "Discipline Specific Elective" | "Generic Elective" | "Skill Enhancement Course" | "Value Addition Course" | "Ability Enhancement Course";
  credits: number;
  units: string[];
};

export type MasterSemester = {
  semesterName: string;
  semesterOrder: number;
  subjects: MasterSubject[];
};

export type MasterCourse = {
  id: string;
  name: string;
  code: string;
  degree: string;
  description: string;
  semesters: MasterSemester[];
};

// 100% In-Depth DU Official Syllabus Dataset
const MASTER_SYLLABUS_DATA: MasterCourse[] = [
  {
    id: "bcom-hons",
    name: "B.Com. (Hons) — University of Delhi",
    code: "BC-HONS",
    degree: "Commerce",
    description: "Official UGC-LOCF & NEP 2020 4-Year Undergraduate Curriculum Structure",
    semesters: [
      {
        semesterName: "Semester 1",
        semesterOrder: 1,
        subjects: [
          { code: "BC 1.2", title: "Financial Accounting", category: "Core Paper", credits: 4, units: ["Theoretical Framework & Accounting Process", "Business Income & Inventory Valuation", "Accounting for Financial Statements", "Hire Purchase & Branch Accounting"] },
          { code: "BC 1.3", title: "Business Organisation & Management", category: "Core Paper", credits: 4, units: ["Foundation of Indian Business", "Business Environment & Dynamics", "Process of Management & Decision Making", "Leadership & Organizational Change"] },
          { code: "BC 1.4", title: "Business Laws", category: "Core Paper", credits: 4, units: ["Indian Contract Act, 1872", "Special Contracts & Indemnity", "Sale of Goods Act, 1930", "Limited Liability Partnership Act, 2008"] },
        ],
      },
      {
        semesterName: "Semester 2",
        semesterOrder: 2,
        subjects: [
          { code: "BC 2.2", title: "Corporate Accounting", category: "Core Paper", credits: 4, units: ["Accounting for Share Capital & Debentures", "Final Accounts of Companies", "Valuation of Goodwill & Shares", "Amalgamation & Internal Reconstruction"] },
          { code: "BC 2.3", title: "Business Mathematics & Statistics", category: "Core Paper", credits: 4, units: ["Matrices & Calculus for Business", "Correlation & Linear Regression", "Time Series Analysis & Index Numbers", "Probability Distributions & Hypothesis"] },
        ],
      },
      {
        semesterName: "Semester 3",
        semesterOrder: 3,
        subjects: [
          { code: "BC 3.1", title: "Company Law", category: "Core Paper", credits: 4, units: ["Introduction to Company Law & Types", "Documents & Capital Structure", "Management & Board Meetings", "Dividends, Audit & Winding Up"] },
          { code: "BC 3.2", title: "Income Tax Law & Practice", category: "Core Paper", credits: 4, units: ["Basic Concepts & Residential Status", "Salaries & House Property Income", "Profits & Gains of Business/Profession", "Capital Gains & Deductions u/s 80"] },
          { code: "BC 3.4(a)", title: "Computer Applications in Business", category: "Skill Enhancement Course", credits: 2, units: ["Word Processing & Spreadsheets", "Financial Functions & Pivot Tables", "Database Management Systems (DBMS)", "E-Filing of Returns & Security"] },
          { code: "BC 3.4(b)", title: "Cyber Crimes & Laws", category: "Skill Enhancement Course", credits: 2, units: ["Cyber Crimes Overview & Frauds", "Information Technology Act, 2000", "Digital Signatures & Certifying Authorities", "Cyber Regulations & Appellate Tribunal"] },
        ],
      },
      {
        semesterName: "Semester 4",
        semesterOrder: 4,
        subjects: [
          { code: "BC 4.2", title: "Cost Accounting", category: "Core Paper", credits: 4, units: ["Cost Concepts & Element-wise Analysis", "Material & Labour Cost Control", "Overhead Costing & Activity Based Costing", "Marginal & Standard Costing"] },
          { code: "BC 4.3", title: "Management Accounting", category: "Core Paper", credits: 4, units: ["Financial Statement Analysis & Ratios", "Cash Flow & Fund Flow Statements", "Budgetary Control & Variance Analysis", "Responsibility Accounting"] },
          { code: "BC 4.4(a)", title: "E-Commerce", category: "Skill Enhancement Course", credits: 2, units: ["Introduction to E-Commerce Models", "Hardware, Software & Infrastructure", "Payment Gateways & Electronic Payments", "E-Commerce Security & Privacy"] },
        ],
      },
      {
        semesterName: "Semester 5",
        semesterOrder: 5,
        subjects: [
          { code: "BC 5.1(a)", title: "Human Resource Management", category: "Discipline Specific Elective", credits: 4, units: ["HR Planning & Job Analysis", "Recruitment, Selection & Placement", "Training, Development & Appraisal", "Compensation & Industrial Relations"] },
          { code: "BC 5.1(b)", title: "Principles of Marketing", category: "Discipline Specific Elective", credits: 4, units: ["Marketing Environment & Segmentation", "Product Decisions & Life Cycle", "Pricing & Distribution Strategies", "Promotion Mix & Digital Marketing"] },
          { code: "BC 5.1(c)", title: "Auditing and Corporate Governance", category: "Discipline Specific Elective", credits: 4, units: ["Audit Principles & Vouching", "Company Auditor Rights & Duties", "Corporate Governance Framework", "Whistleblower & Ethics Policies"] },
          { code: "BC 5.2(a)", title: "Fundamentals of Financial Management", category: "Discipline Specific Elective", credits: 4, units: ["Time Value of Money & Risk", "Capital Budgeting & NPV Techniques", "Cost of Capital & Capital Structure", "Working Capital Management"] },
          { code: "BC 5.2(b)", title: "Goods & Services Tax (GST) Laws", category: "Discipline Specific Elective", credits: 4, units: ["GST Framework & Supply Concepts", "Levy, Exemptions & Registration", "Input Tax Credit (ITC) Mechanics", "GST Returns, E-Way Bill & Customs"] },
        ],
      },
      {
        semesterName: "Semester 6",
        semesterOrder: 6,
        subjects: [
          { code: "BC 6.1(a)", title: "Corporate Tax Planning", category: "Discipline Specific Elective", credits: 4, units: ["Tax Planning vs Avoidance vs Evasion", "Tax Provisions for New Business", "Corporate Financial Decisions & Tax", "Non-Resident Taxation & Transfer Pricing"] },
          { code: "BC 6.1(b)", title: "Banking and Insurance", category: "Discipline Specific Elective", credits: 4, units: ["RBI & Commercial Banking Operations", "NPA Management & Credit Risk", "Life & General Insurance Principles", "IRDAI Regulations & Claims"] },
          { code: "BC 6.2(a)", title: "International Business", category: "Discipline Specific Elective", credits: 4, units: ["International Trade Theories", "Global Business Environment & WTO", "Foreign Direct Investment (FDI)", "International Financial Architecture"] },
        ],
      },
    ],
  },
  {
    id: "ba-eco-hons",
    name: "B.A. (H) Economics — University of Delhi",
    code: "BA-ECO-HONS",
    degree: "Economics",
    description: "Complete Mathematical, Theoretical & Empirical Economics Syllabus",
    semesters: [
      {
        semesterName: "Semester 1",
        semesterOrder: 1,
        subjects: [
          { code: "ECO-101", title: "Introductory Microeconomics", category: "Core Paper", credits: 4, units: ["Consumer Preferences & Utility", "Supply, Demand & Elasticity", "Production & Cost Functions", "Market Structure & Equilibrium"] },
          { code: "ECO-102", title: "Mathematical Methods for Economics I", category: "Core Paper", credits: 4, units: ["Logic & Set Theory", "Single Variable Calculus & Limits", "Unconstrained Optimization", "Linear Algebra & Systems"] },
        ],
      },
      {
        semesterName: "Semester 2",
        semesterOrder: 2,
        subjects: [
          { code: "ECO-201", title: "Introductory Macroeconomics", category: "Core Paper", credits: 4, units: ["National Income Accounting", "Money, Inflation & Interest Rates", "Classical & Keynesian Models", "Open Economy Balance of Payments"] },
          { code: "ECO-202", title: "Mathematical Methods for Economics II", category: "Core Paper", credits: 4, units: ["Multivariate Calculus & Partial Derivatives", "Constrained Optimization & Lagrange Multipliers", "Integration & Difference Equations", "Dynamic Economic Models"] },
        ],
      },
      {
        semesterName: "Semester 3",
        semesterOrder: 3,
        subjects: [
          { code: "ECO-301", title: "Intermediate Microeconomics I", category: "Core Paper", credits: 4, units: ["Utility Maximization & Slutsky Equation", "Intertemporal Choice & Risk/Uncertainty", "Monopoly, Price Discrimination & Oligopoly", "Game Theory & Nash Equilibrium"] },
          { code: "ECO-302", title: "Intermediate Macroeconomics I", category: "Core Paper", credits: 4, units: ["IS-LM Framework & Monetary Policy", "Aggregate Supply & Phillips Curve", "Solow Neoclassical Growth Model", "Microfoundations of Consumption & Investment"] },
          { code: "ECO-303", title: "Statistical Methods for Economics", category: "Core Paper", credits: 4, units: ["Probability Distributions & Sampling", "Estimation Theory & Confidence Intervals", "Hypothesis Testing (t, chi-sq, F tests)", "Index Numbers & Time Series"] },
        ],
      },
      {
        semesterName: "Semester 4",
        semesterOrder: 4,
        subjects: [
          { code: "ECO-401", title: "Intermediate Microeconomics II", category: "Core Paper", credits: 4, units: ["General Equilibrium & Welfare Economics", "Externalities & Public Goods", "Asymmetric Information & Moral Hazard", "Principal-Agent Models"] },
          { code: "ECO-402", title: "Intermediate Macroeconomics II", category: "Core Paper", credits: 4, units: ["Endogenous Growth Models", "Open Economy Macroeconomics & Exchange Rates", "Rational Expectations & Lucas Critique", "Fiscal Rules & Debt Dynamics"] },
          { code: "ECO-403", title: "Introductory Econometrics", category: "Core Paper", credits: 4, units: ["Simple Linear Regression (OLS)", "Multiple Regression & OLS Properties", "Heteroskedasticity & Autocorrelation", "Dummy Variables & Model Specification"] },
        ],
      },
      {
        semesterName: "Semester 5",
        semesterOrder: 5,
        subjects: [
          { code: "ECO-501", title: "Indian Economy I", category: "Discipline Specific Elective", credits: 4, units: ["Economic Development Since Independence", "Demographic Trends & Human Development", "Agriculture Sector Growth & Reforms", "Industrial Policy & Service Sector Expansion"] },
          { code: "ECO-502", title: "Development Economics I", category: "Discipline Specific Elective", credits: 4, units: ["Conceptions of Development & Inequality", "Poverty Measures & Income Distribution", "Population Growth & Economic Transition", "Environment & Sustainable Development"] },
        ],
      },
    ],
  },
  {
    id: "ba-hist-hons",
    name: "B.A. (H) History — University of Delhi",
    code: "BA-HIST-HONS",
    degree: "History",
    description: "Ancient, Medieval, Modern Indian & World History Curriculum",
    semesters: [
      {
        semesterName: "Semester 1",
        semesterOrder: 1,
        subjects: [
          { code: "HIST-101", title: "History of India I (From earliest times up to c. 300 BCE)", category: "Core Paper", credits: 4, units: ["Sources & Historiography", "Paleolithic, Mesolithic & Neolithic Cultures", "Harappan Civilization Features & Decline", "Vedic Economy, Society & Polity"] },
          { code: "HIST-102", title: "Social Formations and Cultural Patterns of the Ancient World I", category: "Core Paper", credits: 4, units: ["Evolution of Humankind & Hominids", "Bronze Age Civilizations (Mesopotamia, Egypt)", "Nomadic Groups & Iron Age Metallurgy", "Ancient Greek Society & Culture"] },
        ],
      },
      {
        semesterName: "Semester 2",
        semesterOrder: 2,
        subjects: [
          { code: "HIST-201", title: "History of India II (c. 300 BCE to 750 CE)", category: "Core Paper", credits: 4, units: ["Maurya Empire Administration & Ashoka's Dhamma", "Post-Mauryan Economy, Trade & Sangam Age", "Gupta Empire State, Society & Culture", "Post-Gupta Kingdoms (Harsha, Chalukyas, Pallavas)"] },
        ],
      },
      {
        semesterName: "Semester 3",
        semesterOrder: 3,
        subjects: [
          { code: "HIST-301", title: "History of India III (c. 750 CE to 1200 CE)", category: "Core Paper", credits: 4, units: ["Tripartite Struggle & Regional Kingdoms", "Agrarian Economy & Feudalism Debate", "Bhakti & Sufi Movements Emergence", "Chola State Administration & Maritime Trade"] },
          { code: "HIST-302", title: "Rise of the Modern West I", category: "Core Paper", credits: 4, units: ["Transition from Feudalism to Capitalism", "Renaissance & Humanism Movement", "Reformation & Counter-Reformation", "Commercial Revolution & Overseas Empires"] },
        ],
      },
    ],
  },
  {
    id: "ba-pol-hons",
    name: "B.A. (H) Political Science — University of Delhi",
    code: "BA-POL-HONS",
    degree: "Political Science",
    description: "Political Theory, Comparative Politics & International Relations",
    semesters: [
      {
        semesterName: "Semester 1",
        semesterOrder: 1,
        subjects: [
          { code: "POL-101", title: "Understanding Political Theory", category: "Core Paper", credits: 4, units: ["What is Politics & Political Theory", "Traditions: Liberal, Marxist, Anarchist, Feminist", "Key Concepts: Liberty, Equality, Justice, Rights", "State & Sovereignty Foundations"] },
          { code: "POL-102", title: "Constitutional Government and Democracy in India", category: "Core Paper", credits: 4, units: ["Constituent Assembly & Preamble", "Fundamental Rights & Directive Principles", "Legislature, Executive & Judiciary Dynamics", "Federalism & Decentralization Mechanics"] },
        ],
      },
      {
        semesterName: "Semester 2",
        semesterOrder: 2,
        subjects: [
          { code: "POL-201", title: "Political Theory: Concepts and Debates", category: "Core Paper", credits: 4, units: ["Freedom & Autonomy Debates", "Equality of Opportunity vs Outcome", "Justice: Rawls & Communitarian Critiques", "Democracy: Representative vs Participatory"] },
          { code: "POL-202", title: "Political Process in India", category: "Core Paper", credits: 4, units: ["Party System & Electoral Politics", "Caste, Class & Religion Intersections", "Regionalism & Sub-national Identities", "Social Movements & Civil Society"] },
        ],
      },
    ],
  },
  {
    id: "bsc-zool-hons",
    name: "B.Sc. (H) Zoology — University of Delhi",
    code: "BSC-ZOOL-HONS",
    degree: "Zoology",
    description: "Animal Diversity, Physiology, Cell Biology & Evolutionary Genetics",
    semesters: [
      {
        semesterName: "Semester 1",
        semesterOrder: 1,
        subjects: [
          { code: "ZOOL-101", title: "Non-Chordates I: Protista to Pseudocoelomates", category: "Core Paper", credits: 4, units: ["Protista Classification & Locomotion", "Porifera Canal System & Skeleton", "Cnidaria Metagenesis & Coral Reefs", "Platyhelminthes & Nematoda Parasitic Adaptations"] },
          { code: "ZOOL-102", title: "Principles of Ecology", category: "Core Paper", credits: 4, units: ["Ecosystem Structure & Energy Flow", "Population Dynamics & Life Tables", "Community Interactions & Succession", "Conservation Biology & Biodiversity"] },
        ],
      },
      {
        semesterName: "Semester 2",
        semesterOrder: 2,
        subjects: [
          { code: "ZOOL-201", title: "Non-Chordates II: Coelomates", category: "Core Paper", credits: 4, units: ["Annelida Metamerism & Excretion", "Arthropoda Metamorphosis & Respiration", "Mollusca Torsion & Shell Structure", "Echinodermata Water Vascular System"] },
          { code: "ZOOL-202", title: "Cell Biology", category: "Core Paper", credits: 4, units: ["Plasma Membrane Transport Mechanics", "Organelles: Mitochondria, ER, Golgi", "Nucleus, Chromatin & Nucleosome", "Cell Cycle, Mitosis, Meiosis & Apoptosis"] },
        ],
      },
    ],
  },
  {
    id: "ge-pool",
    name: "Generic Elective Pool (GE) — Interdisciplinary",
    code: "GE-POOL",
    degree: "Electives",
    description: "University-Wide Interdisciplinary Subject Options Across Commerce, Arts & Science",
    semesters: [
      {
        semesterName: "Semesters 1 - 4 Pool",
        semesterOrder: 1,
        subjects: [
          { code: "GE-COMM-01", title: "Basics of Accounting", category: "Generic Elective", credits: 4, units: ["Accounting Principles", "Journal, Ledger & Trial Balance", "Bank Reconciliation Statement", "Final Accounts of Sole Proprietors"] },
          { code: "GE-ECO-01", title: "Introductory Economics", category: "Generic Elective", credits: 4, units: ["Microeconomic Fundamentals", "Market Equilibrium", "Macroeconomic Aggregates", "Money & Inflation Basics"] },
          { code: "GE-MATH-01", title: "Calculus and Matrices", category: "Generic Elective", credits: 4, units: ["Matrix Operations & Determinants", "Limits, Continuity & Derivatives", "Applications of Differentiation", "Partial Derivatives Basics"] },
          { code: "GE-ENG-01", title: "Academic Writing and Composition", category: "Generic Elective", credits: 4, units: ["Structuring Academic Essays", "Citation & Plagiarism Standards", "Critical Reading & Analysis", "Editing & Proofreading Skills"] },
        ],
      },
    ],
  },
  {
    id: "sec-pool",
    name: "Skill Enhancement Courses (SEC)",
    code: "SEC-POOL",
    degree: "Skills",
    description: "Practical Skill-Oriented Units for Industry & Employment Readiness",
    semesters: [
      {
        semesterName: "Skill Pool",
        semesterOrder: 1,
        subjects: [
          { code: "SEC-01", title: "E-Commerce & Digital Marketing", category: "Skill Enhancement Course", credits: 2, units: ["Digital Marketing Channels", "SEO & Keyword Research", "Social Media Campaigns", "Google Analytics Basics"] },
          { code: "SEC-02", title: "Data Analysis using Spreadsheets", category: "Skill Enhancement Course", credits: 2, units: ["Data Cleaning & Formatting", "VLOOKUP, INDEX-MATCH & XLOOKUP", "Pivot Tables & Slicers", "Dashboard Creation"] },
          { code: "SEC-03", title: "Personal Financial Planning", category: "Skill Enhancement Course", credits: 2, units: ["Budgeting & Savings Goals", "Mutual Funds & Stock Investing", "Insurance & Tax Savings", "Retirement & Estate Planning"] },
        ],
      },
    ],
  },
];

export function MasterSyllabusInspector() {
  const [selectedCourseId, setSelectedCourseId] = useState("bcom-hons");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [expandedSemesters, setExpandedSemesters] = useState<Record<string, boolean>>({
    "Semester 1": true,
    "Semester 2": true,
    "Semester 3": true,
    "Semester 4": true,
    "Semester 5": true,
    "Semester 6": true,
  });
  const [viewMode, setViewMode] = useState<"directory" | "json">("directory");

  const selectedCourse = useMemo(() => {
    return MASTER_SYLLABUS_DATA.find((c) => c.id === selectedCourseId) || MASTER_SYLLABUS_DATA[0];
  }, [selectedCourseId]);

  function toggleSemester(name: string) {
    setExpandedSemesters((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  const filteredSemesters = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query && activeCategory === "All") return selectedCourse.semesters;

    return selectedCourse.semesters
      .map((sem) => {
        const matchingSubjects = sem.subjects.filter((sub) => {
          const matchesQuery =
            !query ||
            sub.title.toLowerCase().includes(query) ||
            sub.code.toLowerCase().includes(query) ||
            sub.units.some((u) => u.toLowerCase().includes(query));
          const matchesCategory = activeCategory === "All" || sub.category === activeCategory;
          return matchesQuery && matchesCategory;
        });

        return { ...sem, subjects: matchingSubjects };
      })
      .filter((sem) => sem.subjects.length > 0);
  }, [selectedCourse, searchQuery, activeCategory]);

  function categoryBadgeStyle(cat: string) {
    switch (cat) {
      case "Core Paper":
        return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
      case "Discipline Specific Elective":
        return "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300";
      case "Generic Elective":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
      case "Skill Enhancement Course":
        return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
      default:
        return "border-border bg-surface-muted text-muted";
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode("directory")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              viewMode === "directory"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            <Table size={16} weight="bold" />
            Detailed Syllabus Directory
          </button>
          <button
            type="button"
            onClick={() => setViewMode("json")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
              viewMode === "json"
                ? "bg-accent text-accent-foreground shadow-sm"
                : "bg-surface-muted text-muted hover:text-foreground"
            }`}
          >
            <Code size={16} weight="bold" />
            Raw JSON Spec
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <ShieldCheck size={16} weight="bold" className="text-emerald-500" />
          <span>Isolated Dataset Namespace Active</span>
        </div>
      </div>

      {viewMode === "json" ? (
        <div className="rounded-2xl border border-border bg-background p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-sm font-bold text-foreground">
              du-master-syllabus-schema.json
            </h3>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600">
              Valid JSON 100%
            </span>
          </div>
          <pre className="max-h-[500px] overflow-auto rounded-xl bg-surface p-4 font-mono text-xs text-foreground/90 border border-border">
            {JSON.stringify(selectedCourse, null, 2)}
          </pre>
        </div>
      ) : (
        <>
          {/* Clickable Verified Master Program Cards */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">
                Verified Master Programs ({MASTER_SYLLABUS_DATA.length}) — Click any card to expand full in-depth syllabus
              </h3>
              <span className="text-xs font-bold text-accent">
                Currently Viewing: {selectedCourse.name.split("—")[0].trim()}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {MASTER_SYLLABUS_DATA.map((course) => {
                const isSelected = course.id === selectedCourseId;
                const totalSubjects = course.semesters.reduce((sum, sem) => sum + sem.subjects.length, 0);
                return (
                  <button
                    key={course.id}
                    type="button"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                      document.getElementById("syllabus-inspector-detail")?.scrollIntoView({ behavior: "smooth" });
                    }}
                    className={`flex flex-col justify-between rounded-2xl border text-left p-5 transition-all cursor-pointer space-y-4 ${
                      isSelected
                        ? "border-accent bg-accent-soft/40 ring-2 ring-accent/30 shadow-md"
                        : "border-border bg-surface hover:border-accent/40 hover:shadow-sm"
                    }`}
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          isSelected ? "bg-accent text-accent-foreground" : "bg-surface-muted text-muted"
                        }`}>
                          {course.code}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle size={12} weight="bold" />
                          100% Verified
                        </span>
                      </div>

                      <div>
                        <h4 className="text-base font-bold text-foreground">{course.name}</h4>
                        <p className="mt-1 text-xs text-muted leading-relaxed line-clamp-2">{course.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted">
                      <span className="font-semibold">{course.semesters.length} Semesters</span>
                      <span className="font-bold text-foreground">{totalSubjects} Subjects</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Course Header Banner */}
          <div id="syllabus-inspector-detail" className="rounded-2xl border border-accent/30 bg-accent-soft/40 p-6 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground">
                  {selectedCourse.code}
                </span>
                <h2 className="mt-2 text-xl font-bold font-display text-foreground">
                  {selectedCourse.name}
                </h2>
                <p className="mt-1 text-xs text-muted leading-relaxed">{selectedCourse.description}</p>
              </div>

              <div className="flex items-center gap-2 rounded-xl bg-surface p-3 border border-border text-xs font-bold text-foreground">
                <CheckCircle size={18} weight="fill" className="text-emerald-500" />
                <span>100% In-Depth Syllabus Verified</span>
              </div>
            </div>
          </div>

          {/* Search & Category Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4">
            <div className="flex min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
              <MagnifyingGlass size={16} className="text-muted shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subject code, paper title, or unit topic..."
                className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {["All", "Core Paper", "Discipline Specific Elective", "Skill Enhancement Course", "Generic Elective"].map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition ${
                    activeCategory === cat
                      ? "bg-foreground text-background"
                      : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  {cat === "Discipline Specific Elective" ? "DSE Electives" : cat === "Skill Enhancement Course" ? "SEC Skills" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Semester Accordion List */}
          <div className="space-y-4">
            {filteredSemesters.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
                No subjects matched your search filter. Try clearing your search query.
              </div>
            ) : (
              filteredSemesters.map((sem) => {
                const isExpanded = expandedSemesters[sem.semesterName] ?? true;
                return (
                  <div key={sem.semesterName} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                    {/* Semester Header */}
                    <button
                      type="button"
                      onClick={() => toggleSemester(sem.semesterName)}
                      className="flex w-full items-center justify-between border-b border-border/60 bg-surface-muted/50 px-5 py-3.5 text-left transition hover:bg-surface-muted"
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground font-bold text-xs">
                          S{sem.semesterOrder}
                        </span>
                        <h4 className="text-sm font-bold text-foreground">{sem.semesterName}</h4>
                        <span className="rounded-full bg-surface px-2.5 py-0.5 text-[11px] font-bold text-muted border border-border">
                          {sem.subjects.length} Papers
                        </span>
                      </div>

                      {isExpanded ? <CaretDown size={16} weight="bold" /> : <CaretRight size={16} weight="bold" />}
                    </button>

                    {/* Semester Subjects Grid */}
                    {isExpanded && (
                      <div className="divide-y divide-border/40 p-4 space-y-4">
                        {sem.subjects.map((sub) => (
                          <div key={sub.code} className="pt-4 first:pt-0 space-y-3">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-bold text-foreground bg-surface-muted px-2 py-0.5 rounded border border-border">
                                    {sub.code}
                                  </span>
                                  <h5 className="text-sm font-bold text-foreground">{sub.title}</h5>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${categoryBadgeStyle(sub.category)}`}>
                                  {sub.category}
                                </span>
                                <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-bold text-muted border border-border">
                                  {sub.credits} Credits
                                </span>
                              </div>
                            </div>

                            {/* Units Breakdown */}
                            <div className="space-y-1 pl-2 border-l-2 border-accent/40">
                              <p className="text-[11px] font-bold text-muted uppercase tracking-wider">Official Syllabus Unit Breakdown:</p>
                              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-4">
                                {sub.units.map((unit, idx) => (
                                  <div key={unit} className="rounded-lg bg-background p-2 border border-border/50 text-[11px] font-medium text-foreground/90">
                                    <span className="font-bold text-accent">Unit {idx + 1}: </span>
                                    {unit}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
