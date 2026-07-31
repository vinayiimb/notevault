import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import { getUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import { semesterLabel } from "@/lib/pyq-catalog-types";
import { slugify } from "@/lib/utils";

// pdf-lib + streaming a multi-MB merged file needs the Node runtime, not Edge.
export const runtime = "nodejs";

const MAX_PAPERS = 60;
const FETCH_TIMEOUT_MS = 20_000;

// The client only ever sends course/subject/semesterLabel — never a raw URL
// — so this route re-derives every fetchable file itself from the same
// trusted archive the page renders, instead of trusting arbitrary
// client-supplied URLs (which would open this up as an SSRF proxy).
function driveDirectDownloadUrl(webViewLink: string) {
  const match = webViewLink.match(/\/file\/d\/([^/]+)/);
  return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : null;
}

function resolveFetchUrl(paper: { source: string; pdfUrl: string }): URL | null {
  const raw = paper.source === "drive" ? (driveDirectDownloadUrl(paper.pdfUrl) ?? paper.pdfUrl) : paper.pdfUrl;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;

  const r2PublicUrl = process.env.R2_PUBLIC_URL;
  const allowed =
    url.hostname === "library.ramanujancollege.ac.in" ||
    url.hostname === "drive.google.com" ||
    (!!r2PublicUrl && url.href.startsWith(r2PublicUrl));
  return allowed ? url : null;
}

// GET (not POST) so the client can point a plain <a href> at this route and
// let the browser's own download handling take over — a real navigation
// with a Content-Disposition response is far more reliable across mobile
// browsers than a fetch-blob-createObjectURL dance, which is flaky on some
// mobile Safari versions.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const course = params.get("course") ?? "";
  const subject = params.get("subject") ?? "";
  const semLabel = params.get("semesterLabel") ?? "";
  if (!course || !subject) {
    return NextResponse.json({ error: "Missing course or subject." }, { status: 400 });
  }

  const archive = await getUnifiedPyqArchive();
  const subjectKey = canonicalSubjectKey(subject);
  const papers = archive.filter(
    (paper) =>
      paper.course === course &&
      canonicalSubjectKey(paper.subject) === subjectKey &&
      semesterLabel(paper) === semLabel &&
      paper.source !== "notevault", // read-online rows have no backing PDF file to merge
  );

  if (papers.length === 0) {
    return NextResponse.json({ error: "No downloadable files found for this subject." }, { status: 404 });
  }
  if (papers.length > MAX_PAPERS) {
    return NextResponse.json({ error: "Too many files to combine at once." }, { status: 400 });
  }

  const fetched = await Promise.all(
    papers.map(async (paper) => {
      const url = resolveFetchUrl(paper);
      if (!url) return null;
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
        const contentType = res.headers.get("content-type") ?? "";
        if (!res.ok || !contentType.includes("pdf")) return null;
        return new Uint8Array(await res.arrayBuffer());
      } catch {
        return null;
      }
    }),
  );

  const merged = await PDFDocument.create();
  let mergedCount = 0;

  for (const bytes of fetched) {
    if (!bytes) continue;
    try {
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      for (const page of pages) merged.addPage(page);
      mergedCount += 1;
    } catch {
      // Skip a file that isn't actually a valid PDF rather than failing the whole merge.
    }
  }

  if (mergedCount === 0) {
    return NextResponse.json({ error: "None of the files for this subject could be combined." }, { status: 502 });
  }

  const mergedBytes = await merged.save();
  const filename = `${slugify(`${subject} ${semLabel}`)}-combined.pdf`;

  return new NextResponse(Buffer.from(mergedBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Combined-Count": String(mergedCount),
      "X-Combined-Skipped": String(papers.length - mergedCount),
    },
  });
}
