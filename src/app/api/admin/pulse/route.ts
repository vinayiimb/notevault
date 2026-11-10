import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Admin-only poll for the notification bell: leads / paid orders created after `since`.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await getSession())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("since");
  const since = raw ? new Date(raw) : new Date();
  if (Number.isNaN(since.getTime())) return NextResponse.json({ error: "bad since" }, { status: 400 });

  const [leads, orders] = await Promise.all([
    prisma.noteLead
      .findMany({ where: { createdAt: { gt: since } }, orderBy: { createdAt: "asc" }, take: 20, select: { id: true, phone: true, subject: true, programme: true, createdAt: true } })
      .catch(() => []),
    prisma.notesOrder
      .findMany({ where: { paidAt: { gt: since } }, orderBy: { paidAt: "asc" }, take: 20, select: { id: true, phone: true, subject: true, amount: true, paidAt: true } })
      .catch(() => []),
  ]);
  return NextResponse.json({ leads, orders, now: new Date().toISOString() });
}
