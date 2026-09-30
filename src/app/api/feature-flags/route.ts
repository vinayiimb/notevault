import { NextResponse } from "next/server";
import { getFeatureFlags } from "@/lib/feature-flags-server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getFeatureFlags());
}
