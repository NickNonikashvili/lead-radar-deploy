# EvoSoft website

The evosoft.solutions website: portfolio, live demos with every test account, services, a "Get a quote" form and a
chat assistant that knows the whole site. © 2026 EvoSoft Solutions. All rights reserved.

```
evosoft-site/     the finished website (what goes on the server)
  api/            chat assistant (chat.php) and quote form (quote.php), PHP 8.2+
site-builder/     where you edit it: data files, page templates, build scripts (not uploaded)
demos/            how to host each live demo (one folder per product)
```

## Publish it (Hostinger or any PHP host)

```bash
node site-builder/package.mjs        # builds and makes dist/evosoft-site-YYYYMMDD.zip
```

1. In hPanel → File Manager, open `public_html`, upload the zip and **Extract** it there (replace the old files).
   The zip includes the hidden `.htaccess` files (in the main folder, `api/`, `es/`, `admin/`, `admin/inc/` and
   `admin/assets/`; the clean addresses and the admin panel's protection need all of them) and the PHP libraries for
   the chat and for sending email. `package.mjs` stops if one of them is missing.
2. Add your settings file (next section) with the password of the `contact@evosoft.solutions` mailbox, so the quote
   form can send email. Without it the site still works: the chat uses its built-in answers, and quote requests are
   saved on the server, but their emails may never arrive.
3. Open `https://evosoft.solutions/api/chat.php?health=1`. `{"ok":true,"ai":true}` means the assistant is using Claude.
4. Send yourself a test through the quote form, then open `https://evosoft.solutions/api/quote.php?health=1`.
   `"mail":"smtp","last_send":"ok"` means email works.
5. In Google Search Console, add the site and submit `https://evosoft.solutions/sitemap.xml`.

**Addresses.** Pages have clean addresses: the home page is `/home`, the others `/services`, `/contact`,
`/work/evo`, and the Spanish version has its own (`/es/home`, `/es/work/evo`). The files on the server keep
their `.html` names; the `.htaccess` files (the main one, and one in the `es/` folder, written by the build) serve
the files at the clean addresses. Every old address still works, with a permanent redirect to the new one, keeping
any `?…` on the end:

| Old | New |
| --- | --- |
| `/`, `/index.html` and `/index` | `/home` (and `/es/` → `/es/home`) |
| `/ka/…`, `/ru/…` (the Georgian and Russian versions, now removed) | the same page in English |
| `/services.html`, `/work/evo.html` | `/services`, `/work/evo` |
| `/services/` | `/services` |
| `/pricing.html`, `/pricing` | `/estimate` (the website price estimate) |
| `/admin` | `/admin/` (the private admin panel, see below) |
| `/work` | `/portfolio` |

This needs the host's rewrite module (`mod_rewrite`), which Hostinger has.

## Settings: chat assistant and quote form

Copy `evosoft-site/api/config.example.php` to **`evosoft-config.php` next to `public_html`** (on Hostinger:
`/home/<user>/domains/evosoft.solutions/evosoft-config.php`), so it can never be downloaded. `api/config.php` also
works; `api/.htaccess` blocks it from the web. You only need the lines you change. For the quote form, this is enough:

```php
<?php
return [
    'smtp_user' => 'contact@evosoft.solutions',
    'smtp_pass' => 'the password of that mailbox',
];
```

| Setting | What it does |
|---|---|
| `anthropic_api_key` | Turns on the AI assistant. Create a key at console.anthropic.com → API keys. |
| `chat_model` | `claude-opus-5-5` by default (Anthropic's current default). `claude-haiku-5-5` costs far less per message, if you want to save. |
| `chat_per_ip_10min`, `chat_per_ip_day`, `chat_global_day` | Limits per visitor and a daily ceiling for the whole site, so spending can't run away. |
| `quote_to` | Where quote requests are emailed (default contact@evosoft.solutions). |
| `smtp_user`, `smtp_pass` | The mailbox the quote form signs in to and sends from, and its password. With Hostinger email: the full address and the password you use for webmail (hPanel → Emails → Email accounts can change it). |
| `smtp_host`, `smtp_port` | `smtp.hostinger.com` and `465` by default. With another email provider, change them to theirs. |
| `mail_from` | Only used without `smtp_pass`, when the form falls back to PHP's `mail()`: the sender, which must be a real mailbox on your domain (default: `quote_to`). |

Environment variables (`ANTHROPIC_API_KEY`, `EVOSOFT_CHAT_MODEL`, `EVOSOFT_QUOTE_TO`, `EVOSOFT_MAIL_FROM`,
`EVOSOFT_SMTP_HOST`, `EVOSOFT_SMTP_PORT`, `EVOSOFT_SMTP_USER`, `EVOSOFT_SMTP_PASS`) override the file.

### Website price estimate (`/estimate`)

Visitors pick what they need (kind of site, business, look, pages, features, content help, timeline, care plan), see a
live preview of their site and a price range in US dollars, and can send it as a request. The main "Get a quote"
buttons open it; `/contact` stays for anything that isn't a website.

- **Prices** are all in `site-builder/data/pricing.mjs`, with the rules written out at the top. They are starter
  prices: change them to yours and rebuild. The page shows a range (90% to 115% of the total), the monthly care plan and
  a rough number of weeks, and says it is an estimate, not an offer.
- **The server recomputes every estimate** from `api/pricing.json` (written by the build; the web can't read it), so
  the email and the admin panel never trust the visitor's browser. The rules exist twice, in
  `assets/js/estimate.js` (`estimate()`) and `api/lib.php` (`evo_estimate()`); if you change a rule, change both.
- **The preview** is `assets/js/site-preview.js` + `assets/css/preview.css`: 12 industries, 3 layouts, 7 colour schemes,
  light and dark, desktop/tablet/phone. Its sample text is translated like the rest of the site. It never shows invented
  reviews or ratings.
- **Nothing is stored in the browser**: the design lives in the page address after `#`, so "Copy a link to this design"
  shares it.
- Some descriptions are promises about what you deliver (the care plans: "Updates, backups and a monthly check-up"…;
  the logo and stock photos). They are in `build.mjs` (`estimatePage()`, `CARE_INFO`): make sure they match what you sell.

### Admin panel (`/admin/`)

Every quote request, from the estimate and the contact form, with its design, the live preview, the server's
estimate, a status (new, contacted, quoted, won, lost) and your own notes. You can reply by email, delete a request
(for example when someone asks you to) and export the list as CSV. The client finder is there too (below).

1. Open `https://evosoft.solutions/admin/`. The first time, it asks you to choose a password and shows a line like
   `'admin_password_hash' => '$2y$…',`. Paste it into `evosoft-config.php` (see Settings) and reload: the panel then asks
   for that password. The page never saves anything itself, so nobody else can set it up before you.
2. Strongly recommended: once signed in, open **Security** and add an authenticator app (Google Authenticator,
   1Password, …). It shows a secret to add to the app and the `'admin_totp_secret' => '…'` line for the settings file.
3. The panel only opens over https. Sessions end after 30 idle minutes (`admin_session_minutes`) and 12 hours at most.
   Sign-in attempts are limited (5 per 15 minutes per address, 30 overall); a browser you've signed in from before keeps
   its own 10 attempts, so a flood of wrong passwords from elsewhere can't lock you out. Changing the password or the
   authenticator secret forgets every remembered browser.

The panel's pages are never indexed (`X-Robots-Tag: noindex`); it is deliberately not listed in `robots.txt`, which would
only advertise it. Status and notes are kept in `evosoft-data/quote-meta.json` and deleted with the request.

| Setting | What it does |
|---|---|
| `admin_password_hash` | Your admin password, as the hash the setup page shows. Empty = panel locked (setup page only). |
| `admin_totp_secret` | Optional authenticator app secret (base32). Set = a 6-digit code is needed at sign-in too. |
| `admin_session_minutes` | Idle time before signing out (default 30). |
| `admin_require_https` | `true` by default; only set `false` for local testing. |

### Client finder (`/admin/?view=finder`)

Finds businesses that may need a website, keeps them as leads and helps you write a first email. Owner only, inside the
admin panel. It never sends anything by itself.

- **Local businesses:** pick a niche (dentists, restaurants, hotels, salons, lawyers, …) and a city.
  - OpenStreetMap lists the businesses there that have no website on the map. It goes through the public Overpass
    service only (about 80 searches and 10 MB a day, cached for 24 hours, credited "© OpenStreetMap contributors").
  - AI web search (Claude, with your `anthropic_api_key`) finds ones with no site, only a social page, or a weak site.
  - Tick the ones you want and save them as leads.
- **Leads:** status (new, contacted, replied, won, lost, not interested), notes and CSV export, plus three actions:
  - **Research:** the AI checks the business's website and public contacts, and gives a fit score with a suggested
    pitch.
  - **Draft email:** a short personal first email in English, Georgian or Russian. It always ends with where you found
    their details and an easy opt-out; the panel adds those lines itself if the AI leaves them out. You edit it and send
    it from your own mail app.
  - **Do not contact:** deletes the business and keeps only scrambled identifiers (name and city, domain, email, phone,
    social pages, map id), so later searches never bring it back.
- **Upwork:** searches new "need a website" job posts through Upwork's official API, only when you press Search.
  Reply to those clients on Upwork: moving them off Upwork before a contract is against its terms. Upwork content is
  reused for an hour and deleted within 24 hours by the daily clean-up; "Track" keeps only the job link, your note and
  the date. Setting it up:
  - Apply for an API key at https://www.upwork.com/developer/keys/apply with your agency selected. Upwork requires
    $25,000 in lifetime earnings or spend, a 90%+ Job Success Score and identity verification; approval takes about a
    week.
  - Choose key type OAuth 2.0 and the scopes "Common Entities - Read-Only Access" and "Read marketplace Job Postings".
    The callback URL is `upwork_redirect_uri` exactly (the Upwork tab shows it with a Copy button).
  - Add `upwork_client_id` and `upwork_client_secret`, then press Connect in the Upwork tab. After about two weeks
    without a search, connect again.
- **Tenders:** EU public tenders (TED) for web design, software and IT work, by country and date, saved as leads in one
  click. Georgia's procurement portal has no feed you may use automatically, so there is a button to its search page.
- **Daily limits** keep costs down: `finder_ai_daily_limit` AI calls a day (default 40; a search or research is usually
  one call). The usage line at the bottom shows what's left.
- **Privacy:** the legal page's "Businesses we may contact" section describes this. Leads are deleted
  `leads_keep_months` (6) after they were found unless you won them. Contact businesses only; Georgian law may require
  consent before direct marketing to individuals (sole traders count), so check with a lawyer before any mass outreach.
- **First check after uploading:** search "Dentists" in Tbilisi with OpenStreetMap only. The map service couldn't be
  reached from the build machine, so this is its first live test.
- The daily clean-up cron (`api/housekeeping.php`, see Quote form) also deletes old leads and cached results. Make sure
  it runs every day: on quiet days it is what keeps Upwork content under 24 hours.

| Setting | What it does |
|---|---|
| `finder_model`, `finder_effort` | The AI model and effort for the finder (default `claude-opus-5-5`, `medium`). |
| `finder_ai_daily_limit` | AI calls a day in all (default 40). |
| `leads_keep_months` | Leads are deleted this many months after they were found, unless won (default 6). |
| `overpass_url`, `finder_user_agent` | The OpenStreetMap service and how the finder identifies itself to it. |
| `upwork_client_id`, `upwork_client_secret`, `upwork_redirect_uri` | Your Upwork API key (see above). |

Data, all private in `evosoft-data/` and saved safely (a crash can't leave a half-written file): `leads.json`,
`leads-suppressed.json` (hashes only), `finder-usage.json`, `finder-cache/`, and `upwork-token.json` (encrypted with a
key from `upwork_client_secret`: after changing the secret, connect Upwork again).

The older `Lead Radar` app at the top of this repository (`server.js`, `public/`) is replaced by the client finder.
Don't put it online: it has no sign-in, so anyone who finds it can use your Anthropic key.

### How the assistant works

- It knows what's on the site: company, services, process, FAQ, every product and every demo account. That knowledge
  (`api/knowledge.md`) and the built-in answers (`assets/data/chat-kb.json`) are **generated from the data files on each
  build**, so they never go out of date.
- It doesn't call EvoSoft "the best" or rank other companies, doesn't promise prices, dates, refunds or results, and
  never invents reviews or testimonials; asked, it says it's an AI. Those rules are in `site-builder/lib/knowledge.mjs`
  (an assistant's answers count as the company's own advertising, so keep them).
- It never quotes prices. Cost questions get a link to the quote form.
- With an API key it calls Claude (through Anthropic's official PHP SDK). It uses short, low-effort replies, caches the
  knowledge between visitors to cut cost, and falls back to another model if the first refuses. Without a key, or if
  the API is down or a visitor hits a limit, it answers from the built-in answers instead.
- Conversations stay in the visitor's browser tab. Nothing is stored on the server except short-lived rate-limit counters: each holds a hash of the visitor's IP address made with a key that changes daily and is deleted after two days.

### Quote form

`api/quote.php` checks the request, saves it, then emails it to `quote_to` with the visitor as Reply-To, so pressing
Reply answers them. The email also says which language the visitor used the site in, so you know how to reply.
Bots that fill the hidden field are ignored.

- **Saved first.** Every request goes into `evosoft-data/quotes.jsonl` next to `public_html`, one per line. Uploading
  a new version of the site never touches that folder. If it can't be created there, `api/data/quotes.jsonl` is used
  instead (blocked from the web). Requests the old version saved in `api/data` are moved over by themselves, and the old
  file is then deleted.
- **Deleted on schedule.** Requests older than `quote_keep_months` (12) are deleted from that file automatically, as the
  privacy policy says. Delete the emails in the mailbox on the same schedule, unless a request became a project.
- **Daily clean-up job (set this up once).** The clean-up runs whenever someone uses the chat or the form, but on a
  quiet day nobody does, and the privacy policy promises that rate-limit counters are gone within two days. So add a
  cron job in hPanel (Advanced → Cron Jobs), once a day, with the command
  `/usr/bin/php /home/<user>/domains/evosoft.solutions/public_html/api/housekeeping.php`.
  It prints `EvoSoft housekeeping done …`; the web server refuses that file, so only the cron job can run it.
- **Sent over SMTP.** With `smtp_pass` set, the form signs in to the mailbox and sends from it, which is what
  Hostinger wants. Without it, the form uses PHP's `mail()`, which hosts often refuse.
- **The visitor is never turned away.** Once a request is saved they see it as sent, even if the email fails. The
  reason goes to the PHP error log and to `evosoft-data/mail-status.json`.
- **Check it** at `https://evosoft.solutions/api/quote.php?health=1`: `"mail"` is `"smtp"` (or `"mail"` without a
  password) and `"last_send"` is `"ok"`, `"failed"` or `"never"`. On `"failed"`, `mail-status.json` says why (most
  often a wrong password).

## Editing

| What | Where |
|---|---|
| Phone numbers, email, services, process, FAQ, client sites, quote form options, chat suggestions | `site-builder/data/site.mjs` |
| Prices and rules of the website price estimate (`/estimate`) | `site-builder/data/pricing.mjs` (see Website price estimate below) |
| Products, demo URLs, demo accounts, screenshots and captions | `site-builder/data/products.mjs` |
| Page layouts and wording | `site-builder/build.mjs` |
| Translations | `site-builder/i18n/<lang>/*.json` (see Languages below) |
| Colours, fonts, spacing | `evosoft-site/assets/css/site.css` (colour tokens at the top: navy by default, redefined for cream blocks) |
| The slogan | `slogan` in `site-builder/data/site.mjs`; the hero headline uses the translations of `Your digital {evolution} starts here` |

Then rebuild (Node 18+, no `npm install`):

```bash
node site-builder/images.mjs   # only when screenshots changed (needs ImageMagick)
node site-builder/build.mjs
```

Preview it with the clean addresses: `node site-builder/serve.mjs` and open http://localhost:8080/home. With the chat
and quote form working too: `cd evosoft-site && php -S 127.0.0.1:8000 ../site-builder/router.php` and open
http://127.0.0.1:8000/home. (Opening the `.html` files straight from disk doesn't work any more: the links leave the
`.html` off.)
For local testing only, an `api/config.php` with `'mail_mode' => 'log'` saves quotes instead of emailing them.

### Languages

The site is built in English (at the root) and Spanish (`/es/`). The header has a language menu, every page links to
its other version for Google (`hreflang`), and the sitemap lists both. English pages offer visitors whose browser
prefers Spanish the Spanish version once; nothing redirects on its own. (Georgian and Russian versions existed until
November 2026; their addresses now redirect to the English pages. To bring one back, add it to `LANGS` in
`lib/i18n.mjs` and restore its dictionary folder from git history.)

- Write content in English, in `site.mjs`, `products.mjs` or `build.mjs`, then rebuild. The build lists every string in
  `site-builder/i18n/source.json` and prints how many each language has, e.g. `Español: 640/640 strings translated`.
- Translations are in `site-builder/i18n/es/*.json`: the English text on the left, the translation on the right.
  Keep `{placeholders}` as they are. A changed English sentence needs its translation updated too; until then the
  page shows the English, and `dist/i18n-missing-<lang>.json` lists what's missing.
- The demos themselves stay in English, so instructions keep the demo's button names in English.
- Noto Sans Georgian (in `assets/fonts/`) is kept only for the few Georgian letters on the legal page ("შპს"); the browser downloads it only on pages that have them. Font licences (SIL OFL 1.1) are next to the fonts, and the icon licences (Lucide, Feather) are in `assets/licenses/`; the legal page credits all of them.

### Demo links

`demo.url` for each product in `products.mjs` (defaults: `evo-demo.`, `mail-demo.` and `studycat-demo.evosoft.solutions`).
Pages check each demo when they load and show **Live** or **Offline right now**, so you can publish before every demo
is up. Set `demo.url` to `null` to show "Coming soon". Hosting kits: `demos/README.md`.

## Logo

Logo files are in `evosoft-site/assets/img/brand/`: `logo.svg` (for light backgrounds), `logo-dark.svg` (for dark
backgrounds), `mark.svg` (the mark on its own), `icon.svg` (white mark on a black tile) and `logo-1200.png`. The mark is
the X/A star; the wordmark is EVOSOFT in Inter ExtraBold, converted to outlines, so it looks the same everywhere. Logo
black is `#111318`.

The mark is shown upside down (`FLIP` in `logo.py`). Everything is generated by `site-builder/logo.py` from one definition of the mark: the inline version the pages use
(`site-builder/lib/logo.mjs`, which takes its colours from the CSS tokens `--logo-x` and `--logo-word`, so it works on navy and on cream), the brand files, the favicon, the app
icons and the logo on the share image (`og.jpg`; the rest of that image is kept). Run it again after changing the logo:

```bash
pip install fonttools brotli cairosvg pillow                        # plus ImageMagick for favicon.ico
(cd "$(mktemp -d)" && npm pack @fontsource/inter@5.3.0 && tar -xzf fontsource-inter-5.3.0.tgz \
  && python3 /path/to/site-builder/logo.py "$PWD/package/files/inter-latin-800-normal.woff2")
node site-builder/build.mjs
```

## SEO

Each page has its own title and description, a canonical URL, Open Graph and Twitter tags, and structured data
(Organization, WebSite, WebPage, BreadcrumbList; SoftwareApplication on product pages, Service on the services page and
FAQPage on the quote page). It also has:

- `sitemap.xml`, which lists the screenshots
- `robots.txt`, which keeps `/api/` out of search
- `llms.txt`, a plain summary for AI search tools
- fast pages: static HTML, self-hosted fonts, WebP images with sizes, and no tracking scripts (any future analytics
  must be cookieless and self-hosted, or load only after consent)

Ideas that would help further:

- **Google Business Profile** for EvoSoft, which matters most for "near me" and Georgia searches.
- **Links to evosoft.solutions** from client sites (a "Made by EvoSoft" footer link) and from the products.

## Legal, privacy and accessibility

`/legal` has the legal notice (who runs the site), terms of use (with payments and refunds), the privacy policy, the
list of what the site saves in the browser, the copyright notice, and credits for the fonts and icons. The footer links
each part. **Keep it true to the code**: if you change what the forms, the chat or the scripts collect, send or store,
change the text in `build.mjs` (the legal page) and `site.legalUpdated` in `data/site.mjs` with it.

- **Company details** are in `data/site.mjs` (`legalName`, `legalForm`, `companyId`, `address`, `vatPayer`). Empty ones
  are left off; once filled in, they appear on the legal notice and in the structured data.
- **No consent banner is needed** because the site sets no cookies and uses no analytics, ads, embeds or third-party
  fonts. Pages carry a Content-Security-Policy (built in `build.mjs`) that blocks anything from other servers, so a
  tracker can't be added by accident. Adding analytics or an embed means asking for consent first (with an equal
  "Reject" choice), adding its host to the policy, and updating the privacy and cookie text.
- **Client websites** show their name, not a live screenshot from another service. To show a screenshot, get the
  client's permission, save it as `evosoft-site/assets/shots/clients/<name>.jpg`, add `shot: 'clients/<name>.jpg'`
  to the client in `data/site.mjs`, and run `node site-builder/images.mjs`.
- **Claims**: no reviews or testimonials unless they are real, with the client's written permission. Response times,
  support periods and timelines are described as typical; the written quote is what binds.
- **Accessibility**: the site aims at WCAG 2.2 AA: text contrast of 4.5:1 or more, focus rings of 3:1, everything works
  with the keyboard, form errors are named per field, and buttons say what they do.
- **Owner checklist** (not code): accept the DPAs of Hostinger and Anthropic; keep a one-page record of what personal
  data you process; have a plan for a data breach (tell the Personal Data Protection Service of Georgia within 72
  hours); decide whether you need an EU representative (GDPR Art. 27) since the site serves EU visitors; put the
  14-day cancellation right in quotes for private (consumer) clients; have a Georgian lawyer read the legal page,
  and name the ground under Georgian law for sending chat messages to Anthropic in
  the USA (the page only claims the EU clauses for transfers the GDPR covers).
- **Live demos** are covered by the same privacy policy ("Live demos", and the logs line under "How long we keep it").
  Keep it true to the demo kits in `demos/`: the reset times, Evo's 5 backups, the clock-in location and the
  OpenStreetMap maps. The Mailtabs demo's Caddy writes no access log; after updating its `Caddyfile` on the server,
  run `docker compose up -d --force-recreate caddy` there once, so the old log goes with the old container.
- **Metadata:** pages carry `copyright` meta tags and `copyrightHolder` in their structured data. Every demo section on
  the site carries its own copyright line; the live demos show their own notice (see each kit in `demos/`).

## Look

Three colours, by the 60/30/10 rule: **navy** `#14213D` (about 60%: the heroes, most sections, the footer), **cream**
`#F4EDE0` (about 30%: type on navy, and every other section), **coral** `#FF6B5B` (about 10%: the buttons we want
pressed, the word "evolution", and a few small markers). Text on coral is navy, never white (navy on coral reads at
5.7:1; white would be 2.8:1).

- **The field.** Every hero (the home page, page heads, product heads, the call-to-action panel) sits on a soft field of
  light: three blurred blobs (slate top left, a coral glow, a lighter navy bottom right) drifting slowly behind a pane of
  fluted glass (thin vertical ribs, `.flutes`). On the home page the field leans a little against the pointer. Page
  heads fade into the navy section below them, so there is no seam.
- **The home hero.** The slogan sits low on the left in cream, "evolution" in coral, with the coral "Get a free
  quote" pill and a "Try a live demo" link under it. Top right, a frosted glass card lists the three live demos (with
  their status and number of accounts) and a coral "Free quotes" pill. Along the bottom, four facts; a coral underline walks
  across them, lighting each in turn. The chat's hello bubble only shows while the hero is scrolled away, so it never
  covers the buttons. A small "Pause animation" button under the moving words stops every looping animation (the
  moving words, the light, the facts, the typing line and the demo card's turning pages).
- **Navigation.** The links sit in a frosted pill; the current page has a small coral dot. The language and menu
  buttons are round and cream.
- **Sections** alternate navy and cream (`.sec` and `.sec.alt`; `.on-cream` makes any block cream). The call to
  action sits on cream; after a cream section it joins it instead of starting a second cream band. The tokens at the
  top of `site.css` (`--bg`, `--ink`, `--border`, `--card`, ...) are redefined for cream blocks, so components work on
  either.
- **Focus rings** are coral on navy and navy on cream (coral on cream would be too faint).
- **Coral** is for action and emphasis only: primary buttons, "evolution", the typing cursor, the reading line,
  focus outlines, the active nav dot, the last process step, the open FAQ marker.
- **Products** each have a colour for small markers (tab dots, role badges, the glow on their tile): Evo coral,
  Mailtabs sand (a deeper cream, so it shows on cream sections too), StudyCat a light navy.
- **Type.** Inter, the logo's typeface, for everything, set large and tight. JetBrains Mono for the typing line. Noto
  Sans Georgian for the few Georgian letters on the legal page.
- **The slogan.** "Your digital evolution starts here" is the home page headline, with its words rising in. It is also
  written huge in every footer, on the share image and in the structured data.
- **The share image** (`assets/img/og.jpg`) is drawn by `site-builder/og.py`:

  ```bash
  python3 site-builder/og.py
  ```
