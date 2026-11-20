# Luxhouse

Website for a real-estate agency that works only with high-end homes: listings in
English, Georgian and Russian, enquiry handling, and a free-movement 3D tour of each
residence that is reconstructed from its photographs.

It is a small Node/Express app with no database and no build step on the server.
It lives in its own folder and does not touch the Lead Radar app in the repository root.

## Run it

```bash
cd luxhouse
npm install
npm start
```

Open http://localhost:3100. The site picks the visitor's language from the browser
(`/en/`, `/ka/`, `/ru/`).

## What is in the site

| Page | Address |
| --- | --- |
| Home | `/en/` |
| Residences, with filters, sorting and a map view | `/en/residences` |
| Residence: gallery, facts, map, financing estimate, viewing request | `/en/residences/<slug>` |
| 3D tour (appears once a tour has been built) | `/en/residences/<slug>/tour` |
| Services, Sell with us (valuation request), About, Contact | `/en/services` … |
| Saved residences (kept in the visitor's browser) | `/en/saved` |
| Privacy policy, Terms of use | `/en/privacy`, `/en/terms` |
| Enquiry inbox | `/admin` |

Also built in: USD ⇄ GEL price toggle, share menu, print-friendly residence page,
`sitemap.xml`, `robots.txt`, structured data for search engines, per-language
social previews.

## Settings

**`site.config.json`** — everything a non-developer changes:

- `brand`, `legalName` (the legal name appears in the footer and legal pages)
- `contact`: phone, WhatsApp, Telegram, email, office address, hours, office map position.
  Anything left empty is simply not shown.
- `social`: Instagram, Facebook, YouTube, LinkedIn links
- `currency.usdToGel` and `currency.rateDate`: the rate used for the lari conversion
- `home.heroListing`, `home.tourShowcase`: which residence fronts the home page
- `mortgage`: defaults of the financing calculator

**`.env`** (copy `.env.example`) — per-server values and secrets:

- `BASE_URL`: the public address, for canonical links and social previews
- `ADMIN_PASSWORD`: turns on the enquiry inbox at `/admin`
- `SMTP_*`, `MAIL_TO`: email notification for every new enquiry
- `LEAD_WEBHOOK_URL`: send every enquiry as JSON to another system
- `DATA_DIR`: where enquiries are stored (use a persistent disk)
- `TRUST_PROXY=1` behind a proxy, `NODE_ENV=production` on the live server

## Residences

Each residence is one JSON file in `content/listings/` plus its photographs in
`content/source-photos/<slug>/`.

To add one:

```bash
npm run new-listing -- --slug vake-penthouse --photos /path/to/photos
```

This copies the photos, numbers them and writes a listing file with every field to
fill in. Then:

1. Edit `content/listings/<slug>.json`: all texts in three languages, the facts, the
   price, a `room` for each photo, the `features`. The allowed `room` and `features`
   keys are listed in `src/i18n/en.js`.
2. Build the web images: `npm run images`
3. Build the 3D tour (see below).
4. Set `"published": true` and run `npm run check && npm test`.

`npm run check` reports missing translations, photos without images, unknown keys,
leftover placeholders and residences without a tour.

Other fields: `status` (`for-sale`, `reserved`, `sold`), `featured`, `cover`,
`location.lat/lng/radiusM` (the map shows this circle, never an exact address).
A photo with `"tour": false` stays out of the 3D tour.

Interface texts are in `src/i18n/en.js`, `ka.js` and `ru.js`. The three files must
keep the same keys; the tests enforce this.

## 3D tours

### What a tour is

Every photograph becomes one explorable *space*. An AI depth model measures how far
each pixel is from the camera and the lens angle; from that the viewer rebuilds the
room as a 3D surface and projects the photograph back onto it. From where the
photographer stood the visitor sees exactly the real photograph, and from there they
can look around inside it, lean, step in and zoom, and travel from space to space.
The controls follow Google Street View: drag to look, a ring that lies on whatever
surface is under the pointer, click to step towards it, scroll or pinch to go deeper,
and keep walking forward (W or the up arrow) to move on to the next space. On a VR
headset the page offers an "Enter VR" button.

What it is not: a scan, and not a 360° panorama. Each space shows what its photograph
shows, so the visitor cannot turn around to see what was behind the camera, and the
range of movement is measured per photograph (typically a lean of 10–60 cm and a step
of 0.3–2 m) so that the picture never tears or shows anything the camera did not see.
There is no continuous walk from room to room, because still photographs taken from
different spots do not contain that information. Proportions are approximate.

To get the full Street View experience (turn all the way around, walk the whole
house) the house has to be captured for it: a 360° camera on a tripod in each room
(about an hour per house), or a Matterport-style scan. The tour data is one folder
per space, so such captures can be added later without changing the site.

Better photographs give better tours: original files from the owner or photographer
(not portal downloads, which are small and watermarked), wide but not fisheye, level,
several per room, with nothing close to the lens at the edge of the frame.

### Building tours

The builder is Python. One-time setup:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r tools/tour/requirements.txt
git clone https://github.com/microsoft/MoGe.git ../MoGe
export PYTHONPATH=$PWD/../MoGe
```

Then:

```bash
python tools/tour/build_tour.py --listing dighomi-stone-villa
python tools/tour/build_tour.py --all                      # every residence
python tools/tour/build_tour.py --listing <slug> --only 03,07   # rebuild two spaces
```

The first run downloads the model (about 1.3 GB). It runs on a normal CPU; a GPU is
faster but not required. Results are written to
`public/media/listings/<slug>/tour/` and the tour appears on the site immediately
(home page, listing cards, residence page).

The depth model is Microsoft **MoGe-2** (`Ruicheng/moge-2-vitl-normal`), published
under the MIT licence. Depth estimates are cached in `.cache/tour/`, so re-packing
after a code change does not re-run the model.

`python tools/tour/test_pack.py` checks the packing code against a synthetic room
whose true geometry is known.

### Files

- `tools/tour/providers.py` — depth providers (MoGe, and the synthetic test room)
- `tools/tour/pack.py` — depth → one depth grid prepared for a moving viewer (thin
  foreground flattened, object edges widened), gravity and eye height, the packed files
- `tools/tour/build_tour.py` — command line
- `client/tour/` — the viewer source (three.js); `npm run vendor` bundles it into
  `public/js/tour.bundle.js`

## Enquiries

All forms post to `/api/inquiries`. Each enquiry is validated, stored in
`data/inquiries.json` and, if configured, emailed and/or sent to a webhook.
A hidden honeypot field and a rate limit keep bots out.

`/admin` (user `admin`, password from `ADMIN_PASSWORD`) lists enquiries, lets you set
a status and notes, delete, and export CSV.

## Deploying

Any Node host works (Render, Railway, a VPS…):

1. Root directory `luxhouse`, start command `npm start`, Node 20 or newer.
2. Set the environment variables above. At minimum `BASE_URL`, `NODE_ENV=production`,
   `ADMIN_PASSWORD`, and `TRUST_PROXY=1` if the host puts a proxy in front.
3. Point `DATA_DIR` at a persistent disk, or enquiries are lost on redeploy.
4. Serve over HTTPS.

Everything the browser needs (fonts, map library, 3D viewer) is served by the app
itself; the only external requests are OpenStreetMap map tiles.

## Tests

```bash
npm test             # translations, validation, every page in every language, enquiries, admin
npm run test:e2e     # real browser: forms, gallery, maps, saved homes, the 3D viewer, phone layout
npm run check        # content check
```

`test:e2e` needs Playwright (`npm i -D playwright && npx playwright install chromium`).
When no residence has a tour yet, it tests the 3D viewer with a small synthetic tour
and removes it afterwards.

## Before going live

- **Photographs and listings.** The three launch residences use photos and details
  taken from the owners' public adverts, and the photos carry the portal's watermark.
  Publish them only with each owner's agreement, and replace the photos with the
  original files.
- Fill in `site.config.json` (phone, email, address, legal name).
- Have the privacy policy and terms (`src/i18n/*.js`, `legal`) reviewed by a lawyer.
- Update `currency.usdToGel`.
- Confirm each residence's map circle (`location` in its JSON).
