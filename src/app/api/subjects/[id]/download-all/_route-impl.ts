import { NextRequest, NextResponse } from "next/server";
// JSZip removed for Cloudflare bundle size
import { prisma } from "@/lib/prisma";
import { readBytesFromUrl } from "@/lib/storage";

// Bundles everything available for a subject — compiled notes plus every
// uploaded notes/PYQ file — into a single ZIP. Built server-side so it can
// read R2 objects directly (readBytesFromUrl) without hitting browser CORS,
// and so a slow/partial fetch never leaves the client stuck reconstructing
// a zip from a torn download.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return NextResponse.json({ error: "Download all disabled on Cloudflare Workers due to size limits" }, { status: 400 });
}
