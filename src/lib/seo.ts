// Central SEO constants and structured-data builders, reused across
// robots.ts, sitemap.ts, generateMetadata() exports, and JSON-LD blocks.
export const SITE_URL = "https://www.dupyq.online";
export const SITE_NAME = "DU PYQ Online";

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    "name": SITE_NAME,
    "url": `${SITE_URL}/`,
    "logo": {
      "@type": "ImageObject",
      "url": `${SITE_URL}/logo.png`,
      "width": 512,
      "height": 512
    }
  };
}

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    "url": `${SITE_URL}/`,
    "name": SITE_NAME,
    "alternateName": [
      "DU PYQ",
      "Delhi University PYQ"
    ],
    "description": "Free Delhi University previous year question papers, notes, syllabus and answer keys.",
    "publisher": {
      "@id": `${SITE_URL}/#organization`
    },
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": `${SITE_URL}/search?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    }
  };
}

export function blogPostingJsonLd(post: {
  title: string;
  description: string;
  slug: string;
  author: string;
  publishedAt: string;
  updatedAt?: string;
  keywords?: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    url: absoluteUrl(`/blog/${post.slug}`),
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt ?? post.publishedAt,
    keywords: post.keywords?.join(", "),
    author: { "@type": "Organization", name: post.author },
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      "item": item.url.startsWith("http") ? item.url : absoluteUrl(item.url),
    })),
  };
}

export function generateSubjectMetadata(subjectName: string, program: string, semester: string, type: 'home' | 'pyq' | 'notes' | 'test' | 'questions' | 'syllabus') {
  const baseTitle = `${subjectName} — DU ${program} Semester ${semester}`;
  
  switch (type) {
    case 'pyq':
      return {
        title: `${subjectName} DU Previous Year Question Papers | ${program}`,
        description: `Download 10 years of DU PYQs for ${subjectName} (${program} Sem ${semester}). PDF question papers with solutions.`,
      };
    case 'notes':
      return {
        title: `${subjectName} Notes DU | ${program} Semester ${semester}`,
        description: `Complete study notes, unit summaries, and revision material for ${subjectName} at Delhi University.`,
      };
    case 'questions':
      return {
        title: `${subjectName} Important Questions DU | Most Repeated`,
        description: `Top repeated and most expected questions for DU ${subjectName} exam. Based on past 10 years of Delhi University PYQs.`,
      };
    case 'test':
      return {
        title: `${subjectName} DU Mock Test & MCQ Practice`,
        description: `Practice online tests and MCQs for DU ${subjectName}. Generated from actual Delhi University previous year question papers.`,
      };
    case 'syllabus':
      return {
        title: `${subjectName} DU Syllabus 2026 | ${program}`,
        description: `Latest UGCF syllabus for ${subjectName} (${program} Sem ${semester}) at Delhi University.`,
      };
    case 'home':
    default:
      return {
        title: `${baseTitle} | Notes, PYQs & Syllabus`,
        description: `Everything you need for DU ${subjectName} (${program} Semester ${semester}). PYQs, notes, syllabus, important questions, and tests.`,
      };
  }
}

/* ------------------------------------------------------------------ */
/* DU PYP SEO hierarchy — /papers/[prog], /papers/[prog]/[subj],       */
/* /paper-code/[code], /paper/[slug]. Titles kept natural (no keyword  */
/* stuffing); the root layout appends " | DU PYQ Online".              */
/* ------------------------------------------------------------------ */

export function programmePapersMetadata(name: string, slug: string, paperCount: number, subjectCount: number) {
  const title = `${name} Previous Year Question Papers PDF`;
  const description =
    `Delhi University ${name} previous year question papers — ${paperCount.toLocaleString("en-IN")} papers across ${subjectCount} subjects, organised by subject. View or download the original PDFs.`;
  const canonical = `/papers/${slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "website" as const },
  };
}

export function programmeSemesterMetadata(
  name: string,
  slug: string,
  semester: number,
  opts: { subjectCount: number; paperCount: number; years: string[] },
) {
  const title = `${name} Semester ${semester} Previous Year Question Papers PDF | DU`;
  const yearSpan =
    opts.years.length > 1 ? `${opts.years[opts.years.length - 1]}–${opts.years[0]}` : opts.years[0];
  const description =
    `Delhi University ${name} Semester ${semester} previous year question papers — ` +
    `${opts.subjectCount} subjects, ${opts.paperCount} papers${yearSpan ? ` (${yearSpan})` : ""}. ` +
    `Every subject with its DSC/DSE/GE/SEC papers, view or download the original PDFs.`;
  const canonical = `/papers/${slug}/semester-${semester}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "website" as const },
  };
}

