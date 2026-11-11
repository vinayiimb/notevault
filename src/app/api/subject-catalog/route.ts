import { getSubjectCatalog } from "@/lib/subject-catalog";

// Public DU syllabus data (already published as static JSON), reshaped compactly for the dashboard's subject picker.
export function GET() {
  return Response.json(getSubjectCatalog(), { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" } });
}
