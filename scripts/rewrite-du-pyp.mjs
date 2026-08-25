import fs from "fs";

let code = fs.readFileSync("src/lib/du-pyp-data.ts", "utf8");

code = code.replace(
  /import rawRamanujan from "@\/data\/ramanujan-pyq-catalog\.json";\n/,
  `// JSON removed for async loading\n`
);

code = code.replace(
  /const ramRows = \(rawRamanujan as any\[\]\) \|\| \[\];/,
  `const ramRows = (await (async () => {
    const isCloudflare = typeof caches !== 'undefined' || (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers');
    if (isCloudflare) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dupyq.online';
      return await fetch(baseUrl + '/data/ramanujan-pyq-catalog.json').then(r => r.json());
    } else {
      const fsMod = eval("require('fs')");
      const pathMod = eval("require('path')");
      return JSON.parse(fsMod.readFileSync(pathMod.join(process.cwd(), 'public/data', 'ramanujan-pyq-catalog.json'), 'utf8'));
    }
  })()) || [];`
);

code = code.replace(
  /return rows\.length \+ \(rawRamanujan as any\[\]\)\.length;/,
  `const ramRows = (await (async () => {
    const isCloudflare = typeof caches !== 'undefined' || (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers');
    if (isCloudflare) {
      const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dupyq.online';
      return await fetch(baseUrl + '/data/ramanujan-pyq-catalog.json').then(r => r.json());
    } else {
      const fsMod = eval("require('fs')");
      const pathMod = eval("require('path')");
      return JSON.parse(fsMod.readFileSync(pathMod.join(process.cwd(), 'public/data', 'ramanujan-pyq-catalog.json'), 'utf8'));
    }
  })()) || [];
  return rows.length + ramRows.length;`
);


fs.writeFileSync("src/lib/du-pyp-data.ts", code);
