import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { awardResourceView } from "@/lib/student";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ resourceId: string }> }
) {
  const { resourceId } = await params;
  const resource = await prisma.resource.findUnique({ where: { id: resourceId } });
  if (!resource) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.resource.update({
    where: { id: resourceId },
    data: { downloads: { increment: 1 } },
  });
  await awardResourceView(resourceId);

  return NextResponse.redirect(new URL(resource.fileUrl, _request.url));
}
