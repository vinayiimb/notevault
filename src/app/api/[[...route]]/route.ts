import { NextRequest, NextResponse } from "next/server";
import { GET as combinedPdfGET } from "../catalog-combined-pdf/_route-impl";
import { GET as downloadGET } from "../download/[resourceId]/_route-impl";
import { GET as searchSuggestionsGET } from "../search-suggestions/_route-impl";
import { GET as subjectDownloadAllGET } from "../subjects/[id]/download-all/_route-impl";
import { GET as practiceQuestionsGET } from "../practice-questions/_route-impl";
import { GET as pypGridGET } from "../pyp-grid/_route-impl";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ route?: string[] }> }
) {
  const params = await props.params;
  const route = params.route || [];

  if (route[0] === "catalog-combined-pdf") {
    return combinedPdfGET(request);
  }

  if (route[0] === "download" && route[1]) {
    return downloadGET(request, { params: Promise.resolve({ resourceId: route[1] }) });
  }

  if (route[0] === "search-suggestions") {
    return searchSuggestionsGET(request);
  }

  if (route[0] === "subjects" && route[1] && route[2] === "download-all") {
    return subjectDownloadAllGET(request, { params: Promise.resolve({ id: route[1] }) });
  }

  if (route[0] === "practice-questions") {
    return practiceQuestionsGET(request);
  }

  if (route[0] === "pyp-grid") {
    return pypGridGET(request);
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

