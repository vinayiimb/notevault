import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardResourceView } from "@/lib/student";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  // Phase 2I: was unrated-limited despite writing to the database (the
  // downloads counter) on every single hit — 30/min per IP is well above
  // legitimate human download behavior.
  const rateLimit = checkRateLimit(`download:${clientIpFromHeaders(request.headers)}`, 30, 60);
  if (!rateLimit.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please try again shortly." },
      { status: 429, headers: { "Retry-After": String(rateLimit.retryAfterSeconds) } },
    );
  }

  const { resourceId } = await params;
  // Phase 2I: was an unscoped findUnique (full row, including the large
  // ocrText/rawOcrText @db.Text columns) just to read fileUrl for a
  // redirect — narrowed per the same pattern Phase 2A applied elsewhere.
  const resource = await prisma.resource.findUnique({ where: { id: resourceId }, select: { fileUrl: true } });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.resource.update({
    where: { id: resourceId },
    data: { downloads: { increment: 1 } },
  });
  await awardResourceView(resourceId);

  return NextResponse.redirect(new URL(resource.fileUrl, request.url));
}
