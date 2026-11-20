# Million First Steps — website

The website for **Million First Steps · Georgia Travel Experiences**: private and custom trips in Georgia, in nine languages (English, Russian, Georgian, Spanish, French, Italian, Portuguese, German and Chinese), with seven tours in three travel styles, a history of Georgia, a travel guide and request forms that email you.

It builds to plain HTML/CSS/JS with **no framework**, so it can be hosted anywhere. The forms need PHP (Hostinger has it); without PHP they open the visitor's email app instead.

## Run it

```bash
cd million-first-steps
npm install        # once
npm run build      # builds dist/
npm run dev        # builds and serves dist/ at http://localhost:8080 (forms fall back to email there)
php -S localhost:8080 -t dist   # alternative that also runs send.php, if PHP is installed
```

Node 18 or newer.

## How it's put together

The design came as finished HTML pages. Their page bodies live in **`src/design/`** and stay as the designer made them; the build fills them with our content and wraps them in the shared header, footer and `<head>`:

| Where | What |
|---|---|
| `src/config.mjs` | **Edit first:** email, phone, WhatsApp/Telegram/Signal/Instagram/Facebook, address, office hours, company name and code, form recipient, domain |
| `src/data/tours.mjs`, `tiers.mjs` | Tours, itineraries, prices per travel style, what each style includes |
| `src/data/tour-cards.mjs` | Each tour's photo, route line and seasons on the cards |
| `src/data/history.mjs` | Which tour each history era links to |
| `src/data/guide.mjs` | Travel guide articles |
| `src/pages/*.mjs` | How each page fills the design (e.g. `home.mjs` swaps in our tours and FAQ answers) |
| `src/design/*.html` | The designer's page bodies; `_header.html`, `_footer.html` |
| `src/assets/css/site.css` | The design's styles (unchanged); `extra.css` adds tour pages, articles, legal pages, fonts |
| `src/assets/js/*.js` | The design's scripts, one file per page plus `site.js` (menu, languages, sending forms) and `request.js` (dates, travellers, phone codes) |
| `src/root/send.php`, `.htaccess` | Form emailer and server settings, copied to the site root |
| `src/i18n/<lang>.json` | Translations (English text → translation) |

Pages: home, tours, seven tour pages, Discover Georgia (history), travel guide with ten articles, about, contact, travel partners, privacy, booking terms, cookies, credits and 404 — each in every language under `/<lang>/`.

## Languages

The site is written in English; the build translates the finished pages with `src/i18n/<lang>.json`. Visitors land on their browser's language automatically, and their choice from the language menu is remembered.

After changing any text, run `npm run build` (it lists every string in `src/i18n/_strings.json` and reports how much of each language is translated), then `npm run i18n:check` to see what's missing or broken. Text inside scripts is marked as `T("…")` (or `P("{n} …")` for plurals) and is translated the same way.

## Forms (Hostinger)

All forms — the trip request on the home page, the contact form and the partner inquiry — post to `send.php`, which emails them to `formTo` in `src/config.mjs` (or `email` if that's empty), with the visitor's address as *Reply-To*.

- Spam protection: a hidden field bots fill in, a minimum time on the page, at most six messages per visitor per hour, and same-site requests only. For heavy spam, add Cloudflare Turnstile later.
- Emails are sent from `no-reply@<your domain>`. On Hostinger, create that mailbox (or an email account on the domain) so messages aren't marked as spam, and check the spam folder after your first test.
- If PHP or mail isn't available, the visitor's email app opens with the request filled in, so nothing is lost.

## Before you launch — checklist

1. **`src/config.mjs`** — real email, phone and messengers, legal company name and identification code, and `siteUrl` once you have a domain (turns on canonical links, hreflang and `sitemap.xml`).
2. **Photos** — the design's photos are temporary. Those from Pexels are fine; the others came from Wikimedia Commons and need their authors credited on `credits.html` (see `CONTENT-SOURCES.md`) or replacing with your own. The hero video's source should be confirmed too.
3. **About** — team names come from the design; add roles and photos (the illustrated faces are placeholders).
4. **Prices** — check the per-tour prices in `src/data/tours.mjs`.
5. **Translations** — have a native speaker read each language, especially the legal pages.
6. **Legal** — have a lawyer finalise the booking terms; register with the Georgian National Tourism Administration.

## Deploying

- **Hostinger (or any Apache/LiteSpeed host with PHP):** run `npm run build`, zip the *contents* of `dist/`, upload the zip to `public_html` in hPanel's File Manager and extract it there. The included `.htaccess` sets up the 404 page, redirects from the first version's pages, compression and caching. Turn on *Force HTTPS* in hPanel.
- **Netlify / Cloudflare Pages / Vercel:** root directory `million-first-steps`, build command `npm run build`, output `dist`. These don't run PHP, so forms open the visitor's email app.

## Privacy & performance

- No cookies, no analytics, no third-party requests: fonts and scripts are self-hosted, and the contact page's map is drawn, not loaded from a map service.
- Visitors who ask for reduced motion get still images instead of the video and scroll effects.
