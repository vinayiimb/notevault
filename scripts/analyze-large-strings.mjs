import fs from "fs";
const handler = fs.readFileSync(".open-next/server-functions/default/handler.mjs", "utf8");

const matches = [];
let regex = /"[^"]{10000,}"/g;
let m;
while ((m = regex.exec(handler)) !== null) {
  matches.push(m[0]);
}

matches.sort((a, b) => b.length - a.length);

console.log("Top 10 largest strings:");
for (let i=0; i<Math.min(10, matches.length); i++) {
  console.log(`String ${i+1}: ${matches[i].length} bytes`);
  console.log(matches[i].substring(0, 100) + "...\n");
}
