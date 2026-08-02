/**
 * Imports flat, public Google Drive PYQ folders into the unified catalog.
 *
 * Each Drive file remains hosted by Google; NoteVault stores its metadata
 * and public view link in CatalogPaperUpload. The import is idempotent because
 * the SHA-256 hash of the Drive file id is stored in the unique fileHash field.
 *
 * Dry-run is the default. Pass --apply to write.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import sourceCatalog from "../src/data/ramanujan-pyq-catalog.json";
import { PrismaClient } from "../src/generated/prisma";
import { listDriveFolderPdfs } from "../src/lib/google-drive";
import { matchDriveSubjectName } from "../src/lib/subject-quality";

type Source = {
  folderId: string;
  folderName: string;
  yearRange: string;
  defaultSemesterGroup: string;
};

const SOURCES: Source[] = [
  {
    folderId: "1GgoxyyEF26DkNS3Qm-StMdRLR-1UYQjT",
    folderName: "Question Paper May June 2026 Sem- (2,4,6 and 8)",
    yearRange: "2026",
    defaultSemesterGroup: "II,IV,VI,VIII",
  },
  {
    folderId: "1zvQNLtVYLOax6zyDIP_UemtvnwiZCqQN",
    folderName: "Question paper 2025-26 Nov Dec Sem 1,3,5,7",
    yearRange: "2025-2026",
    defaultSemesterGroup: "I,III,V,VII",
  },
];

const prisma = new PrismaClient();
const catalog = sourceCatalog as Array<{ course: string; subject: string }>;
const subjectsByCourse = new Map<string, Array<{ id: string; name: string }>>();

for (const [index, paper] of catalog.entries()) {
  const subjects = subjectsByCourse.get(paper.course) ?? [];
  subjects.push({ id: String(index), name: paper.subject });
  subjectsByCourse.set(paper.course, subjects);
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ROMAN_TO_NUMBER: Record<string, number> = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
  viii: 8,
};
const NUMBER_TO_ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"];

function extractSemesters(fileName: string) {
  const marker = fileName.match(/\bsem(?:ester)?\s*[-:]*\s*/i);
  if (!marker || marker.index == null) return [] as number[];
  const tail = fileName.slice(marker.index + marker[0].length, marker.index + marker[0].length + 28);
  const tokens = tail.match(/\b(?:viii|vii|vi|iv|v|iii|ii|i|[1-8])\b/gi) ?? [];
  return [
    ...new Set(
      tokens
        .map((token) => Number(token) || ROMAN_TO_NUMBER[token.toLowerCase()] || 0)
        .filter((value) => value >= 1 && value <= 8),
    ),
  ].sort((a, b) => a - b);
}

