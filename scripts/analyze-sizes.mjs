import fs from "fs";
const p = fs.readFileSync(".open-next/server-functions/default/handler.mjs", "utf8");
console.log("handler.mjs length:", p.length);
