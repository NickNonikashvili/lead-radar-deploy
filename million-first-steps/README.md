# Million First Steps — website

The website for **Million First Steps · Georgia Travel Experiences**: a multi-page, scroll-animated static site with seven tours in three price tiers, a full history of Georgia, destinations, travel advice and a booking-request form.

It builds to plain HTML/CSS/JS with **no framework and no runtime dependencies**, so it can be hosted anywhere (Netlify, Cloudflare Pages, GitHub Pages, any web host) and even opened straight from a folder.

## Run it

```bash
cd million-first-steps
npm run dev        # builds into dist/ and serves it at http://localhost:8080
npm run build      # just build dist/
```

Node 18 or newer. `npm install` is only needed for the photo tools (it installs `sharp`).

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Illustrated hero you fly into, footprint-shaped reveal, the "deep time" counter (1.8 million years → today), a horizontal journey through 9 regions, a qvevri that fills with wine as you scroll, legends, hospitality, the tier switcher, an animated route map, the founders |
| `tours.html` | Tier comparison (Wanderer / Explorer / Golden Fleece), filterable tour list |
| `tours/<tour>.html` × 7 | Day-by-day itinerary synced to a map that draws the route as you read, tier picker, price calculator, inclusions |
| `history.html` | Scroll timeline from Dmanisi to today, "write your name in Georgian", legends, UNESCO heritage |
| `destinations.html` | Clickable region map and nine regions |
| `about.html`, `plan.html`, `contact.html` | Your story; visas, money, seasons chart, etiquette, FAQ; booking request form |
| `credits.html`, `privacy.html`, `terms.html`, `404.html` | Licences and photo credits (generated), privacy policy, booking-terms draft |

## Before you launch — checklist

1. **`src/config.mjs`** — real email, phone/WhatsApp, Instagram, legal company name, registration number, and `siteUrl` once you have a domain (turns on canonical links and `sitemap.xml`).
2. **Booking form** — create a free form at [Formspree](https://formspree.io) (or similar) and paste its URL into `formEndpoint`. Until then the form opens the visitor's email app with everything filled in.
3. **Your story** — `src/pages/about.mjs` has a warm placeholder for "the father" and "the son". Replace it with your real story and names, and add a photo of the two of you as `src/assets/photos/about-founders.jpg`.
4. **Prices** — adjust the per-tour prices in `src/data/tours.mjs` and the party-size factors and exchange rates in `src/config.mjs`.
5. **Photos** — see below.
6. **Legal** — read `CONTENT-SOURCES.md`, register with the Georgian National Tourism Administration, and have a lawyer finalise `terms.html`.

## Adding photos

The site is fully illustrated, so it looks finished without photos. Every place a photo can go is a **slot** listed in `src/data/photos.mjs`; when a slot gets a photo, the illustration there is swapped for it automatically.

- **Your own photo:** save it as `src/assets/photos/<slot-id>.jpg` (e.g. `region-kazbegi.jpg`), run `npm install` once, then `npm run photos:optimize` and `npm run build`.
- **Wikimedia Commons:** `npm run photos:commons` finds freely licensed photos for every empty slot, downloads and optimises them and records the credits (shown on `credits.html` and on the photo). Review each one.
  - See the alternatives for a slot: `node scripts/fetch-photos.mjs --list=region-kazbegi --previews` (small previews go to `photo-previews/`).
  - Use a specific one: `node scripts/fetch-photos.mjs --only=region-kazbegi --file="File:<name on Commons>" --force` — it is still licence-checked. To keep that choice, add `file: "File:…"` to the slot in `src/data/photos.mjs`.
  - Needs access to `commons.wikimedia.org` and `upload.wikimedia.org`; behind a proxy the script picks up `HTTPS_PROXY` automatically.

## Editing content

Everything you'd want to change is data, not layout:

- `src/data/tours.mjs` — tours, itineraries, prices, highlights
- `src/data/tiers.mjs` — what each tier includes (cars, hotels, dining, guides)
- `src/data/regions.mjs` — destinations
- `src/data/history.mjs` — timeline, legends, UNESCO lists
- `src/data/places.mjs` — map coordinates for every stop
- `src/pages/*.mjs` — page text and structure
- `src/assets/css/main.css`, `src/assets/js/main.js` — styles and animations

The illustrations are generated in `src/lib/scenes.mjs` and the logo in `src/lib/logo.mjs`.

## Deploying

- **Netlify:** new site from this repo, *Base directory* `million-first-steps`; `netlify.toml` sets the build command and publish folder.
- **Cloudflare Pages / Vercel:** root directory `million-first-steps`, build command `npm run build`, output `dist`.
- **Anywhere else:** run `npm run build` and upload the contents of `dist/`.

## Accessibility & performance

- Respects *reduced motion*: animations and smooth scrolling switch off, and all content is still there.
- Works without JavaScript (minus animations and the calculator).
- No cookies, no trackers, no third-party requests — fonts and scripts are self-hosted.
- Illustrations are vector and tiny; the whole site is about 2 MB including fonts.
