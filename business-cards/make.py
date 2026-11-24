#!/usr/bin/env python3
"""EvoSoft business cards, ready for the printer.

  python3 business-cards/make.py          (needs: pip install cairosvg pillow numpy segno uharfbuzz fonttools pypdf;
                                            Ghostscript for the CMYK copy; the Inter fonts, see FONT_DIR)

Card: 90 x 50 mm (the usual size in Georgia and Europe), two sides, with 3 mm bleed on every edge (pages are
96 x 56 mm) and everything that matters at least 4 mm inside the cut. All text is converted to outlines, so the
printer needs no fonts. The look follows the website: navy, cream and coral (60/30/10) and the upside-down mark.

  front  navy: the mark, huge, lit from within and cut by the card's edges, behind fluted glass with a coral glow at
         its heart; the full logo top left; the slogan "Your digital evolution starts here" bottom left
  back   cream with a navy panel off the right edge that holds a QR code to the quote page; on the cream, who it is
         (the studio, or a person and their role) and how to reach them

Each entry in CARDS is one card (the same front, its own back). For each, business-cards/out/<slug>/ gets:
  <slug>-print.pdf        2 pages (front, back), RGB, with bleed; TrimBox/BleedBox set. Send this to the printer.
  <slug>-print-CMYK.pdf   the same converted to CMYK, for a printer that asks for CMYK
  <slug>-front.png, -back.png   previews at the finished size (no bleed)
  <slug>-proof.png        both sides with the cut line (coral) and the safe area (dashed)
  <slug>-mockup.jpg       both sides on a table, for showing people
The build stops if any text, logo or the QR code strays outside the safe area, or if the QR code doesn't read back.
© 2026 EvoSoft Solutions. All rights reserved.
"""
import base64, io, math, os, re, subprocess, sys
import cairosvg, segno, uharfbuzz as hb
import numpy as np
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image, ImageDraw, ImageFilter
from pypdf import PdfReader, PdfWriter
from pypdf.generic import RectangleObject

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
BRAND = os.path.join(HERE, '..', 'evosoft-site', 'assets', 'img', 'brand')
FONT_DIR = os.environ.get('INTER_DIR', '/usr/share/fonts/opentype/inter')

# ---------- the cards ----------
EMAIL = 'contact@evosoft.solutions'
WEB = 'evosoft.solutions'
QR_URL = 'https://evosoft.solutions/contact'                   # the free-quote page
SLOGAN = ['Your digital', 'evolution', 'starts here']           # the middle line is coral

CARDS = [
    {'slug': 'evosoft-company', 'title': 'EvoSoft business card',
     'phones': ['+995 555 352 218', '+995 599 574 416'], 'email': EMAIL},
    {'slug': 'evosoft-nikoloz-nonikashvili', 'title': 'EvoSoft business card: Nikoloz Nonikashvili',
     'name': 'Nikoloz Nonikashvili', 'role': 'Founder',
     'phones': ['+995 555 352 218'], 'email': EMAIL},
]

# ---------- the card's geometry and colours ----------
TRIM_W, TRIM_H, BLEED, SAFE = 90.0, 50.0, 3.0, 4.0           # mm
W, H = TRIM_W + 2 * BLEED, TRIM_H + 2 * BLEED                 # the page, bleed included
X0, Y0 = BLEED + SAFE, BLEED + SAFE                           # top left of the safe area
X1, Y1 = BLEED + TRIM_W - SAFE, BLEED + TRIM_H - SAFE         # bottom right of the safe area
DPI = 600
NAVY, CREAM, CORAL = '#14213D', '#F4EDE0', '#FF6B5B'
MUTED = '#5E6475'                                             # grey on cream (5:1)

def px(mm): return round(mm / 25.4 * DPI)

# ---------- text as outlines (Inter, shaped with HarfBuzz: kerning and the site's stylistic sets) ----------
FEATURES = {'kern': True, 'liga': True, 'cv11': True, 'ss01': True, 'ss03': True}
_fonts = {}

