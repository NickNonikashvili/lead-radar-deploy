# Luxhouse

Website for a real-estate agency that works only with high-end homes: listings in
English, Georgian and Russian, enquiry handling, and a 3D tour of each residence built
from its photographs, with Street View style controls.

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

## Design

The look is one system ("Nocturne"): a near-black ground, full-bleed photography graded like
film stills, one light grotesque set large, hairlines instead of boxes, and a single accent
(ember) reserved for the 3D tour, focus rings and the saved heart.

- `public/css/site.css` holds the system: tokens, type scale, grid, buttons, forms, header and
  footer, residence strips and cards, the lit 3D stage, lightbox, map.
- A page may bring its own files without touching the layout: `public/css/pages/<page>.css`
  and `public/js/pages/<page>.js` are picked up automatically, where `<page>` is the template
  name (`home`, `residences`, `residence`, `services`, `sell`, `about`, `contact`, `saved`,
  `legal`, `404`).
- Fonts are Inter Tight, Inter and Noto Sans Georgian, served by the site itself
  (`npm run vendor` copies them from the `@fontsource` packages). Georgian has its own rules:
  no capitals, no letter-spacing, slightly narrower and smaller display sizes.
- The tour page is standalone (`views/pages/tour.ejs`, `public/css/tour.css`,
  `client/tour/main.js`) and uses the same tokens.

## Settings

**`site.config.json`** — everything a non-developer changes:

- `brand`, `legalName` (the legal name appears in the footer and legal pages)
- `contact`: phone, WhatsApp, Telegram, email, office address, hours, office map position.
  Anything left empty is simply not shown.
- `social`: Instagram, Facebook, YouTube, LinkedIn links
- `currency.usdToGel` and `currency.rateDate`: the rate used for the lari conversion
- `home.heroListing`, `home.tourShowcase`: which residence fronts the home page
- `mortgage`: defaults of the financing calculator
- `art` (optional): hand-picked photographs and focal points per residence — which frames make up
  its strip of stills, where the cover is held when cropped, the room that leads into its 3D tour.
  Without an entry the site chooses from the photographs' proportions. Format: top of `src/art.js`.

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

A tour is a sequence of *spaces*, one per photograph, and there are two kinds.

**A room built in 3D** (see the next section). The whole room exists as a 3D space, made by
a world model from the listing's photographs of it. The visitor stands in it and walks like
a person: all the way around the sofa, up to a window, back to the door, looking in any
direction. It opens exactly where the photographer stood, so the first view is the
photograph. What the photographs did not show is invented by the model, and the tour says
so on every such space.

**A photograph with depth.** An AI depth model measures how far each pixel is from the
camera and the lens angle; from that the viewer rebuilds what the photograph shows as a 3D
surface and projects the photograph back onto it. From where the photographer stood the
visitor sees exactly the real photograph, and can look around inside it, lean, step in and
zoom. Nothing is invented, and so nothing can be seen that the camera did not see: the
visitor cannot turn around, and the range of movement is measured per photograph
(typically a lean of 10–60 cm and a step of 0.3–2 m) so that the picture never tears.
Façades, aerial pictures and views are always shown this way, and so is any room that has
not been built in 3D, or that the visitor's device cannot draw.

The controls follow Google Street View: drag to look, a ring that lies on whatever surface
is under the pointer, click to go there, scroll or pinch to go deeper, and the pad at the
bottom (or `[` and `]`) to move from space to space. In a room built in 3D the W A S D and
arrow keys walk; phones get a thumb stick. On a VR headset the page offers an "Enter VR"
button.

What a tour is not: a scan. Proportions are approximate, there is no continuous walk from
room to room, and a room built in 3D is plausible rather than true wherever the
photographs did not look. For a faithful walk through the whole house it has to be captured
for it: a 360° camera on a tripod in each room (about an hour per house), or a
Matterport-style scan. The tour data is one folder per space, so such captures can be added
later without changing the site.

Better photographs give better tours: original files from the owner or photographer
(not portal downloads, which are small and watermarked), wide but not fisheye, level,
several per room, with nothing close to the lens at the edge of the frame.

### Walking around a room: rooms built in 3D

A photograph cannot show what was behind the camera or the back of a sofa. To let a visitor
really walk around a room (a lap around the sofa, up to the window, back to the door) the
room is built as one 3D space by a world model, World Labs **Atlas**, from the listing's
photographs of it. What the photographs show is kept; what they do not show is invented to
fit. The tour opens that space exactly where the photographer stood, so the first thing the
visitor sees is the photograph, and from there they walk freely: W A S D or the arrow keys,
drag to look around, click or tap a spot on the floor to walk there. Walls and furniture are
solid, and the visitor stays inside the room.

A room is built in stages, and each can be looked at before the next:

