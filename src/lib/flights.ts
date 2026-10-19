import airportRows from "@/data/airports.json";

// Google Flights fares via SerpApi (server-only: the key stays here).
// FREE ONLY: SerpApi's free plan is 250 searches/month and stops at the limit, it never bills.
// Every uncached search, return-leg and booking lookup costs one, so results are cached and
// each visitor gets a small daily budget.

type Row = [code: string, name: string, city: string, cityCode: string, country: string];
const AIRPORTS = airportRows as Row[];
const BY_CODE = new Map(AIRPORTS.map((r) => [r[0], r]));
const BY_CITY = new Map<string, Row[]>();
for (const r of AIRPORTS) BY_CITY.set(r[3], [...(BY_CITY.get(r[3]) ?? []), r]);

// Same shape the original portal page expects: code is what the search sends ("@LON" = all London airports), short is what the traveller sees.
export type Place = { code: string; short: string; type: "city" | "airport"; name: string; city: string; country: string };

// Old / common names Indian travellers still type.
const ALIAS: Record<string, string> = { bangalore: "bengaluru", bombay: "mumbai", calcutta: "kolkata", madras: "chennai", poona: "pune", banaras: "varanasi", baroda: "vadodara", cochin: "kochi", trivandrum: "thiruvananthapuram", gurgaon: "delhi", noida: "delhi" };

export function searchPlaces(term: string): Place[] {
  const raw = term.trim().toLowerCase();
  const t = ALIAS[raw] ?? raw;
  if (t.length < 2) return [];
  const hits: { score: number; p: Place }[] = [];
  const score = (code: string, name: string, city: string) =>
    code.toLowerCase() === t ? 0.8 : city.toLowerCase().startsWith(t) ? 1 : name.toLowerCase().startsWith(t) ? 2 : city.toLowerCase().includes(t) ? 3 : name.toLowerCase().includes(t) ? 4 : 9;
  for (const [cityCode, rows] of BY_CITY) {
    const [, , city, , country] = rows[0];
    if (rows.length > 1) {
      const s = Math.min(score(cityCode, "", city), score(cityCode, "", cityCode));
      if (s < 9) hits.push({ score: s - 0.5, p: { code: "@" + cityCode, short: cityCode, type: "city", name: `${city} (all airports)`, city, country } });
    }
    for (const [code, name, c] of rows) {
      const s = score(code, name, c);
      if (s < 9) hits.push({ score: s, p: { code, short: code, type: "airport", name: name.toLowerCase().includes(c.toLowerCase()) ? name : `${c} · ${name}`, city: c, country } });
    }
  }
  return hits.sort((a, b) => a.score - b.score).slice(0, 8).map((h) => h.p);
}

/** Airport codes behind a picked place: "@LON" expands to all of London's airports, "LHR" is just itself. Null if unknown. */
export function airportsFor(code: string): string[] | null {
  if (code.startsWith("@")) return BY_CITY.get(code.slice(1))?.map((r) => r[0]) ?? null;
  return BY_CODE.has(code) ? [code] : null;
}

// ponytail: in-memory caches, fine for one Railway instance; entries are small mapped results, capped.
const cache = new Map<string, { until: number; value: unknown }>();
async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value as T;
  const value = await fn();
  cache.set(key, { value, until: Date.now() + ttlMs });
  if (cache.size > 150) cache.delete(cache.keys().next().value!);
  return value;
}

export class FlightError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

const PER_IP_DAY = 15;
const spend = new Map<string, number>();
function budget(ip: string) {
  const k = ip + new Date().toISOString().slice(0, 10);
  const n = (spend.get(k) ?? 0) + 1;
  if (spend.size > 5000) spend.clear();
  spend.set(k, n);
  if (n > PER_IP_DAY) throw new FlightError("You've hit today's flight search limit. Please try again tomorrow.", 429);
}

/** Stops before the free monthly quota is gone (the Account API call itself is free). */
async function quotaLeft(key: string) {
  const left = await cached("quota", 60e3, async () => {
    const j = await fetch(`https://serpapi.com/account?api_key=${key}`).then((r) => r.json()).catch(() => ({}));
    return typeof j.total_searches_left === "number" ? j.total_searches_left : 999;
  });
  if (left <= 3) throw new FlightError("Flight search is paused until next month's free quota resets.", 503);
}

