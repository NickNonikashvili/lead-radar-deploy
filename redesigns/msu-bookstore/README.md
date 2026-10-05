# MSU Bookstore — redesign concept

A static, multi-page redesign of [msubookstore.org](https://www.msubookstore.org/). No build step and no
dependencies: plain HTML, CSS and JavaScript that any static host can serve.

Checkout, accounts, the cart and the textbook search hand off to the real store, so every button goes somewhere
that works.

## Pages

| Page | What it does |
| --- | --- |
| `index.html` | Home: textbook search, National Champions banner, categories, popular products, hours |
| `shop.html` | All products with category filter, search, sort and an under-$25 filter (`?cat=gifts`, `?q=nike`) |
| `product.html?id=…` | Product detail with photo, price, description, "buy on msubookstore.org" and related items |
| `textbooks.html` | Course materials search, formats, rent / sell back / Inclusive Access / returns, faculty adoptions |
| `about.html` | Not-for-profit mission and history |
| `visit.html` | Hours with live open/closed status, map, contact |
| `help.html` | FAQ (`help.html#rentals`, `#buyback`, `#returns`, `#digital`, `#faculty`) |
| `404.html` | Not-found page (used automatically by Netlify, Vercel, Cloudflare Pages and GitHub Pages) |

Shared code lives in `assets/`:

- `data.js`: products, categories, store links and hours. **Edit this file to add or change products.**
- `photos.js`: generated list of downloaded product photos (see below).
- `site.js`: header, footer, menu, product cards, hours logic.
- `styles.css`: all styles.

## 1. Add the real product photos

The photos come from the store's own product pages. On your computer (Node 18 or newer):

```bash
cd redesigns/msu-bookstore
node scripts/fetch-photos.cjs
```

The script visits each product page on msubookstore.org, downloads the main product photo into
`images/products/`, and rewrites `assets/photos.js`. Products without a photo keep their illustration.

- Rerun it any time. It skips photos you already have (`--force` re-downloads everything).
- A few products link to a category instead of their own page, so the script can't find their photo. It
  prints their ids at the end. Save a photo as `images/products/<id>.jpg` (or `.png`/`.webp`) and rerun it
  to include it.

The photos belong to the store and the brands. Use them for pitching this redesign to the store. Don't put
them on a public site without the store's permission.

## 2. Preview locally

```bash
cd redesigns/msu-bookstore
python3 -m http.server 8080      # or: npx serve .
```

Open http://localhost:8080. Opening `index.html` directly from the file system also works, except for the
custom 404 page.

## 3. Deploy

The folder is the whole site. Pick one:

- **Netlify (no account setup needed to try):** drag the `msu-bookstore` folder onto
  <https://app.netlify.com/drop>.
- **Vercel:** `npx vercel` inside the folder, accept the defaults.
- **Cloudflare Pages:** create a project, upload the folder (or connect the repo with build command empty
  and output directory `redesigns/msu-bookstore`).
- **GitHub Pages:** publish the folder from a branch. All links are relative, so it works from a subpath
  like `/msu-bookstore/`. The 404 page's links assume the site is at the domain root.

## Before going public

This is a concept, and it's set up so it can't be mistaken for the official site:

- A banner at the top of every page says it's a redesign concept.
- Every page has `<meta name="robots" content="noindex">` and `robots.txt` blocks search engines.

If the store adopts the design, remove the banner in `assets/site.js` (`.concept`), delete the `noindex`
meta tags and change `robots.txt` to allow crawling.

## Data notes

- Product names, prices and links were taken from msubookstore.org's public catalog. Items with no price
  listed show "See price" and link to the store.
- Hours, rental, buyback and return rules come from the store's FAQ and Course Materials 101 pages. Check
  them against the live site before launch, since they can change each term.
