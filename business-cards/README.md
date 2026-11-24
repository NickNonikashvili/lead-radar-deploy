# EvoSoft business cards

Two-sided cards in the website's look: navy, cream and coral, the upside-down mark, and the slogan
"Your digital evolution starts here". © 2026 EvoSoft Solutions. All rights reserved.

| | |
| --- | --- |
| Finished size | 90 × 50 mm (the usual size in Georgia and Europe) |
| Bleed | 3 mm on every edge (the PDF pages are 96 × 56 mm; TrimBox and BleedBox are set) |
| Safe area | everything important is at least 4 mm inside the cut |
| Text | converted to outlines: the printer needs no fonts |
| Front | navy: the logo, the slogan, a coral "Free quotes" pill, evosoft.solutions |
| Back | cream: both phones, email, website, and a QR code to the quote page (https://evosoft.solutions/contact) |
| Paper | any; matte or soft-touch 350–400 g/m² suits the soft light on the front |

## Send to the printer

- `out/evosoft-business-card-print.pdf`: page 1 is the front, page 2 the back. Most print shops take this one.
- `out/evosoft-business-card-print-CMYK.pdf`: the same in CMYK, for a shop that asks for CMYK (highest ink
  coverage 289%, under the usual 300% limit). Bright coral can come out a little softer on paper than on screen;
  ask for a proof if the colour matters.

`out/evosoft-card-front.png` and `-back.png` are previews at the finished size, `out/evosoft-card-proof.png` shows the
cut line (coral) and the safe area (dashed), and `out/evosoft-card-mockup.jpg` is for showing people.

The QR code opens the quote page at its clean address, which works once the new website (with its `.htaccess`
files) is on the server.

## Change it

Edit the details at the top of `make.py` (phones, email, website, QR link, slogan), then:

```bash
pip install cairosvg pillow segno uharfbuzz fonttools pypdf   # once; Ghostscript for the CMYK copy
python3 business-cards/make.py
```

It uses Inter and Inter Display from `/usr/share/fonts/opentype/inter` (set `INTER_DIR` to use another folder) and
the logo from `evosoft-site/assets/img/brand/logo-dark.svg`.