export function subjectPapersMetadata(
  subjectName: string,
  programmeName: string,
  slugPath: string,
  opts: { semesters?: string[]; years?: string[]; paperCode?: string | null; paperCount: number },
) {
  // Data tags semesters in Roman numerals; students search "sem 3".
  const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8" };
  const sems = (opts.semesters ?? []).map((r) => ROMAN[r] ?? r);
  const semPart = sems.length === 1 ? ` (Semester ${sems[0]})` : "";
  const title = `${subjectName} PYQ${sems.length === 1 ? ` Sem ${sems[0]}` : ""} | DU ${programmeName} Previous Year Question Papers PDF`;
  const yearSpan =
    opts.years && opts.years.length > 1 ? `${opts.years[opts.years.length - 1]}–${opts.years[0]}` : opts.years?.[0];
  const description =
    `${subjectName}${semPart} previous year question papers for Delhi University ${programmeName}. ` +
    `${opts.paperCount} paper${opts.paperCount === 1 ? "" : "s"}${yearSpan ? ` from ${yearSpan}` : ""}` +
    `${opts.paperCode ? `, paper code ${opts.paperCode}` : ""}. Original PDFs, no login.`;
  const canonical = `/papers/${slugPath}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "website" as const },
  };
}

export function paperCodeMetadata(code: string, subjectNames: string[], paperCount: number, years: string[]) {
  const primary = subjectNames[0] ?? "DU course";
  const title = `${code} ${primary} DU Previous Year Papers`;
  const yearSpan = years.length > 1 ? `${years[years.length - 1]}–${years[0]}` : years[0];
  const description =
    `Unique Paper Code ${code} — ${primary}${subjectNames.length > 1 ? ` (and ${subjectNames.length - 1} related title${subjectNames.length > 2 ? "s" : ""})` : ""}. ` +
    `${paperCount} Delhi University question paper${paperCount === 1 ? "" : "s"}${yearSpan ? ` from ${yearSpan}` : ""}, with links to each subject page.`;
  const canonical = `/paper-code/${code}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "website" as const },
  };
}

export function individualPaperMetadata(p: {
  subjectName: string;
  programmeName: string;
  year: string | null;
  session: string | null;
  slug: string;
  paperCode?: string | null;
}) {
  const when = [p.session, p.year].filter(Boolean).join(" ");
  const title =
    `${p.subjectName} Question Paper${p.year ? ` ${p.year}` : ""} PDF | ${p.programmeName} DU`;
  const description =
    `Delhi University ${p.programmeName} — ${p.subjectName} previous year question paper${when ? ` (${when})` : ""}` +
    `${p.paperCode ? `, paper code ${p.paperCode}` : ""}. ` +
    `View the original PDF, download it, or browse other years for the same subject.`;
  const canonical = `/paper/${p.slug}`;
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: absoluteUrl(canonical), type: "article" as const },
  };
}

/** Minimal CollectionPage node — reflects the visible list of papers. */
export function collectionPageJsonLd(opts: { name: string; description: string; url: string; itemUrls: string[] }) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: opts.url.startsWith("http") ? opts.url : absoluteUrl(opts.url),
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: opts.itemUrls.length,
      itemListElement: opts.itemUrls.slice(0, 100).map((u, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: u.startsWith("http") ? u : absoluteUrl(u),
      })),
    },
  };
}

export function educationalCourseJsonLd(courseName: string, description: string, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "name": courseName,
    "description": description,
    "provider": {
      "@type": "Organization",
      "name": "Delhi University",
      "sameAs": "http://www.du.ac.in/"
    },
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "Onsite",
      "location": "Delhi, India"
    },
    "url": absoluteUrl(url)
  };
}

/* ------------------------------------------------------------------ */
/* LearningResource + FAQ — rich results / AI-answer extraction        */
/* ------------------------------------------------------------------ */

export interface Faq {
  q: string;
  a: string;
}

