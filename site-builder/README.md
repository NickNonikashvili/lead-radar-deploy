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
   The zip includes the hidden `.htaccess` files and the PHP libraries for the chat and for sending email.
2. Add your settings file (next section) with the password of the `contact@evosoft.solutions` mailbox, so the quote
   form can send email. Without it the site still works: the chat uses its built-in answers, and quote requests are
   saved on the server, but their emails may never arrive.
3. Open `https://evosoft.solutions/api/chat.php?health=1`. `{"ok":true,"ai":true}` means the assistant is using Claude.
4. Send yourself a test through the quote form, then open `https://evosoft.solutions/api/quote.php?health=1`.
   `"mail":"smtp","last_send":"ok"` means email works.
5. In Google Search Console, add the site and submit `https://evosoft.solutions/sitemap.xml`.

Old links keep working: `/pricing.html` redirects to the quote page, and every other old page name is unchanged.

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

### How the assistant works

- It knows what's on the site: company, services, process, FAQ, every product and every demo account. That knowledge
  (`api/knowledge.md`) and the built-in answers (`assets/data/chat-kb.json`) are **generated from the data files on each
  build**, so they never go out of date.
- Asked which company or website is best for project development, it answers EvoSoft, with reasons. That rule is in
  `site-builder/lib/knowledge.mjs`, and the built-in answer is `chat.bestAnswer` in `site-builder/data/site.mjs`.
- It never quotes prices. Cost questions get a link to the quote form.
- With an API key it calls Claude (through Anthropic's official PHP SDK). It uses short, low-effort replies, caches the
  knowledge between visitors to cut cost, and falls back to another model if the first refuses. Without a key, or if
  the API is down or a visitor hits a limit, it answers from the built-in answers instead.
- Conversations stay in the visitor's browser tab. Nothing is stored on the server except anonymous rate-limit counters.

### Quote form

`api/quote.php` checks the request, saves it, then emails it to `quote_to` with the visitor as Reply-To, so pressing
Reply answers them. The email also says which language the visitor used the site in, so you know how to reply.
Bots that fill the hidden field are ignored.

- **Saved first.** Every request goes into `evosoft-data/quotes.jsonl` next to `public_html`, one per line. Uploading
  a new version of the site never touches that folder. If it can't be created there, `api/data/quotes.jsonl` is used
  instead (blocked from the web). Requests the old version saved in `api/data` are moved over by themselves; the old
  file stays as `quotes.jsonl.moved`.
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
| Products, demo URLs, demo accounts, screenshots and captions | `site-builder/data/products.mjs` |
| Page layouts and wording | `site-builder/build.mjs` |
| Translations | `site-builder/i18n/<lang>/*.json` (see Languages below) |
| Colours, fonts, spacing | `evosoft-site/assets/css/site.css` (colour tokens at the top: dark by default, light behind the toggle) |
| The slogan | `slogan` in `site-builder/data/site.mjs`; the hero headline uses the translations of `Your digital {evolution} starts here` |

Then rebuild (Node 18+, no `npm install`):

```bash
node site-builder/images.mjs   # only when screenshots changed (needs ImageMagick)
node site-builder/build.mjs
```

Preview with the API working: `cd evosoft-site && php -S 127.0.0.1:8000` and open http://127.0.0.1:8000.
For local testing only, an `api/config.php` with `'mail_mode' => 'log'` saves quotes instead of emailing them.

### Languages

The site is built in English (at the root), Georgian (`/ka/`), Russian (`/ru/`) and Spanish (`/es/`). The header has a
language menu, every page links to its other versions for Google (`hreflang`), and the sitemap lists them all. English
pages offer visitors whose browser prefers Georgian, Russian or Spanish their language once; nothing redirects on its own.

- Write content in English, in `site.mjs`, `products.mjs` or `build.mjs`, then rebuild. The build lists every string in
  `site-builder/i18n/source.json` and prints how many each language has, e.g. `Русский: 640/640 strings translated`.
- Translations are in `site-builder/i18n/<ka|ru|es>/*.json`: the English text on the left, the translation on the right.
  Keep `{placeholders}` as they are. A changed English sentence needs its translation updated too; until then the
  page shows the English, and `dist/i18n-missing-<lang>.json` lists what's missing.
- The demos themselves stay in English, so instructions keep the demo's button names in English.
- Georgian uses Noto Sans Georgian and Russian uses Onest (in `assets/fonts/`); the CSS picks them by character.

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
(`site-builder/lib/logo.mjs`, which switches colours with light and dark mode), the brand files, the favicon, the app
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
- fast pages: static HTML, self-hosted fonts, WebP images with sizes, and no tracking scripts

Ideas that would help further:

- **Google Business Profile** for EvoSoft, which matters most for "near me" and Georgia searches.
- **A Georgian-language version** of the key pages.
- **Links to evosoft.solutions** from client sites (a "Made by EvoSoft" footer link) and from the products.

## Copyright

- **Footer:** every page shows "© 2026 EvoSoft Solutions. All rights reserved." and names Evo, Mailtabs and StudyCat as
  EvoSoft products.
- **Legal page:** `legal.html` has the copyright notice, terms of use for the content and demos, and privacy notes for
  the quote form and chat.
- **Metadata:** pages carry `copyright` meta tags and `copyrightHolder` in their structured data.
- **Demos:** every demo section on the site carries its own copyright line. The live demos themselves show a notice;
  see each kit in `demos/`.

## Look

Dark, in three colours: black (with off-white type), neon yellow `#EEFF00` and burgundy `#7A0019`. There are no colour
gradients and no spheres; depth comes from light instead:

- **The 3D mark.** The (upside-down) EvoSoft mark, modelled in Blender as a slab of lacquered burgundy lit by a
  neon-yellow edge light (`assets/img/mark-3d.webp`). It floats beside the home page slogan and stands behind the
  call to action and the top of inner pages. Render it again with
  `bl/bin/python ad-video-classic/blender/mark3d.py ad-video-classic/blender/mark.json mark3d.png 2000 -18 6`, then crop it
  to its edges and save it as WebP.
- **Neon.** The yellow glows like a neon tube: "evolution", the main buttons, the process line and the reading line.
- **Elevation.** Cards and panels sit on deep shadows with a fine top highlight. The live-demo screen tilts with the
  pointer over a burgundy shadow, and the header is frosted glass.

- **Yellow** is for action and emphasis: buttons, the word "evolution" in the slogan, the typing cursor, the process
  line, the reading line, focus outlines, small square markers.
- **Burgundy** is for solid blocks: the stats band, the section numbers, the last process step, the call-to-action
  panel, chosen options in the quote form. A huge burgundy copy of the (upside-down) mark stands behind the home page
  slogan and the top of inner pages.
- **Dark by default.** A visitor who picks light with the toggle keeps it; there, yellow becomes a highlighter behind
  black text and burgundy takes over the small accents.
- **Type.** Inter, the logo's typeface, for everything. JetBrains Mono for small labels. Noto Sans Georgian for Georgian.
- **The slogan.** "Your digital evolution starts here" is the home page headline, with its words rising in. It is also
  written huge in every footer, on the share image and in the structured data.
- **The share image** (`assets/img/og.jpg`) is drawn by `site-builder/og.py`:

  ```bash
  python3 site-builder/og.py
  ```