def font(name):
    if name not in _fonts:
        path = os.path.join(FONT_DIR, name)
        f = hb.Font(hb.Face(hb.Blob.from_file_path(path)))
        tt = TTFont(path)
        _fonts[name] = (f, tt.getGlyphSet(), tt['head'].unitsPerEm, tt.getGlyphOrder())
    return _fonts[name]

def text(s, name, size, x, y, fill, tracking=0.0, anchor='start'):
    """SVG <path> for string s, font size in mm, baseline at y; tracking in em. Returns (svg, width)."""
    f, gs, upem, order = font(name)
    buf = hb.Buffer(); buf.add_str(s); buf.guess_segment_properties()
    hb.shape(f, buf, FEATURES)
    sc = size / upem
    total = sum(p.x_advance for p in buf.glyph_positions) * sc + tracking * size * (len(buf.glyph_infos) - 1)
    if anchor == 'end': x -= total
    elif anchor == 'middle': x -= total / 2
    pen = SVGPathPen(gs)
    cx = x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        gs[order[info.codepoint]].draw(TransformPen(pen, (sc, 0, 0, -sc, cx + pos.x_offset * sc, y - pos.y_offset * sc)))
        cx += pos.x_advance * sc + tracking * size
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>', total

def width(s, name, size, tracking=0.0):
    return text(s, name, size, 0, 0, '#000', tracking)[1]

# ---------- the logo (mark + EVOSOFT) and the mark alone, from the site's brand file ----------
_logo_svg = open(os.path.join(BRAND, 'logo-dark.svg')).read()
_LOGO_VB = [float(v) for v in re.search(r'viewBox="([^"]+)"', _logo_svg).group(1).split()]
MARK_D, WORD_D = re.findall(r'<path[^>]*d="([^"]+)"', _logo_svg)[:2]
MARK_W, MARK_H = 69.11, 64.0                                  # the mark's box in the logo's units

def logo(x, y, height, fill):
    s = height / _LOGO_VB[3]
    return (f'<g transform="translate({x:.3f} {y:.3f}) scale({s:.5f})" fill="{fill}">'
            f'<path d="{MARK_D}"/><path d="{WORD_D}"/></g>'), _LOGO_VB[2] * s

def mark(x, y, height, fill):
    s = height / MARK_H
    return f'<path transform="translate({x:.3f} {y:.3f}) scale({s:.5f})" fill="{fill}" d="{MARK_D}"/>'

def page(body, bg=None):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">'
            + (f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else '') + body + '</svg>')

def render(svg, width_px, mode='RGB'):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=width_px))).convert(mode)

def b64png(im):
    buf = io.BytesIO(); im.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

def fluted(base):
    """Fluted glass: a soft rib every 0.7 mm (coarse enough to print without moire)."""
    w, h = base.size
    pitch = px(0.7)
    ribs = Image.new('L', (w, 1))
    for xx in range(w):
        ribs.putpixel((xx, 0), int(128 + 10 * math.sin(2 * math.pi * xx / pitch)))
    ribs = ribs.resize((w, h))
    lit = Image.blend(base, Image.new('RGB', (w, h), (255, 255, 255)), 0.06)
    dim = Image.blend(base, Image.new('RGB', (w, h), (5, 10, 22)), 0.08)
    base = Image.composite(lit, base, ribs.point(lambda v: max(0, v - 128) * 25))
    return Image.composite(dim, base, ribs.point(lambda v: max(0, 128 - v) * 25))

# ================= FRONT: the big mark =================
BIG_H = 62.0                                                  # taller than the card, so its tips are cut off
BIG_CX, BIG_CY = 68.5, 27.0                                   # centre of the mark's box, page mm
BIG_X = BIG_CX - BIG_H * MARK_W / MARK_H / 2
BIG_Y = BIG_CY - BIG_H / 2
GLOW_X = BIG_X + 34.55 * BIG_H / MARK_H                       # the heart of the mark, low in the V
GLOW_Y = BIG_Y + 42.0 * BIG_H / MARK_H

