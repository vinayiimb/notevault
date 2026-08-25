// @ts-nocheck
// HTML parsers for the three page shapes we scrape, all confirmed by hand
// against real (authenticated) responses in data/du-question-bank/_inspection/
// before this was written — see that directory for the raw evidence.
import * as cheerio from "cheerio";
import { BASE_URL } from "./config";
import type { Department, Paper, QuestionPaperRecord, SessionOption } from "./types";

// -- /web-search-adv (no department_id): #department_id and #session are
// always the full, unfiltered lists. --------------------------------------

export function parseDepartments(html: string): Department[] {
  const $ = cheerio.load(html);
  const out: Department[] = [];
  $("#department_id option").each((_, el) => {
    const value = $(el).attr("value")?.trim() ?? "";
    if (!value) return;
    out.push({ departmentId: value, departmentName: $(el).text().trim() });
  });
  return out;
}

export function parseSessions(html: string): SessionOption[] {
  const $ = cheerio.load(html);
  const out: SessionOption[] = [];
  $("#session option").each((_, el) => {
    const value = $(el).attr("value")?.trim() ?? "";
    if (!value) return;
    out.push({ sessionId: value, sessionName: value, rawSessionName: $(el).text().trim() });
  });
  return out;
}

// Paper option text is "NAME - CODE - TYPE". NAME itself can legitimately
// contain " - " (e.g. roman numerals: "ARABIC: TEXT... - II - 2012201101 -
// DSC4"), so we parse from the right: last token is the paper type, the
// token before that is the code IF it's numeric (DU paper codes always are)
// — otherwise we don't have a reliable split and leave code/type null
// rather than guess.
export function parsePaperOptionText(raw: string): { name: string; code: string | null; type: string | null } {
  const parts = raw.split(" - ").map((p) => p.trim());
  if (parts.length < 2) return { name: raw.trim(), code: null, type: null };

  const last = parts[parts.length - 1];
  const secondLast = parts[parts.length - 2];
  if (/^\d+$/.test(secondLast)) {
    return {
      name: parts.slice(0, parts.length - 2).join(" - "),
      code: secondLast,
      type: last || null,
    };
  }
  // Fall back: maybe there's no type suffix, just "NAME - CODE".
  if (/^\d+$/.test(last)) {
    return { name: parts.slice(0, parts.length - 1).join(" - "), code: last, type: null };
  }
  return { name: raw.trim(), code: null, type: null };
}

export function parsePapersForDepartment(html: string, departmentId: string, departmentName: string): Paper[] {
  const $ = cheerio.load(html);
  const out: Paper[] = [];
  $("#paper_id option").each((_, el) => {
    const value = $(el).attr("value")?.trim() ?? "";
    if (!value) return;
    const rawOptionText = $(el).text().trim();
    const { name, code, type } = parsePaperOptionText(rawOptionText);
    out.push({
      departmentId,
      departmentName,
      paperId: value,
      paperName: name,
      paperCode: code,
      paperType: type,
      rawOptionText,
    });
  });
  return out;
}

// -- /web-search?search_term=...&page=N ------------------------------------

export function parseSearchResults(html: string): { detailUrls: string[]; noResults: boolean; totalResults: number | null } {
  const $ = cheerio.load(html);
  const noResults = html.includes("No questions found");
  const detailUrls = new Set<string>();
  $('a[href*="web-page-details"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) detailUrls.add(href.startsWith("http") ? href : `${BASE_URL}${href}`);
  });
  const showingMatch = $.text().replace(/\s+/g, " ").match(/Showing\s*(\d+)\s*to\s*(\d+)\s*of\s*(\d+)\s*results/);
  return {
    detailUrls: [...detailUrls],
    noResults,
    totalResults: showingMatch ? Number(showingMatch[3]) : null,
  };
}

// -- /web-page-details/<id> --------------------------------------------

export function parseDetailPage(html: string, detailUrl: string): QuestionPaperRecord | null {
  const $ = cheerio.load(html);
  const heading = $("h1").first().text().replace(/\s+/g, " ").trim();
  // "Question Paper Name :: CORPORATE ACCOUNTING UPC :: 2412091201"
  const nameMatch = heading.match(/Question Paper Name\s*::\s*(.*?)\s*UPC\s*::/i);
  const upcMatch = heading.match(/UPC\s*::\s*(\S+)/i);
  if (!nameMatch && !upcMatch) return null; // not a valid detail page (e.g. error/expired link)

  // Each metadata field is its own <li>, e.g. "Session : MAY-JUNE-2026" —
  // parse per-item instead of matching across the concatenated text, which
  // let later fields' values bleed into earlier ones' captures.
  const fields = new Map<string, string>();
  $(".list-unstyled").first().find("li").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const m = text.match(/^([^:]+?)\s*:\s*(.*)$/);
    if (m) fields.set(m[1].trim().toLowerCase(), m[2].trim());
  });
  const session = fields.get("session") ?? null;
  const marks = fields.get("marks") ?? null;
  const set = fields.get("set") ?? null;
  const remarks = fields.get("remarks") ?? null;
  const questionFor = fields.get("question for") ?? null;

  let pdfUrl = $("embed[src]").first().attr("src") ?? null;
  if (pdfUrl && !pdfUrl.startsWith("http")) pdfUrl = `${BASE_URL}${pdfUrl}`;
  const pdfFilename = pdfUrl ? pdfUrl.split("/").pop() ?? null : null;

  const yearMatch = session?.match(/(\d{4})/);

  return {
    source: "DU_QUESTION_BANK",
    department_name: null,
    department_id: null,
    paper_name: nameMatch ? nameMatch[1].trim() : null,
    paper_id: null,
    paper_code: null,
    upc: upcMatch ? upcMatch[1].trim() : null,
    examination_session: session,
    session_id: session,
    year: yearMatch ? Number(yearMatch[1]) : null,
    semester: null,
    course: null,
    programme: null,
    paper_type: null,
    question_for: questionFor,
    marks,
    set,
    remarks,
    detail_url: detailUrl,
    pdf_url: pdfUrl,
    pdf_filename: pdfFilename,
    source_url: detailUrl,
    scraped_at: new Date().toISOString(),
  };
}

export function extractDetailId(detailUrl: string): string {
  return detailUrl.split("/").filter(Boolean).pop() ?? detailUrl;
}
