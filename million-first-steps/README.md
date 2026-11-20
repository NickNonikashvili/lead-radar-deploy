# Million First Steps — website

The website for **Million First Steps · Georgia Travel Experiences**: private and custom trips in Georgia, in nine languages (English, Russian, Georgian, Spanish, French, Italian, Portuguese, German and Chinese), with seven tours in three travel styles, a history of Georgia, a travel guide and request forms that email you.

It builds to plain HTML/CSS/JS with **no framework**, so it can be hosted anywhere. The forms need PHP (Hostinger has it); without PHP they open the visitor's email app instead.

## Run it

```bash
cd million-first-steps
npm install        # once
npm run build      # builds dist/
npm run dev        # builds and serves dist/ at http://localhost:8080 (forms fall back to email there)
php -S localhost:8080 -t dist scripts/router.php   # alternative that also runs the forms and the admin panel (needs PHP with pdo_sqlite)
```

Build options (environment variables):

- `MFS_OUT=<folder>` builds somewhere other than `dist/` (`node scripts/serve.mjs <folder>` serves it).
- `MFS_HTML_LINKS=1` writes links as `about.html` instead of `/about`, for a preview opened without a server (it also leaves out loading the admin's settings and the visit counter, which need the server).
- `MFS_SETUP_KEY=<key>` chooses the admin setup key instead of a random one.

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
| `src/root/admin/` | The admin panel (PHP + SQLite), copied to `/admin/` |
| `src/root/api/hit.php` | The cookieless visit counter behind the admin statistics |
| `src/lib/urls.mjs` | The clean addresses (`/about`, `/tours/`, `/tours/<id>`, `/guide/<slug>`) |
| `src/i18n/<lang>.json` | Translations (English text → translation) |

Pages: home, tours, seven tour pages, Discover Georgia (history), travel guide with ten articles, about, contact, travel partners, privacy, booking terms, cookies, credits and 404 — each in every language under `/<lang>/` (an unknown address under `/ru/` gets the Russian 404 page).

Addresses have no `.html`: `/`, `/about`, `/tours/`, `/tours/cradle-of-wine`, `/guide/`, `/guide/<article>`, `/ru/about` and so on. The files are still `about.html`, `tours/index.html` etc.; `.htaccess` serves them at the clean address and permanently redirects old links (`/index.html`, `/about.html`, `/tours.html`, `/travel-guide.html`, the first version's pages) to the new ones.

## Languages

The site is written in English; the build translates the finished pages with `src/i18n/<lang>.json`. Visitors who open an English address are taken to their browser's language (or the one they picked before), and their choice from the language menu is remembered. An address in another language (`/ru/about`, from a link or a search result) always stays in that language, and search engines are never redirected, so each language is found at its own address.

After changing any text, run `npm run build` (it lists every string in `src/i18n/_strings.json` and reports how much of each language is translated), then `npm run i18n:check` to see what's missing or broken. Text inside scripts is marked as `T("…")` (or `P("{n} …")` for plurals) and is translated the same way.

## Forms (Hostinger)

All forms — the trip request on the home page, the contact form and the partner inquiry — post to `send.php`, which emails them to `formTo` in `src/config.mjs` (or `email` if that's empty), with the visitor's address as *Reply-To*.

- Spam protection: a hidden field bots fill in, a minimum time on the page, at most six messages per visitor per hour, and same-site requests only. For heavy spam, add Cloudflare Turnstile later.
- Emails are sent from `no-reply@<your domain>`. On Hostinger, create that mailbox (or an email account on the domain) so messages aren't marked as spam, and check the spam folder after your first test.
- If PHP or mail isn't available, the visitor's email app opens with the request filled in, so nothing is lost.
- Every request is also saved in the admin panel. If saving fails the email still goes out, and if the email fails the request is still saved.

## Admin panel

`https://<your domain>/admin/` — for the team only. It has:

- **Dashboard:** what needs attention today: new requests, follow-ups that are due, payments due or overdue, upcoming trips. It also shows this year's figures.
- **Requests:** every form sent from the website, with status, notes, follow-up dates and assignment. One tap replies by email, WhatsApp or phone.
- **Bookings:** each booking has its payments (deposit, balance, refunds) and notes. There is also a calendar of trips.
- **Statistics:** visits, pages, where visitors came from, languages and devices. Counted without cookies; see *Privacy* below.
- **Tours & prices, Settings:** change prices, hide a tour, edit contact details and messengers, or show a notice bar on the website. These apply straight away with no rebuild: the admin writes `api/live.json` and the website reads it.
- **Team:** owner and staff accounts. Staff can't change prices, settings or the team. There is also an activity log of who changed what, CSV exports and a database backup download.
- **Languages:** English and Georgian (each person picks theirs).

**First sign-in.** `npm run build` prints `Admin setup key: XXXXXXXXXXXX` (it is also in `dist/admin/lib/setup-key.php`). After uploading, open `/admin/`, enter the key and create the first owner account. Setup closes for good once an account exists. Forgotten passwords are reset by email.

**Where the data lives.** The database (`mfs.sqlite`) goes in a `mfs-data` folder *next to* `public_html`, outside the website, so it can't be downloaded. Only if that folder can't be created does it fall back to `public_html/admin/data/`, which `.htaccess` blocks. Re-uploading the website never touches the data. Download a backup now and then from *Settings*.

Needs PHP 7.4+ with the `pdo_sqlite` extension (Hostinger has it).

For testing, `php scripts/admin-seed.php <data folder> --users` fills a database with demo requests, bookings and statistics, and adds the users owner@example.com and staff@example.com with the password `demo-password-2026`. Never run it on the live site.

## Before you launch — checklist

1. **`src/config.mjs`** — real email, phone and messengers, legal company name and identification code, and `siteUrl` once you have a domain (turns on canonical links, hreflang, `sitemap.xml` and the share image for WhatsApp and Facebook link previews; the build warns while it's empty).
2. **Photos** — the design's photos are temporary. Those from Pexels are fine; the others came from Wikimedia Commons and need their authors credited on the Credits page (`/credits`) (see `CONTENT-SOURCES.md`) or replacing with your own. The hero video's source should be confirmed too.
3. **About** — team names come from the design; add roles and photos (the illustrated faces are placeholders).
4. **Prices** — check the per-tour prices in `src/data/tours.mjs`.
5. **Translations** — have a native speaker read each language, especially the legal pages.
6. **Legal** — have a lawyer finalise the booking terms; register with the Georgian National Tourism Administration.

## Deploying

- **Hostinger (or any Apache/LiteSpeed host with PHP):** run `npm run build`, zip the *contents* of `dist/` (including the hidden `.htaccess` files), upload the zip to `public_html` in hPanel's File Manager and extract it there. The included `.htaccess` sets up clean addresses, the 404 page, redirects from old addresses, compression, caching, and blocks the admin's private files. Turn on *Force HTTPS* in hPanel. When you upload a new version later, keep `api/live.json`: it holds the prices and settings changed in the admin. The build never includes that file, so extracting over the old site leaves it alone.
- **Netlify / Cloudflare Pages / Vercel:** root directory `million-first-steps`, build command `npm run build`, output `dist`. These don't run PHP, so there is no admin panel or statistics, and forms open the visitor's email app.

## Privacy & performance

- No cookies for visitors, no third-party analytics, no third-party requests: fonts and scripts are self-hosted, and the contact page's map is drawn, not loaded from a map service. The only cookie is the team's sign-in cookie, and only under `/admin/`.
- The admin statistics come from our own counter (`api/hit.php`). It counts pages, referring sites, languages and device types without cookies. It never stores IP addresses: unique visitors are counted with a hash salted afresh each day. It skips visitors whose browser sends Do Not Track or Global Privacy Control, and anyone who has used the admin panel on that browser.
- Visitors who ask for reduced motion get still images instead of the video and scroll effects.