```bash
export WLT_API_KEY=...        # atlas.worldlabs.ai -> Developers -> API keys
                              # scopes: tasks.create, operations.read, assets.create, assets.read
python tools/tour/rooms.py --listing dighomi-garden-house --dry-run     # the rooms, and the cost
python tools/tour/rooms.py --listing <slug> --room 06 pose       # photographs -> cameras and depth
python tools/tour/rooms.py --listing <slug> --room 06 views      # new viewpoints all around the room
python tools/tour/rooms.py --listing <slug> --room 06 check      # do the views agree? + one sheet of them
python tools/tour/rooms.py --listing <slug> --room 06 drop r2v03 --why "invents a second door"
python tools/tour/rooms.py --listing <slug> --room 06 splats     # the 3D room (the paid step, 15-25 min)
python tools/tour/rooms.py --listing <slug> --room 06 collider   # walls and furniture become solid
python tools/tour/build_tour.py --listing <slug> --only 06,07    # the tour picks the room up
```

How it works, in the order of the stages:

1. **Pose.** The photographs of one room are sent together; Atlas works out where each was
   taken and how far away every pixel is, in one shared, level world measured in metres.
   A room is named after its first photograph. Photographs named in that photo's
   `"sameSpaceAs": ["07"]` belong to the same room: they make its geometry real where they
   overlap, and each opens the same 3D space from its own viewpoint, at no extra cost.
2. **Views.** A few cameras at a time are placed on floor the frames so far show as free,
   looking at what they have not shown, and Atlas generates what each would see, with depth.
   Three rounds, 12 to 16 frames in all: step into the room, look back from the far end, and
   finally a ring at standing height around whatever the visitor can walk around. The tool
   places the cameras itself; `--plan file.json` places them by hand (rounds of
   `{"at": [x, y, z], "look": [x, y, z]}`), which is how the first room was made.
3. **Check.** `check` measures how well every frame's depth agrees with all the others and
   writes `content/tour-worlds/<slug>/<room>/views.jpg`, all frames on one sheet.
   **Look at that sheet, against the photographs at full size, before paying for the next
   stage.** A view that contradicts a photograph or the other views becomes a doubled,
   ghosted object in the room: drop it, with the reason. (And look twice before dropping: in
   the first room a doorway that seemed invented was real; photograph 07 shows it.)
4. **Splats.** The frames are reconstructed once into about two million Gaussian splats,
   `world.spz` (about 32 MB), in the scene's folder under `public/media/…/tour/<room>/`.
5. **Collider.** The same frames give a plan of the room: where something stands between
   shin and head height, where the outline of the room runs (read above door height, where
   walls are solid even over glass and doorways), and where the floor was never seen. The
   visitor can go wherever a person fits and that is reachable from the photograph's
   standpoint, and nowhere else: not through glass, not into a hallway that exists only as a
   backdrop. Written as `collider.glb`, a few thousand triangles.

`content/tour-worlds/<slug>/<room>/room.json` records all of it: every frame and camera,
which frames are generated, what was dropped and why, the operations, and notes on what in
the room is invented. The frames and depth maps themselves are kept in `.cache/tour-worlds/`
and fetched again from the Atlas project if they are lost.

What to know before publishing a room:

- **It is plausible, not true.** The wall behind the photographer, the far side of furniture
  and anything through a doorway are the model's guess. The tour marks these spaces as
  generated and the help panel says what that means. Walk through each one before it goes
  live, and say so in `room.json`'s notes when something invented could mislead a buyer.
- **Watermarks are reproduced.** A portal's watermark on the photographs comes out on a
  wall of the room. Use the owner's original photographs.
- **Glass, foliage and thin things** (chair legs, wires) are where splats are weakest, and
  so is anything only one frame saw at close range.
- **Cost.** `splats` is 5,000 credits (5 US dollars) per room; `--draft` gives a quick,
  rougher room for 500. Posing and views are small by comparison. Atlas has no call that
  reads the balance, so the tool cannot check it in advance; a run the account cannot pay
  for stops with a clear message and loses nothing. Nothing that was started is ever started
  twice: each piece of work carries a key derived from its content, a started reconstruction
  is written down before waiting, and the next run picks it up.
- **Weight.** A room is about 32 MB, downloaded when the visitor enters it (the photograph
  shows meanwhile). A device that cannot draw it stays on the photograph.

`python tools/tour/test_rooms.py` checks the camera arithmetic, the collider, the camera
planner and the money guards against a synthetic room, without calling the service.

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
- `tools/tour/rooms.py` — rooms built as walkable 3D spaces, stage by stage (optional, needs an API key)
- `tools/tour/atlas.py` — the World Labs Atlas calls and the camera and depth arithmetic
- `tools/tour/collider.py` — where a visitor can stand in a room, and the solid shapes
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