async function serp(params: Record<string, string>, ip: string) {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new FlightError("Flight search isn't configured yet.", 503);
  await quotaLeft(key);
  budget(ip);
  const u = new URL("https://serpapi.com/search.json");
  u.search = new URLSearchParams({ engine: "google_flights", hl: "en", ...params, api_key: key }).toString();
  const j = await fetch(u, { signal: AbortSignal.timeout(60_000) }).then((r) => r.json()).catch(() => ({ error: "Bad response" }));
  if (j.error && !/hasn't returned any results/i.test(j.error)) throw new FlightError("Flight search is temporarily unavailable. Please try again.");
  return j;
}

const serpTime = (t?: string) => (t ? t.replace(" ", "T") : "");

export function mapSerp(o: any) {
  const seg: any[] = o.flights || [];
  const first = seg[0] || {};
  const last = seg[seg.length - 1] || {};
  return {
    price: o.price as number,
    airline: ((first.flight_number || "").split(" ")[0] || "") as string,
    airlineName: [...new Set(seg.map((x) => x.airline).filter(Boolean))].join(" + "),
    logo: (o.airline_logo || first.airline_logo || "") as string,
    flight: seg.map((x) => x.flight_number).join(", "),
    from: first.departure_airport?.id as string,
    to: last.arrival_airport?.id as string,
    departAt: serpTime(first.departure_airport?.time),
    arriveAt: serpTime(last.arrival_airport?.time),
    stops: Math.max(0, seg.length - 1),
    via: (o.layovers || []).map((l: any) => l.id).join(", "),
    minutes: o.total_duration as number,
    bookingToken: (o.booking_token || null) as string | null,
    departureToken: (o.departure_token || null) as string | null,
    segments: seg.map((x) => ({
      from: x.departure_airport?.id, fromName: x.departure_airport?.name, dep: serpTime(x.departure_airport?.time),
      to: x.arrival_airport?.id, toName: x.arrival_airport?.name, arr: serpTime(x.arrival_airport?.time),
      minutes: x.duration, airline: x.airline, logo: x.airline_logo, flight: x.flight_number, plane: x.airplane || "",
      cls: x.travel_class || "", legroom: x.legroom || "", delayed: !!x.often_delayed_by_over_30_min, overnight: !!x.overnight,
      perks: (x.extensions || []).filter((e: string) => !/^carbon emissions|legroom/i.test(e)),
    })),
    layovers: (o.layovers || []).map((l: any) => ({ minutes: l.duration, name: l.name, id: l.id, overnight: !!l.overnight })),
    co2: o.carbon_emissions?.this_flight ? { kg: Math.round(o.carbon_emissions.this_flight / 1000), diff: o.carbon_emissions.difference_percent ?? null } : null,
  };
}
export type Flight = ReturnType<typeof mapSerp> & { best?: boolean };

/**
 * Keeps only flights that really match the search: right airports, right day, a price,
 * a complete itinerary, Economy cabin. Duplicates (same flights, same time) collapse to the cheapest.
 */
export function cleanFlights(list: Flight[], from: string[], to: string[], day?: string): Flight[] {
  const seen = new Map<string, Flight>();
  for (const f of list) {
    const ok =
      f.price > 0 && f.segments.length > 0 && f.minutes > 0 && f.flight && f.departAt && f.arriveAt &&
      from.includes(f.from) && to.includes(f.to) && (!day || f.departAt.startsWith(day)) &&
      f.segments.every((s) => s.from && s.to && s.dep && s.arr && s.flight && (!s.cls || s.cls === "Economy")); // searches are Economy: Google also mixes Premium Economy fares in
    if (!ok) continue;
    const k = f.flight + f.departAt;
    const prev = seen.get(k);
    if (!prev || f.price < prev.price) seen.set(k, { ...f, best: f.best || prev?.best });
  }
  return [...seen.values()].sort((a, b) => a.price - b.price).slice(0, 60);
}

const flightsOf = (j: any, from: string[], to: string[], day?: string) =>
  cleanFlights([...(j.best_flights || []).map((o: any) => ({ ...mapSerp(o), best: true })), ...(j.other_flights || []).map(mapSerp)], from, to, day);

const MARKETS: Record<string, string> = { inr: "in", usd: "us", aed: "ae" };
export type Query = { origin: string; destination: string; depart: string; ret: string; direct: boolean; currency: string };
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function parseQuery(q: URLSearchParams): Query & { from: string[]; to: string[] } {
  const origin = q.get("origin") ?? "", destination = q.get("destination") ?? "";
  const depart = q.get("depart") ?? "", ret = q.get("return") ?? "";
  const from = airportsFor(origin), to = airportsFor(destination);
  if (!from || !to || origin === destination || !DAY.test(depart) || (ret && (!DAY.test(ret) || ret < depart)) || depart < new Date().toISOString().slice(0, 10)) {
    throw new FlightError("Pick a valid origin, destination and date.", 400);
  }
  const currency = MARKETS[q.get("currency") ?? ""] ? (q.get("currency") as string) : "inr";
  return { origin, destination, depart, ret, direct: q.get("direct") === "true", currency, from, to };
}

function base(p: Query & { from: string[]; to: string[] }) {
  const o: Record<string, string> = { departure_id: p.from.join(","), arrival_id: p.to.join(","), outbound_date: p.depart, type: p.ret ? "1" : "2", currency: p.currency.toUpperCase(), gl: MARKETS[p.currency] };
  if (p.ret) o.return_date = p.ret;
  if (p.direct) o.stops = "1";
  return o;
}

export async function searchFlights(p: ReturnType<typeof parseQuery>, ip: string) {
  const params = base(p);
  return cached("s:" + JSON.stringify(params), 3600e3, async () => {
    const j = await serp(params, ip);
    const pi = j.price_insights;
    return {
      currency: p.currency,
      calendar: {},
      roundTrip: !!p.ret,
      flights: flightsOf(j, p.from, p.to, p.depart),
      insights: pi ? { level: (pi.price_level as string) || null, low: pi.typical_price_range?.[0] ?? null, high: pi.typical_price_range?.[1] ?? null } : null,
    };
  });
}

/** Round trips: the return flights that go with a chosen outbound. */
export async function returnFlights(p: ReturnType<typeof parseQuery>, token: string, ip: string) {
  const params = { ...base(p), departure_token: token };
  return cached("r:" + JSON.stringify(params), 3600e3, async () => ({ currency: p.currency, flights: flightsOf(await serp(params, ip), p.to, p.from, p.ret) }));
}

export async function bookingOptions(p: ReturnType<typeof parseQuery>, token: string, ip: string) {
  const params = { ...base(p), booking_token: token };
  return cached("b:" + JSON.stringify(params), 600e3, async () => {
    const j = await serp(params, ip);
    const options = (j.booking_options || []).map((b: any) => {
      const o = b.together || b, req = o.booking_request;
      return { seller: o.book_with as string, airline: !!o.airline, price: (o.price ?? null) as number | null, title: (o.option_title || "") as string, perks: (o.extensions || []).slice(0, 3) as string[],
        url: (req?.url || null) as string | null, post: (req?.post_data || null) as string | null, phone: (o.booking_phone || null) as string | null, split: !!b.separate_tickets };
    }).filter((o: { price: number | null; url: string | null; phone: string | null }) => o.price && (o.url || o.phone));
    return { currency: p.currency, options: options.sort((a: { airline: boolean; price: number }, b: { airline: boolean; price: number }) => Number(b.airline) - Number(a.airline) || a.price - b.price) };
  });
}

// Free Groq models, tried in order; the next one is used when a model is rate-limited or retired.
const GROQ_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];

/** "cheapest Delhi to Dubai next Friday, non-stop" -> a structured search (free Groq only). */
export async function parseTrip(text: string) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new FlightError("Smart search isn't configured yet.", 503);
  const system = `Today is ${new Date().toISOString().slice(0, 10)}. Extract a flight search from the user's message. Reply with JSON only:
{"from":"city or airport name","to":"city or airport name","depart":"YYYY-MM-DD or YYYY-MM","return":"YYYY-MM-DD, YYYY-MM or null","direct":true|false}
Resolve relative dates ("next Friday", "in December") from today. Use null for anything not mentioned. Never invent prices.`;
  for (const model of GROQ_MODELS) {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, temperature: 0, response_format: { type: "json_object" }, messages: [{ role: "system", content: system }, { role: "user", content: text.slice(0, 500) }] }),
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!r || r.status === 429 || r.status === 404 || r.status === 400 || r.status >= 500) continue;
    if (!r.ok) break;
    const out = JSON.parse((await r.json()).choices[0].message.content);
    return { ...out, from: out.from ? searchPlaces(String(out.from))[0] ?? null : null, to: out.to ? searchPlaces(String(out.to))[0] ?? null : null };
  }
  throw new FlightError("Smart search is busy, please use the form.", 503);
}
