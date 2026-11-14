# EvoSoft website

The evosoft.solutions website: portfolio, live demos with every test account, services, a "Get a quote" form and a
chat assistant that knows the whole site. © 2026 EvoSoft Solutions. All rights reserved.

```
evosoft-site/     the finished website (what goes on the server)
  api/            chat assistant (chat.php) and quote form (quote.php), PHP 8.1+
site-builder/     where you edit it: data files, page templates, build scripts (not uploaded)
demos/            how to host each live demo (one folder per product)
```

## Publish it (Hostinger or any PHP host)

```bash
node site-builder/package.mjs        # builds and makes dist/evosoft-site-YYYYMMDD.zip
```

1. In hPanel → File Manager, open `public_html`, upload the zip and **Extract** it there (replace the old files).
   The zip includes the hidden `.htaccess` files and the PHP libraries for the chat.
2. Add your settings file (next section). Without it the site still works: the chat answers from the built-in
   answers, and the quote form emails `contact@evosoft.solutions`.
3. Open `https://evosoft.solutions/api/chat.php?health=1`. `{"ok":true,"ai":true}` means the assistant is using Claude.
4. In Google Search Console, add the site and submit `https://evosoft.solutions/sitemap.xml`.

Old links keep working: `/pricing.html` redirects to the quote page, and every other old page name is unchanged.

## Settings: chat assistant and quote form

Copy `evosoft-site/api/config.example.php` to **`evosoft-config.php` next to `public_html`** (on Hostinger:
`/home/<user>/domains/evosoft.solutions/evosoft-config.php`), so it can never be downloaded. `api/config.php` also
works; `api/.htaccess` blocks it from the web. Then fill in:

| Setting | What it does |
|---|---|
| `anthropic_api_key` | Turns on the AI assistant. Create a key at console.anthropic.com → API keys. |
| `chat_model` | `claude-opus-5-5` by default (Anthropic's current default). `claude-haiku-5-5` costs far less per message, if you want to save. |
| `chat_per_ip_10min`, `chat_per_ip_day`, `chat_global_day` | Limits per visitor and a daily ceiling for the whole site, so spending can't run away. |
| `quote_to` | Where quote requests are emailed (default contact@evosoft.solutions). |
| `mail_from` | The sender address. Use a mailbox or alias on your domain (for example no-reply@evosoft.solutions) so mail isn't marked as spam. |

Environment variables (`ANTHROPIC_API_KEY`, `EVOSOFT_CHAT_MODEL`, `EVOSOFT_QUOTE_TO`, `EVOSOFT_MAIL_FROM`) override the file.

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

`api/quote.php` validates the request, emails it to `quote_to` with the visitor as Reply-To, and saves a copy in
`api/data/quotes.jsonl` (blocked from the web) so a request is never lost if mail fails. Bots that fill the hidden
field are ignored. If PHP isn't available, the form opens the visitor's email app with everything filled in.

## Editing

| What | Where |
|---|---|
| Phone numbers, email, services, process, FAQ, client sites, quote form options, chat suggestions | `site-builder/data/site.mjs` |
| Products, demo URLs, demo accounts, screenshots and captions | `site-builder/data/products.mjs` |
| Page layouts and wording | `site-builder/build.mjs` |
| Colours, fonts, spacing | `evosoft-site/assets/css/site.css` (colour tokens at the top, light and dark) |

Then rebuild (Node 18+, no `npm install`):

```bash
node site-builder/images.mjs   # only when screenshots changed (needs ImageMagick)
node site-builder/build.mjs
```

Preview with the API working: `cd evosoft-site && php -S 127.0.0.1:8000` and open http://127.0.0.1:8000.
For local testing only, an `api/config.php` with `'mail_mode' => 'log'` saves quotes instead of emailing them.

### Demo links

`demo.url` for each product in `products.mjs` (defaults: `evo-demo.`, `mail-demo.` and `studycat-demo.evosoft.solutions`).
Pages check each demo when they load and show **Live** or **Offline right now**, so you can publish before every demo
is up. Set `demo.url` to `null` to show "Coming soon". Hosting kits: `demos/README.md`.

## Logo

New logo files are in `evosoft-site/assets/img/brand/`: `logo.svg` (for light backgrounds), `logo-dark.svg` (for dark
backgrounds), `mark.svg` (the icon on its own) and `logo-1200.png`. The mark is a lowercase "e" whose stroke ends in
EvoSoft orange (`#FF6700`). The wordmark is IBM Plex Sans SemiBold, converted to outlines, so it looks the same
everywhere. The site uses an inline version (`site-builder/lib/logo.mjs`) that switches colours with light and dark mode.

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