def lit_fill(w, h):
    """The big mark's own light: warm white at its heart, cream, then a cool slate toward the cut tips."""
    yy, xx = np.mgrid[0:h, 0:w]
    dist = np.hypot(xx / px(1) - GLOW_X, yy / px(1) - GLOW_Y)
    stops = [(0, (255, 241, 232)), (13, (244, 237, 224)), (28, (190, 196, 212)), (42, (104, 120, 156)), (56, (70, 86, 124))]
    col = np.empty((h, w, 3)); col[:] = stops[-1][1]
    for (d0, c0), (d1, c1) in reversed(list(zip(stops, stops[1:]))):
        t = np.clip((dist - d0) / (d1 - d0), 0, 1)[..., None]
        col = np.where((dist < d1)[..., None], np.array(c0) + (np.array(c1) - np.array(c0)) * t, col)
    return Image.fromarray(col.astype(np.uint8))

_front_field = None
def front_field():
    global _front_field
    if _front_field: return _front_field
    w, h = px(W), px(H)
    base = Image.new('RGB', (w, h), NAVY)
    blobs = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    def ell(cx, cy, rx, ry, rgba): d.ellipse((px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)), fill=rgba)
    ell(4, -2, 30, 20, (52, 68, 104, 200))                    # slate, top left, behind the logo
    ell(96, 60, 30, 18, (40, 57, 94, 220))                    # a lighter navy, bottom right
    ell(GLOW_X, GLOW_Y, 16, 16, (255, 107, 91, 225))          # the coral glow, behind the heart of the mark
    blobs = blobs.filter(ImageFilter.GaussianBlur(px(8)))
    base.paste(blobs, (0, 0), blobs)
    shade = Image.new('L', (w, h))                            # a little darker toward the bottom, under the slogan
    sd = ImageDraw.Draw(shade)
    for yy in range(h):
        sd.line((0, yy, w, yy), fill=int(90 * max(0.0, (yy / h - 0.40) / 0.60)))
    base = Image.composite(Image.new('RGB', (w, h), (12, 21, 41)), base, shade)
    # the mark, just behind the glass, with a soft halo in its own colour
    a = np.asarray(render(page(mark(BIG_X, BIG_Y, BIG_H, '#fff')), w, 'RGBA').split()[3], dtype=np.float32) / 255
    fill = np.asarray(lit_fill(w, h), dtype=np.float32)
    r = px(2.4)
    blur = lambda arr: np.asarray(Image.fromarray(arr.astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)), dtype=np.float32)
    ha = blur(a * 255) / 255
    lit = fill * a[..., None]
    hc = np.stack([blur(lit[..., i]) for i in range(3)], -1) / np.maximum(ha[..., None], 1e-3)
    ha = (ha * 0.38)[..., None]
    b = np.asarray(base, dtype=np.float32)
    b = b * (1 - ha) + hc * ha
    b = b * (1 - a[..., None]) + fill * a[..., None]
    _front_field = b64png(fluted(Image.fromarray(np.clip(b, 0, 255).astype(np.uint8))))
    return _front_field

def front(card):
    """(decoration, content): decoration may run off the edge, content must sit inside the safe area."""
    deco = [f'<image x="0" y="0" width="{W}" height="{H}" preserveAspectRatio="none" '
            f'xlink:href="data:image/png;base64,{front_field()}"/>']
    content = [logo(X0, Y0, 4.6, CREAM)[0]]
    size, lead = 3.5, 3.5 * 1.08
    for i, line in enumerate(reversed(SLOGAN)):
        content.append(text(line, 'InterDisplay-Medium.otf', size, X0, Y1 - 0.2 - i * lead,
                            CORAL if line == 'evolution' else CREAM, tracking=-0.02)[0])
    return deco, content

# ================= BACK: cream, with a navy panel holding the QR code =================
PANEL_X = 61.0                                                # the panel runs from here off the top, right, bottom
PANEL_CX = (PANEL_X + BLEED + TRIM_W) / 2                     # centre of the part of the panel left after trimming
QR_SIZE, QUIET = 18.0, 3                                      # the code in mm; cream modules around it
TAG_Y, TAG_SIZE = Y0 + 9.4, 2.15                              # the line under the logo (the QR tile lines up with it)

