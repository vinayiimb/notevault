import { NextResponse, type NextRequest } from "next/server";
import { bookingOptions, FlightError, parseQuery, parseTrip, returnFlights, searchFlights, searchPlaces } from "@/lib/flights";

// /flights page backend. ?kind=places|search|returns|book — see src/lib/flights.ts.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams;
  const kind = q.get("kind") ?? "search";
  try {
    if (kind === "places") {
      return NextResponse.json(searchPlaces((q.get("term") ?? "").slice(0, 60)), { headers: { "Cache-Control": "public, max-age=86400" } });
    }
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
    const p = parseQuery(q);
    const token = (q.get("token") ?? "").slice(0, 4000);
    if (kind === "search") return NextResponse.json(await searchFlights(p, ip));
    if (!token) return NextResponse.json({ error: "Missing flight." }, { status: 400 });
    if (kind === "returns") return NextResponse.json(await returnFlights(p, token, ip));
    if (kind === "book") return NextResponse.json(await bookingOptions(p, token, ip));
    return NextResponse.json({ error: "Unknown request." }, { status: 400 });
  } catch (e) {
    if (e instanceof FlightError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("flights:", e);
    return NextResponse.json({ error: "Flight search is temporarily unavailable. Please try again." }, { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.get("kind") !== "parse") return NextResponse.json({ error: "Unknown request." }, { status: 400 });
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(await parseTrip(String(body?.q ?? "")));
  } catch (e) {
    if (e instanceof FlightError) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error("flights parse:", e);
    return NextResponse.json({ error: "Smart search is busy, please use the form." }, { status: 502 });
  }
}
