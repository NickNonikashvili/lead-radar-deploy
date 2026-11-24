# EvoSoft business cards

Two cards with the same front: the company card, and Nikoloz Nonikashvili's (Founder). © 2026 EvoSoft Solutions.
All rights reserved.

- **Front (navy):** the upside-down EvoSoft mark, huge and lit from within, cut by the card's edges, behind fluted
  glass with a coral glow at its heart; the full logo top left; "Your digital **evolution** starts here" bottom left.
- **Back (cream):** the cream blends softly (through a little coral warmth) into a navy panel on the right, which holds a QR code to the quote page
  (https://evosoft.solutions/contact, "Scan for a free quote"). On the cream: the logo, who it is (the studio and its
  services, or a name and role), a short coral rule, then the contacts with small labels (PHONE, EMAIL, WEB).

| Card | Phone | Email |
| --- | --- | --- |
| `out/evosoft-company/` | +995 555 352 218, +995 599 574 416 | contact@evosoft.solutions |
| `out/evosoft-nikoloz-nonikashvili/` | +995 555 352 218 | contact@evosoft.solutions |

## For the printer

| | |
| --- | --- |
| Finished size | 90 × 50 mm (the usual size in Georgia and Europe) |
| Bleed | 3 mm on every edge (PDF pages are 96 × 56 mm; TrimBox and BleedBox are set) |
| Safe area | all text, logos and the QR code are at least 4 mm inside the cut (the build checks it) |
| Text | converted to outlines: no fonts needed |
| Images | the soft-light backgrounds are 600 dpi |
| CMYK | separated for ISO Coated v2 300% (FOGRA39), the usual European condition for coated card, with the OutputIntent embedded; highest total ink 267% |
| Small type | contact labels and the QR caption 6 pt or more |
| Paper | matte or soft-touch, 350–400 g/m², suits the soft light on the front |

**At a print shop:** send `<card>-print.pdf` (page 1 front, page 2 back). `<card>-print-CMYK.pdf` is the same in CMYK (FOGRA39), for a
shop that asks for CMYK. Bright coral and the light inside the big mark can come out a little softer on paper than on screen; ask
for a proof if colour matters. Each folder also has previews (`-front.png`, `-back.png`), a proof with the cut line
(coral) and safe area (dashed), and a mockup for showing people.

**On your own printer:** `<card>-A4-10up.pdf` has ten cards on an A4 sheet with crop marks: page 1 the fronts,
page 2 the backs. Print at 100 % ("actual size", not "fit to page"), double-sided, flip on the long edge, on the
heaviest card your printer takes (250–350 g/m²), then cut on the marks. Each card has its own 3 mm bleed, so a
printer that shifts the back by a millimetre still leaves no white edge.

The QR code uses the site's clean address `/contact`, which works once the new website (with its `.htaccess` files)
is on the server.

## Change or add a card

Edit `CARDS` at the top of `make.py` (a card with `name` and `role` gets them on the back; without, the studio line
and services), then:

```bash
pip install cairosvg pillow numpy segno uharfbuzz fonttools pypdf opencv-python-headless   # once
python3 business-cards/make.py                     # all cards, or name one: python3 business-cards/make.py evosoft-company
```

Ghostscript makes the CMYK copies with the ECI profile `ISOcoated_v2_300_eci.icc` (from eci.org, or
`apt install icc-profiles`; set `CMYK_PROFILE` to use a print shop's own). It uses Inter and Inter Display from `/usr/share/fonts/opentype/inter` (set
`INTER_DIR` for another folder) and the logo from `evosoft-site/assets/img/brand/logo-dark.svg`. The build stops if
anything important falls outside the safe area or the QR code doesn't read back.
