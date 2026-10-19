// One-off: trims Travelpayouts' public airport/city/country lists into src/data/airports.json
// as [code, airport name, city name, city code, country]. Run: node scripts/build-airports.mjs
import { writeFileSync } from "node:fs";
const get = (n) => fetch(`https://api.travelpayouts.com/data/en/${n}.json`).then((r) => r.json());
const [airports, cities, countries] = await Promise.all([get("airports"), get("cities"), get("countries")]);
const city = Object.fromEntries(cities.map((c) => [c.code, c.name_translations?.en || c.name]));
const country = Object.fromEntries(countries.map((c) => [c.code, c.name_translations?.en || c.name]));
const rows = airports
  .filter((a) => a.flightable && a.iata_type === "airport" && /^[A-Z]{3}$/.test(a.code))
  .map((a) => [a.code, a.name_translations?.en || a.name, city[a.city_code] || a.city_code, a.city_code, country[a.country_code] || a.country_code]);
writeFileSync(new URL("../src/data/airports.json", import.meta.url), JSON.stringify(rows));
console.log(rows.length, "airports");
