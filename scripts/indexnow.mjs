// Push every sitemap URL to IndexNow (Bing → ChatGPT search/Copilot, Yandex, Seznam, Naver).
// Run after a deploy is live: node scripts/indexnow.mjs   (DRY=1 to only count)
const SITE = "https://www.dupyq.online";
const KEY = "c056ae2338ffe0517b99c36b7cd69272"; // must match public/c056ae2338ffe0517b99c36b7cd69272.txt

const locs = async (url) => [...(await (await fetch(url)).text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const urls = [];
for (const sm of await locs(`${SITE}/sitemap.xml`)) urls.push(...(await locs(sm)));
urls.push(`${SITE}/llms.txt`, `${SITE}/llms-full.txt`);
console.log(`${urls.length} URLs`);
if (process.env.DRY) process.exit(0);

for (let i = 0; i < urls.length; i += 10000) {
  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: new URL(SITE).host, key: KEY, keyLocation: `${SITE}/${KEY}.txt`, urlList: urls.slice(i, i + 10000) }),
  });
  console.log(`batch ${i / 10000 + 1}: HTTP ${res.status} ${await res.text()}`);
}
