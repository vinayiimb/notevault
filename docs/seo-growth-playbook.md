# DU PYQ — growth playbook (things code can't do for you)

## 1. Google Search Console (once, ~10 min)
1. Add property `https://www.dupyq.online` (URL-prefix), verify via DNS or HTML tag.
2. Sitemaps → submit `https://www.dupyq.online/sitemap.xml` (index; it lists every shard).
3. URL Inspection → "Request indexing" for: `/`, `/previous-year-papers`, `/papers/bcom-hons`, `/value-addition-courses`, `/skill-enhancement-courses`, `/papers/bcom-hons/semester-1`. (Google limits this to ~10/day; the rest is found via the sitemap.)
4. Check weekly: Pages → "Crawled – currently not indexed" (thin pages), Performance → Queries (what students actually search; write blog posts for the top ones).
5. Also submit the same sitemap in Bing Webmaster Tools (feeds ChatGPT Search + Copilot).

## 2. Telegram bot (~5 min)
1. @BotFather → `/newbot` → copy the token.
2. Railway → production variables: `TELEGRAM_BOT_TOKEN=<token>`, `TELEGRAM_WEBHOOK_SECRET=<any long random string>`. Redeploy.
3. Register the webhook once (replace both values):
   `curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://www.dupyq.online/api/telegram&secret_token=<SECRET>"`
4. Test: message the bot `/pyq bcom sem1`. It replies with site links only (never PDFs), so every use is a visit.
5. Put the bot link in the footer / class WhatsApp groups. Without the two env vars the endpoint returns 404.

## 3. Reddit (r/delhiuniversity) — exam months: Apr–May, Oct–Dec
Rules that keep you un-banned: answer an actual request, link the *specific* page, disclose it's your site, max ~1 link post/day, never paste the homepage.

Reply template (someone asks for a paper):
> Here are all the {Subject} papers for {Course} (2019–2025, by year, original PDFs, no login): {subject page URL}. I run the site — if a paper is missing tell me and I'll add it.

Post template (once per exam season):
> DU {Course} Sem {N} PYQs — all subjects in one page: {semester page URL}. SEC/VAC/GE papers for every course: {hub URL}. Free, no login. Tell me what's missing.

Also: Quora answers to "where to download DU PYQ" (same specific-link rule), and 1 WhatsApp share per semester page into your own class groups — the share buttons on every page pre-fill "Got the DU {Subject} PYQs here: {url}".

## 4. Not built, on purpose
- **PDF watermarking:** the PDFs live on DU's own server (`qb.exam.du.ac.in`) and Drive; stamping them means downloading, rewriting and re-hosting official documents (storage + bandwidth on the Hobby plan, plus copyright optics). Revisit only if you start hosting your own scans (e.g. the notes PDFs) — then `pdf-lib` on upload is ~20 lines.
