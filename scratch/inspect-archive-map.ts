import fs from "fs";

async function main() {
  console.log("Reading archive-official-map.json...");
  const mapData = JSON.parse(fs.readFileSync("src/data/archive-official-map.json", "utf8"));
  console.log("Total entries in map:", mapData.length);
  console.log("Sample entries (first 5):", JSON.stringify(mapData.slice(0, 5), null, 2));

  // Let's see unique matchStatus values
  const statuses = {};
  for (const item of mapData) {
    statuses[item.matchStatus] = (statuses[item.matchStatus] || 0) + 1;
  }
  console.log("Match statuses:", statuses);
}

main().catch(console.error);
