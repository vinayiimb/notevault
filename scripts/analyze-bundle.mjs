import fs from "fs";
const handler = fs.readFileSync(".open-next/server-functions/default/handler.mjs", "utf8");
console.log("Total length:", handler.length);

// Let's sample parts of it to see if there are giant strings/JSONs embedded.
const matches = handler.match(/".{10000,}"/g);
if (matches) {
  console.log("Found", matches.length, "giant strings!");
  for (let i=0; i<Math.min(5, matches.length); i++) {
    console.log("String", i, "length:", matches[i].length, "starts with:", matches[i].substring(0, 50));
  }
} else {
  console.log("No giant strings found.");
}
