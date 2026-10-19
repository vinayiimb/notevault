import { test } from "node:test";
import assert from "node:assert/strict";
import { airportsFor, cleanFlights, mapSerp, parseQuery, searchPlaces } from "@/lib/flights";

const seg = (from: string, to: string, dep: string, arr: string, no: string) => ({
  departure_airport: { id: from, name: from, time: dep }, arrival_airport: { id: to, name: to, time: arr }, airline: "X", flight_number: no, duration: 100,
});
const f = (price: number, from: string, to: string, dep: string, no = "AI 1", extra = {}) =>
  mapSerp({ flights: [seg(from, to, dep, dep.replace(/\d\d:\d\d$/, "23:00"), no)], total_duration: 100, price, ...extra });

test("places: city search expands to all airports, junk fuzzy matches are gone", () => {
  assert.equal(searchPlaces("london")[0].code, "@LON");
  assert.deepEqual(airportsFor("@LON")?.includes("LHR"), true);
  assert.deepEqual(airportsFor("DEL"), ["DEL"]);
  assert.equal(airportsFor("ZZZ"), null);
  assert.equal(searchPlaces("new york").some((p) => p.code === "INF"), false);
});

test("cleanFlights drops wrong airport, wrong day, no price, and collapses duplicates", () => {
  const out = cleanFlights(
    [
      f(5000, "DEL", "BOM", "2099-01-05 08:00", "AI 1"),
      f(4000, "DEL", "BOM", "2099-01-05 08:00", "AI 1"), // duplicate, cheaper wins
      f(3000, "DEL", "GOI", "2099-01-05 09:00", "AI 2"), // wrong destination
      f(3000, "DEL", "BOM", "2099-01-06 09:00", "AI 3"), // wrong day
      f(0, "DEL", "BOM", "2099-01-05 10:00", "AI 4"), // no price
      mapSerp({ flights: [{ ...seg("DEL", "BOM", "2099-01-05 11:00", "2099-01-05 13:00", "AI 5"), travel_class: "Premium Economy" }], total_duration: 100, price: 9000 }), // other cabin
    ],
    ["DEL"], ["BOM"], "2099-01-05",
  );
  assert.deepEqual(out.map((x) => [x.flight, x.price]), [["AI 1", 4000]]);
});

test("parseQuery rejects past dates, same airport and unknown codes", () => {
  const q = (s: string) => () => parseQuery(new URLSearchParams(s));
  assert.throws(q("origin=DEL&destination=BOM&depart=2020-01-01"));
  assert.throws(q("origin=DEL&destination=DEL&depart=2099-01-01"));
  assert.throws(q("origin=DEL&destination=ZZZ&depart=2099-01-01"));
  assert.equal(parseQuery(new URLSearchParams("origin=DEL&destination=%40LON&depart=2099-01-01")).to.length > 1, true);
});