function cleanSubjectName(fileName: string) {
  return fileName
    .replace(/\.pdf$/i, " ")
    .replace(/\[\s*\d+\s*\]/g, " ")
    .replace(
      /\bsem(?:ester)?\s*[-:]*\s*(?:1|2|3|4|5|6|7|8|viii|vii|vi|iv|v|iii|ii|i)(?:\s*(?:,|-|\/|&|and)\s*(?:1|2|3|4|5|6|7|8|viii|vii|vi|iv|v|iii|ii|i))*\b/gi,
      " ",
    )
    .replace(/\[\s*(?:nep|ugcf)[^\]]*\]/gi, " ")
    .replace(/\b(?:nep|ugcf|cbcs|old course|upc)\b/gi, " ")
    .replace(/\b(?:dsc|dse)\s*[-:]?\s*\d*\b/gi, " ")
    .replace(/\b(?:vac|aecc?|sec|ge)\b/gi, " ")
    .replace(/\b(?:for\s+)?common\s+(?:prog(?:ramme)?|pool|group)\b/gi, " ")
    .replace(
      /\bb\.?\s*a\.?\s*(?:(?:\(\s*h(?:ons?\.?)?\s*\)|hons?\.?)\s*(?:economics|english|hindi|history|political\s+science|pol(?:itical)?\.?\s*science|punjabi|sanskrit|sociology|geography|mathematics)?|programme|program|prog(?:ramme)?\.?)\b/gi,
      " ",
    )
    .replace(
      /\bb\.?\s*a\.?\s*(?:economics|english|hindi|history|political\s+science|pol\.?\s*science|punjabi|sanskrit|sociology|geography|mathematics)\s*(?:\(\s*h(?:ons?\.?)?\s*\)|hons?\.?|programme|program|prog(?:ramme)?\.?)\b/gi,
      " ",
    )
    .replace(
      /\bb\.?\s*sc\.?\s*(?:(?:\(\s*h(?:ons?\.?)?\s*\)|hons?\.?)\s*(?:biochemistry|botany|chemistry|computer\s+science|mathematics|physics|zoology|statistics)?|programme|program|prog(?:ramme)?\.?)\b/gi,
      " ",
    )
    .replace(
      /\bb\.?\s*sc\.?\s*(?:biochemistry|botany|chemistry|computer\s+science|maths?|mathematics|physics|zoology|statistics)\s*(?:\(\s*h(?:ons?\.?)?\s*\)|hons?\.?)\b/gi,
      " ",
    )
    .replace(
      /\bb\.?\s*com\.?\s*(?:(?:\(\s*h(?:ons?\.?)?\s*\)|hons?\.?)|(?:\(\s*(?:p|prg|prog)\s*\)|programme|program|prog(?:ramme)?\.?))?\b/gi,
      " ",
    )
    .replace(/[;:_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function explicitCourse(fileName: string) {
  const name = normalize(fileName);
  if (/\bvac\b/.test(name)) return "VAC";
  if (/\b(?:aec|aecc)\b/.test(name)) return "AEC";
  if (/\bsec\b/.test(name)) return "SEC";
  if (/\b(?:ge|generic elective)\b/.test(name)) return "Generic Elective";
  if (/\b(?:b com|bcom)\b.*\b(?:h|hon|hons|honours)\b/.test(name)) return "B. Com. (H)";
  if (/\b(?:b com|bcom)\b.*\b(?:p|prg|prog|program|programme)\b/.test(name)) return "B. Com. (P)";
  if (/\bb a\b.*\b(?:p|prog|program|programme)\b/.test(name)) return "B.A. (P)";
  if (/\bbba\b/.test(name)) return "BBA";
  if (/\bbms\b/.test(name)) return "BMS";
  if (/\bb voc\b/.test(name)) return "B. Voc.";

  const explicitDisciplines: Array<[RegExp, string]> = [
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bpolitical science\b/, "Political Science"],
    [/\bb a\b.*\b(?:political science|pol sci)\b.*\b(?:h|hon|hons|honours)\b/, "Political Science"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bhistory\b/, "History"],
    [/\bb a\b.*\bhistory\b.*\b(?:h|hon|hons|honours)\b/, "History"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\benglish\b/, "English"],
    [/\bb a\b.*\benglish\b.*\b(?:h|hon|hons|honours)\b/, "English"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bhindi\b/, "Hindi"],
    [/\bb a\b.*\bhindi\b.*\b(?:h|hon|hons|honours)\b/, "Hindi"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\beconomics\b/, "Economics"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bgeography\b/, "Geography"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bphilosophy\b/, "Philosophy"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bpsychology\b/, "Applied Psychology"],
    [/\bb a\b.*\b(?:h|hon|hons|honours)\b.*\bsociology\b/, "Sociology"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bstatistics\b/, "Statistics"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bmathematics\b/, "Mathematics"],
    [/\bb sc\b.*\b(?:maths|mathematics)\b.*\b(?:h|hon|hons|honours)\b/, "Mathematics"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bcomputer science\b/, "Computer Science"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bbiochemistry\b/, "Biochemistry"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bbotany\b/, "Botany"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bchemistry\b/, "Chemistry"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bphysics\b/, "Physics"],
    [/\bb sc\b.*\b(?:h|hon|hons|honours)\b.*\bzoology\b/, "Zoology"],
  ];
  return explicitDisciplines.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

function uniqueCatalogCourse(subject: string) {
  const ranked = [...subjectsByCourse.entries()]
    .map(([course, candidates]) => ({
      course,
      confidence: matchDriveSubjectName(candidates, subject).confidence,
    }))
    .sort((a, b) => b.confidence - a.confidence);
  if (ranked[0].confidence >= 0.9 && ranked[0].confidence - ranked[1].confidence >= 0.025) {
    return ranked[0].course;
  }
  return null;
}

function keywordCourse(subject: string) {
  const name = normalize(subject);
  const rules: Array<[RegExp, string]> = [
    [/\b(?:geography|geographic|geographical|geomorphology|oceanography|climatology|cartography|regional planning)\b/, "Geography"],
    [/\b(?:politic|political|pol sci|public administration|international relation|foreign policy|human rights|election commission|election comission|democracy|governance|constitutional government|fundamental rights|ambedkar|globalisation|understanding security)\w*\b/, "Political Science"],
    [/\b(?:history|historical|histories|histopries|colonialism|nationalism|ancient india|medieval india|modern india|museology|epigraphy|paleography|modern west|south indian past|ancient societies|ancient socities|ancient world|modern europe|cultural trnsformation)\b/, "History"],
    [/\b(?:literature|literary|literatura|fiction|poetry|drama|novel|english writing|english fluency|translation|graphic narratives|dystopian writings|women s writing|women writing|dalit writing|writing in english)\b/, "English"],
    [/\b(?:hindi|kavita|kahani|natak|bhasha|sahitya|bhartendu|gadya|jansanchar|rachna|lekhan|kabirdas|tulsidas|kavya sastra|shodh providhi|aashad)\b/, "Hindi"],
    [/\bpunjabi\b/, "Punjabi"],
    [/\b(?:sanskrit|vedic)\b/, "Sanskrit"],
    [/\burdu\b/, "Urdu"],
    [/\b(?:psychology|psychological|counselling|counseling)\b/, "Applied Psychology"],
    [/\b(?:philosophy|philosophical|ethics|logic)\b/, "Philosophy"],
    [/\b(?:sociology|sociological|society and culture|social relation|communicating culture)\b/, "Sociology"],
    [/\b(?:statistics|statistical|probability distribution|sampling theory|biostatistics)\b/, "Statistics"],
    [/\b(?:mathematics|maths|calculus|algebra|differential equation|real analysis|complex analysis|linear analysis|numerical method|geometry|mathematical|riemann integration|metric spaces|ring theory|series and sequence|field theory|galois)\b/, "Mathematics"],
    [/\b(?:computer science|programming|data structure|database|operating system|computer application|machine learning|information theory and coding)\b/, "Computer Science"],
    [/\b(?:economics|economic|microeconomics|macroeconomics|economy|econometric|money and bank|developmental theory|game theory|digitalisation and development|digitalisation and develpoment)\w*\b/, "Economics"],
    [/\b(?:accounting|auditing|tax|business law|company law|industrial law|industrial and labour regulation|management|managment|marketing|commerce|finance|banking|insurance|entrepreneurship|enterpreneurship|organisational|organizational|corporate govern|consumer affairs|consumer affirs|quantitative methods)\w*\b/, "B. Com. (H)"],
    [/\b(?:environmental science|environment|enviornment|envirom|ecology|biodiversity|natural resource|evs)\w*\b/, "Environmental Science"],
    [/\b(?:teacher education|education policy|pedagogy)\b/, "Education"],
    [/\b(?:sports training|physical education|sports psychology)\b/, "Physical Education"],
    [/\bbiochemistry\b/, "Biochemistry"],
    [/\b(?:botany|plant physiology|plant taxonomy)\b/, "Botany"],
    [/\b(?:chemistry|organic chemistry|inorganic chemistry|physical chemistry)\b/, "Chemistry"],
    [/\b(?:physics|mechanics|electromagnetism|quantum|solid state)\b/, "Physics"],
    [/\b(?:zoology|animal physiology|entomology)\b/, "Zoology"],
    [/\b(?:nutrition|food science|human development|fabric|fabrics|apparel)\b/, "Home Science"],
    [/\bsocial work\b/, "Social Work"],
    [/\b(?:social and emotional learning|social and emotional lerning|constitutional values|creativity and innovation)\b/, "VAC"],
    [/\b(?:life skill education|life skill eductaion)\b/, "SEC"],
    [/\bcontemporary india\b/, "Generic Elective"],
  ];
  return rules.find(([pattern]) => pattern.test(name))?.[1] ?? null;
}

function inferCourse(fileName: string, subject: string) {
  return (
    explicitCourse(fileName) ??
    keywordCourse(subject) ??
    uniqueCatalogCourse(subject) ??
    "Another Question Papers"
  );
}

function driveHash(fileId: string) {
  return createHash("sha256").update(`google-drive:${fileId}`).digest("hex");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const discovered: Array<{
    course: string;
    subject: string;
    yearRange: string;
    semesterGroup: string;
    semester: number | null;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    note: string;
  }> = [];

  for (const source of SOURCES) {
    const files = await listDriveFolderPdfs(source.folderId);
    for (const file of files) {
      const semesters = extractSemesters(file.name);
      const subject = cleanSubjectName(file.name) || file.name.replace(/\.pdf$/i, "").trim();
      discovered.push({
        course: inferCourse(file.name, subject),
        subject,
        yearRange: source.yearRange,
        semesterGroup: semesters.length
          ? semesters.map((semester) => NUMBER_TO_ROMAN[semester]).join(",")
          : source.defaultSemesterGroup,
        semester: semesters.length === 1 ? semesters[0] : null,
        fileUrl: file.webViewLink,
        fileName: file.name,
        fileSize: 0,
        fileHash: driveHash(file.id),
        note: `Google Drive · ${source.folderName}`,
      });
    }
  }

  const existing = new Set(
    (
      await prisma.catalogPaperUpload.findMany({
        where: { fileHash: { in: discovered.map((paper) => paper.fileHash) } },
        select: { fileHash: true },
      })
    ).map((paper) => paper.fileHash),
  );
  const newPapers = discovered.filter((paper) => !existing.has(paper.fileHash));
  const byCourse = Object.fromEntries(
    [...newPapers.reduce((counts, paper) => {
      counts.set(paper.course, (counts.get(paper.course) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort((a, b) => b[1] - a[1]),
  );
  const review = newPapers
    .filter((paper) => paper.course === "Another Question Papers")
    .map((paper) => ({ fileName: paper.fileName, subject: paper.subject }));

  if (apply && newPapers.length) {
    await prisma.catalogPaperUpload.createMany({
      data: newPapers,
      skipDuplicates: true,
    });
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        discovered: discovered.length,
        exactExisting: existing.size,
        added: apply ? newPapers.length : 0,
        wouldAdd: newPapers.length,
        byCourse,
        needsReview: review.length,
        review,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
