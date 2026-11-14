# EvoSoft website

The new evosoft.solutions site: a static, multi-page portfolio with live demos of Evo, Mailtabs and StudyCat, every
demo account, the current pricing and contact details.

```
evosoft-site/     ← the finished website. Upload the contents of this folder to public_html.
site-builder/     ← where you edit it (data + templates). Not uploaded.
demos/            ← how to host each live demo (one folder per product).
```

## Editing

Everything you are likely to change lives in two files:

| What | Where |
|---|---|
| Phone numbers, email, response time, services, prices, add-ons, FAQ, client sites | `site-builder/data/site.mjs` |
| Products, demo URLs, demo accounts, "try this" tips, screenshots and captions | `site-builder/data/products.mjs` |
| Page layouts and wording on each page | `site-builder/build.mjs` |
| Colours, fonts, spacing | `evosoft-site/assets/css/site.css` (tokens at the top) |

After editing, rebuild (Node 18+, no `npm install` needed):

```bash
node site-builder/images.mjs   # only when screenshots changed (needs ImageMagick)
node site-builder/build.mjs
```

Then preview locally: `cd evosoft-site && python3 -m http.server 8000` and open http://localhost:8000.

### Demo links

Each product's `demo.url` in `products.mjs` is where its public demo lives, by default:

| Product | Demo URL | How to host it |
|---|---|---|
| Evo | `https://evo-demo.evosoft.solutions` | `demos/evo/README.md` |
| Mailtabs | `https://mail-demo.evosoft.solutions` | `demos/mailtabs/README.md` |
| StudyCat | `https://studycat-demo.evosoft.solutions` | `demos/studycat/README.md` |

The site pings each demo when a page loads and shows **Live** or **Offline right now** next to it, so you can publish
the site before every demo is up. Set `demo.url` to `null` to show "Demo coming soon" instead of an Open button.

### Screenshots

Put screenshots in `evosoft-site/assets/shots/<product>/` (JPEG or PNG), list them in that product's `shots` array in
`products.mjs` with a caption, then run `images.mjs` and `build.mjs`. Mark one `hero: true` for the big image and
phone-sized ones `phone: true`.

### Logo

The header and favicon use a placeholder "E" mark in the brand orange (`#FF6700`), because the original SVG couldn't
be downloaded. To use the real logo, replace `evosoft-site/assets/img/icon.svg` and the `mark` SVG in
`site-builder/lib/icons.mjs`, then rebuild.

## Deploying

The site is plain HTML, CSS and JS, so any static host works.

**Hostinger / cPanel (Apache):** upload everything inside `evosoft-site/` (including the hidden `.htaccess`) into
`public_html`, replacing the old files. The old page names (`index.html`, `pricing.html`, `portfolio.html`,
`about.html`, `services.html`, `contact.html`) are kept, so existing links still work. `.htaccess` adds the 404 page,
caching and basic security headers; delete it if your host isn't Apache.

**Netlify / Cloudflare Pages / Vercel:** point the project at the `evosoft-site` folder, no build command.

After going live, submit `https://evosoft.solutions/sitemap.xml` in Google Search Console.

## What's on each page

- `index.html`: hero, the three products, demo centre teaser, services, client sites, process, pricing, contact.
- `demos.html`: every demo account for every product, with copy buttons, "try this" tips and live status.
- `work/evo.html`, `work/mailtabs.html`, `work/studycat.html`: case studies with screenshots and their demo accounts.
- `portfolio.html`, `services.html`, `pricing.html`, `about.html`, `contact.html`, `404.html`.

The contact form has no server: it opens the visitor's email app with the brief filled in, addressed to
contact@evosoft.solutions. The client-site thumbnails come from WordPress's free mShots service, as on the old site.