def qr_parts():
    qr = segno.make(QR_URL, error='m', micro=False)
    n = qr.symbol_size(border=0)[0]
    mod = QR_SIZE / n
    tile = QR_SIZE + 2 * QUIET * mod
    return qr, n, mod, PANEL_CX - tile / 2, TAG_Y - 0.727 * TAG_SIZE, tile

_panel_field = None
def panel_field():
    """The panel carries the front's light: fluted glass, and a coral glow from behind the code."""
    global _panel_field
    if _panel_field: return _panel_field
    qr, n, mod, tx, ty, tile = qr_parts()
    w, h = px(W - PANEL_X), px(H)
    base = Image.new('RGB', (w, h), NAVY)
    blobs = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    def ell(cx, cy, rx, ry, rgba):
        cx -= PANEL_X
        d.ellipse((px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)), fill=rgba)
    ell(PANEL_X + 34, -4, 22, 16, (52, 68, 104, 210))                 # slate, top right
    ell(PANEL_CX, ty + tile / 2, 12.5, 12.5, (255, 107, 91, 215))     # coral, behind the code
    base.paste(blobs.filter(ImageFilter.GaussianBlur(px(7))), (0, 0), blobs.filter(ImageFilter.GaussianBlur(px(7))))
    _panel_field = b64png(fluted(base))
    return _panel_field

def back(card):
    deco = [f'<rect x="{PANEL_X}" y="0" width="{W - PANEL_X:.3f}" height="{H}" fill="{NAVY}"/>',
            f'<image x="{PANEL_X}" y="0" width="{W - PANEL_X:.3f}" height="{H}" preserveAspectRatio="none" '
            f'xlink:href="data:image/png;base64,{panel_field()}"/>']
    content = []
    # the QR code: navy modules on a cream tile, its quiet zone inside the tile, and what it does under it
    qr, n, mod, tx, ty, tile = qr_parts()
    qx, qy = tx + QUIET * mod, ty + QUIET * mod
    cells = ''.join(f'M{qx + c * mod:.4f} {qy + r * mod:.4f}h{mod:.4f}v{mod:.4f}h-{mod:.4f}z'
                    for r, row in enumerate(qr.matrix) for c, on in enumerate(row) if on)
    content.append(f'<rect x="{tx:.3f}" y="{ty:.3f}" width="{tile:.3f}" height="{tile:.3f}" rx="1.3" fill="{CREAM}"/>')
    content.append(f'<path fill="{NAVY}" d="{cells}"/>')
    content.append(text('Scan for a free quote', 'Inter-SemiBold.otf', 2.0, PANEL_CX, ty + tile + 3.9, CREAM, anchor='middle')[0])
    # top of the cream side: the logo, then who it is
    content.append(logo(X0, Y0, 4.4, NAVY)[0])
    if card.get('name'):
        content.append(text(card['name'], 'Inter-SemiBold.otf', 3.3, X0, TAG_Y + 0.9, NAVY, tracking=-0.01)[0])
        content.append(text(card['role'], 'Inter-Medium.otf', 2.15, X0, TAG_Y + 4.4, MUTED)[0])
    else:
        content.append(text('Software studio · Georgia', 'Inter-SemiBold.otf', TAG_SIZE, X0, TAG_Y, NAVY)[0])
        content.append(text('Websites · Online stores · Apps · Business software', 'Inter-Regular.otf', 1.95, X0, Y0 + 12.7, MUTED)[0])
    # a short coral rule on the card's middle line, opening the contacts
    rule_w = width('PHONE', 'Inter-SemiBold.otf', 1.9, 0.09)
    content.append(f'<rect x="{X0}" y="{BLEED + TRIM_H / 2 - 0.25:.3f}" width="{rule_w:.3f}" height="0.5" fill="{CORAL}"/>')
    # bottom of the cream side: how to reach them; labels in a narrow column, the last line on the safe line
    LX, VX = X0, X0 + 10.5
    label = lambda s, y: content.append(text(s.upper(), 'Inter-SemiBold.otf', 1.9, LX, y, MUTED, tracking=0.09)[0])
    phones = card['phones']
    y = Y1 - 0.2 - 4.0 - 1.4 - len(phones) * 4.3              # so the web line sits 0.2 mm above the safe line
    label('Phone', y)
    for ph in phones:
        content.append(text(ph, 'Inter-SemiBold.otf', 3.0, VX, y, NAVY)[0])
        y += 4.3
    y += 1.4
    for lab, val in (('Email', card['email']), ('Web', WEB)):
        label(lab, y)
        content.append(text(val, 'Inter-Medium.otf', 2.55, VX, y, NAVY)[0])
        y += 4.0
    return deco, content

