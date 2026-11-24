# EvoSoft business cards

Two cards with the same front: the company card, and Nikoloz Nonikashvili's (Founder). © 2026 EvoSoft Solutions.
All rights reserved.

- **Front (navy):** the upside-down EvoSoft mark, huge and lit from within, cut by the card's edges, behind fluted
  glass with a coral glow at its heart; the full logo top left; "Your digital **evolution** starts here" bottom left.
- **Back (cream):** a navy panel off the right edge holds a QR code to the quote page
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
| Ink | highest total coverage in the CMYK files 288% (under the usual 300% limit) |
| Paper | matte or soft-touch, 350–400 g/m², suits the soft light on the front |

Send `<card>-print.pdf` (page 1 front, page 2 back). `<card>-print-CMYK.pdf` is the same in CMYK, for a shop that
asks for it. Bright coral and the light inside the big mark can come out a little softer on paper than on screen; ask
for a proof if colour matters. Each folder also has previews (`-front.png`, `-back.png`), a proof with the cut line
(coral) and safe area (dashed), and a mockup for showing people.

The QR code uses the site's clean address `/contact`, which works once the new website (with its `.htaccess` files)
is on the server.

## Change or add a card

Edit `CARDS` at the top of `make.py` (a card with `name` and `role` gets them on the back; without, the studio line
and services), then:

```bash
pip install cairosvg pillow numpy segno uharfbuzz fonttools pypdf opencv-python-headless   # once
python3 business-cards/make.py                     # all cards, or name one: python3 business-cards/make.py evosoft-company
```

Ghostscript makes the CMYK copies. It uses Inter and Inter Display from `/usr/share/fonts/opentype/inter` (set
`INTER_DIR` for another folder) and the logo from `evosoft-site/assets/img/brand/logo-dark.svg`. The build stops if
anything important falls outside the safe area or the QR code doesn't read back.
