import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/**
 * GET /api/revalidate?path=/subjects/cmshji...&secret=...
 *
 * Purges the ISR cache for a given path so stale 404s (or stale content)
 * are regenerated on the next request.  Requires a shared secret to
 * prevent abuse.
 */
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const path = request.nextUrl.searchParams.get("path");

  if (secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
  }

  if (!path) {
    return NextResponse.json({ error: "Missing ?path= param" }, { status: 400 });
  }

  try {
    revalidatePath(path);
    return NextResponse.json({ revalidated: true, path, now: Date.now() });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to revalidate", detail: String(err) },
      { status: 500 }
    );
  }
}