export function faqJsonLd(faqs: Faq[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** One past exam paper as a free, openly-accessible learning resource. */
export function learningResourceJsonLd(p: {
  slug: string;
  subjectName: string;
  programmeName: string;
  year: string | null;
  session: string | null;
  paperType: string | null;
  paperCode: string | null;
  fileUrl: string;
}) {
  const when = [p.session, p.year].filter(Boolean).join(" ");
  return {
    "@context": "https://schema.org",
    "@type": "LearningResource",
    name: `${p.subjectName} Question Paper${p.year ? ` ${p.year}` : ""} — DU ${p.programmeName}`,
    url: absoluteUrl(`/paper/${p.slug}`),
    learningResourceType: "Past Examination Paper",
    educationalLevel: "Undergraduate",
    inLanguage: "en",
    isAccessibleForFree: true,
    about: p.subjectName,
    ...(when ? { temporalCoverage: when } : {}),
    ...(p.paperCode ? { identifier: p.paperCode } : {}),
    educationalAlignment: {
      "@type": "AlignmentObject",
      alignmentType: "educationalFramework",
      educationalFramework: "Delhi University UGCF 2022 (NEP 2020)",
      targetName: [p.paperType, p.subjectName].filter(Boolean).join(" "),
    },
    encoding: { "@type": "MediaObject", contentUrl: p.fileUrl, encodingFormat: "application/pdf" },
    provider: { "@id": `${SITE_URL}/#organization` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
  };
}

function yearSpanOf(years: string[]): string {
  return years.length > 1 ? `${years[years.length - 1]}–${years[0]}` : (years[0] ?? "");
}

// FAQ answers are built only from fields already on the page — never invented.
export function subjectFaqs(s: {
  name: string;
  programmeName: string;
  paperCount: number;
  years: string[];
  paperCodes: string[];
  semesters: string[];
  paperTypes: string[];
}): Faq[] {
  const faqs: Faq[] = [
    {
      q: `Where can I download the DU ${s.name} previous year question paper PDF?`,
      a: `This page lists ${s.paperCount} ${s.name} question paper${s.paperCount === 1 ? "" : "s"} for ${s.programmeName} at Delhi University${s.years.length ? ` (${yearSpanOf(s.years)})` : ""}. Open any paper to view the original PDF or download it. It is free and needs no login.`,
    },
  ];
  if (s.years.length > 0)
    faqs.push({
      q: `Which years of ${s.name} question papers are available?`,
      a: `${s.name} papers are available for ${s.years.join(", ")}.`,
    });
  if (s.paperCodes.length > 0)
    faqs.push({
      q: `What is the paper code (UPC) of ${s.name}?`,
      a: `The Unique Paper Code${s.paperCodes.length > 1 ? "s" : ""} for ${s.name} in ${s.programmeName} ${s.paperCodes.length > 1 ? "are" : "is"} ${s.paperCodes.join(", ")}.`,
    });
  if (s.semesters.length > 0)
    faqs.push({
      q: `Which semester is ${s.name} taught in?`,
      a: `${s.name} is ${s.paperTypes.length ? `a ${s.paperTypes.join("/")} paper` : "a paper"} in Semester ${s.semesters.join(", ")} of ${s.programmeName}, according to DU's published scheme.`,
    });
  return faqs;
}

export function programmeFaqs(p: {
  name: string;
  paperCount: number;
  subjectCount: number;
  semesters: string[];
  paperTypes: string[];
}): Faq[] {
  const faqs: Faq[] = [
    {
      q: `Where can I get ${p.name} previous year question papers?`,
      a: `This page has ${p.paperCount.toLocaleString("en-IN")} ${p.name} question papers across ${p.subjectCount} subjects at Delhi University. Pick a subject to view or download the original PDFs, organised by exam year.`,
    },
    {
      q: `Are the ${p.name} question papers free?`,
      a: `Yes. Every paper is free to view and download, with no login. Each links to the original PDF.`,
    },
  ];
  if (p.semesters.length > 0)
    faqs.push({
      q: `Which ${p.name} semesters are covered?`,
      a: `Papers are available for Semester ${p.semesters.join(", ")}.`,
    });
  if (p.paperTypes.length > 0)
    faqs.push({
      q: `Can I find core, elective and skill papers for ${p.name}?`,
      a: `Yes. Papers are tagged by type (${p.paperTypes.join(", ")}), so you can find the core, elective, skill and value-added papers for your semester.`,
    });
  return faqs;
}

export function semesterFaqs(p: {
  name: string;
  semester: number;
  subjectCount: number;
  paperCount: number;
  years: string[];
}): Faq[] {
  return [
    {
      q: `Where can I find ${p.name} Semester ${p.semester} previous year question papers?`,
      a: `This page lists all ${p.subjectCount} Semester ${p.semester} subjects of ${p.name} with ${p.paperCount.toLocaleString("en-IN")} question papers${p.years.length ? ` from ${yearSpanOf(p.years)}` : ""}. Open a subject to view or download the PDFs.`,
    },
    {
      q: `How many subjects are in ${p.name} Semester ${p.semester}?`,
      a: `${p.subjectCount} subjects have question papers listed for ${p.name} Semester ${p.semester}.`,
    },
  ];
}

export function paperFaqs(p: {
  subjectName: string;
  programmeName: string;
  year: string | null;
  paperCode: string | null;
}): Faq[] {
  const faqs: Faq[] = [
    {
      q: `Where can I download the ${p.subjectName}${p.year ? ` ${p.year}` : ""} question paper PDF?`,
      a: `Use the View PDF or Download PDF button on this page to open the original ${p.programmeName} ${p.subjectName} question paper${p.year ? ` (${p.year})` : ""}. It is free, no login.`,
    },
  ];
  if (p.paperCode)
    faqs.push({
      q: `What is the paper code of this ${p.subjectName} paper?`,
      a: `The Unique Paper Code (UPC) is ${p.paperCode}.`,
    });
  return faqs;
}