# ================= output =================
def mm2pt(v): return v * 72 / 25.4

def set_boxes(writer):
    for pg in writer.pages:
        pg.mediabox = RectangleObject([0, 0, mm2pt(W), mm2pt(H)])
        pg.bleedbox = RectangleObject([0, 0, mm2pt(W), mm2pt(H)])
        pg.trimbox = RectangleObject([mm2pt(BLEED), mm2pt(BLEED), mm2pt(BLEED + TRIM_W), mm2pt(BLEED + TRIM_H)])
        pg.cropbox = pg.mediabox

def check(card, sides):
    """Every content element inside the safe area, and the QR code reads back as the URL."""
    for name, (deco, content) in sides.items():
        a = render(page(''.join(content)), px(W), 'RGBA').split()[3]
        x0, y0, x1, y1 = a.getbbox()
        mm = lambda v: v / px(W) * W
        tol = 0.05                                            # one pixel of anti-aliasing at 600 dpi
        if not (mm(x0) >= X0 - tol and mm(y0) >= Y0 - tol and mm(x1) <= X1 + tol and mm(y1) <= Y1 + tol):
            sys.exit(f'{card["slug"]} {name}: content runs outside the safe area '
                     f'(x {mm(x0):.2f}..{mm(x1):.2f}, y {mm(y0):.2f}..{mm(y1):.2f} mm)')
    import cv2
    im = np.asarray(render(page(''.join(sides['back'][0] + sides['back'][1]), CREAM), px(W) // 2))[:, :, ::-1]
    data = cv2.QRCodeDetector().detectAndDecode(np.ascontiguousarray(im))[0]
    if data != QR_URL:
        sys.exit(f'{card["slug"]}: the QR code reads {data!r}, not {QR_URL}')

def build(card):
    slug, out = card['slug'], os.path.join(OUT, card['slug'])
    os.makedirs(out, exist_ok=True)
    sides = {'front': front(card), 'back': back(card)}
    check(card, sides)
    svgs = {'front': page(''.join(sum(sides['front'], [])), NAVY), 'back': page(''.join(sum(sides['back'], [])), CREAM)}
    w = PdfWriter()
    for s in ('front', 'back'):
        w.add_page(PdfReader(io.BytesIO(cairosvg.svg2pdf(bytestring=svgs[s].encode()))).pages[0])
    set_boxes(w)
    w.add_metadata({'/Title': f'{card["title"]} (90 x 50 mm, 3 mm bleed)', '/Author': 'EvoSoft Solutions'})
    rgb = os.path.join(out, f'{slug}-print.pdf')
    with open(rgb, 'wb') as fh: w.write(fh)
    cmyk = os.path.join(out, f'{slug}-print-CMYK.pdf')
    try:
        tmp = cmyk + '.tmp.pdf'
        subprocess.run(['gs', '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dPDFSETTINGS=/prepress',
                        '-sColorConversionStrategy=CMYK', '-dProcessColorModel=/DeviceCMYK', '-dAutoRotatePages=/None',
                        f'-sOutputFile={tmp}', rgb], check=True)
        w2 = PdfWriter(clone_from=PdfReader(tmp)); set_boxes(w2)
        w2.add_metadata({'/Title': f'{card["title"]}, CMYK (90 x 50 mm, 3 mm bleed)', '/Author': 'EvoSoft Solutions'})
        with open(cmyk, 'wb') as fh: w2.write(fh)
        os.remove(tmp)
    except (OSError, subprocess.CalledProcessError) as e:
        print('CMYK copy skipped (Ghostscript):', e)
    full = {}
    for s in ('front', 'back'):
        im = render(svgs[s], px(W))
        full[s] = im
        fin = im.crop((px(BLEED), px(BLEED), px(BLEED + TRIM_W), px(BLEED + TRIM_H)))
        fin.resize((1800, round(1800 * TRIM_H / TRIM_W)), Image.LANCZOS).save(os.path.join(out, f'{slug}-{s}.png'), optimize=True)
    proof(full, os.path.join(out, f'{slug}-proof.png'))
    mockup(os.path.join(out, f'{slug}-front.png'), os.path.join(out, f'{slug}-back.png'), os.path.join(out, f'{slug}-mockup.jpg'))
    print(f'{slug}: ok ({", ".join(sorted(os.listdir(out)))})')

def proof(full, path):
    ims = []
    for name in ('front', 'back'):
        im = full[name].resize((1280, round(1280 * H / W)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        k = lambda mm: round(mm * im.width / W)
        d.rectangle((k(BLEED), k(BLEED), k(BLEED + TRIM_W), k(BLEED + TRIM_H)), outline=CORAL, width=3)
        x0, y0, x1, y1 = k(X0), k(Y0), k(X1), k(Y1)
        for a in range(x0, x1, 24):
            d.line((a, y0, min(a + 12, x1), y0), fill='#8F96A6', width=2); d.line((a, y1, min(a + 12, x1), y1), fill='#8F96A6', width=2)
        for a in range(y0, y1, 24):
            d.line((x0, a, x0, min(a + 12, y1)), fill='#8F96A6', width=2); d.line((x1, a, x1, min(a + 12, y1)), fill='#8F96A6', width=2)
        ims.append(im)
    pad = 40
    sheet = Image.new('RGB', (ims[0].width + pad * 2, ims[0].height * 2 + pad * 3), '#D9D3C7')
    sheet.paste(ims[0], (pad, pad)); sheet.paste(ims[1], (pad, ims[0].height + pad * 2))
    sheet.save(path, optimize=True)

def mockup(front_png, back_png, path):
    fr, bk = Image.open(front_png).convert('RGBA'), Image.open(back_png).convert('RGBA')
    S = 2400
    bgc = Image.new('RGB', (S, int(S * 0.56)), '#E9E2D4')
    glow = Image.new('L', bgc.size, 0)
    ImageDraw.Draw(glow).ellipse((-400, -600, 1700, 900), fill=70)
    bgc = Image.composite(Image.new('RGB', bgc.size, '#F6F1E7'), bgc, glow.filter(ImageFilter.GaussianBlur(220)))
    cw = 1040
    def card(im, angle):
        im = im.resize((cw, int(cw * im.height / im.width)), Image.LANCZOS)
        m = Image.new('L', im.size, 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, im.width - 1, im.height - 1), radius=14, fill=255)
        im.putalpha(m)
        return im.rotate(angle, resample=Image.BICUBIC, expand=True)
    def place(im, xy):
        sh = Image.new('RGBA', bgc.size, (0, 0, 0, 0))
        sh.paste(Image.new('RGBA', im.size, (20, 22, 30, 255)), (xy[0] + 26, xy[1] + 40), im.split()[3].point(lambda v: v * 0.42))
        sh = sh.filter(ImageFilter.GaussianBlur(28))
        bgc.paste(sh, (0, 0), sh)
        bgc.paste(im, xy, im)
    place(card(fr, -4), (110, 230))
    place(card(bk, 3), (1230, 330))
    bgc.save(path, quality=90, optimize=True, progressive=True)

def main():
    only = sys.argv[1:]
    for card in CARDS:
        if not only or card['slug'] in only:
            build(card)
    qr, n, mod, *_ = qr_parts()
    print(f'QR: version {qr.version}, {n} modules, {mod:.2f} mm each, {QUIET}-module quiet zone -> {QR_URL}')

if __name__ == '__main__':
    main()
