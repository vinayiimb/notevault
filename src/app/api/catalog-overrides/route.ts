import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const overrides = await prisma.catalogSubjectOverride.findMany({
      select: {
        course: true,
        subjectKey: true,
        displayName: true,
        semesterOverride: true,
        highlight: true,
      }
    });
    return NextResponse.json(overrides);
  } catch (err) {
    console.error("Failed to fetch overrides:", err);
    return NextResponse.json([]);
  }
}
