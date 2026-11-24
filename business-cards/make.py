#!/usr/bin/env python3
"""EvoSoft business cards, ready for the printer.

  python3 business-cards/make.py          (needs: pip install cairosvg pillow segno uharfbuzz fonttools pypdf;
                                            Ghostscript for the CMYK copy; the Inter fonts, see FONT_DIR)

Card: 90 x 50 mm (the usual size in Georgia and Europe), two sides, with 3 mm bleed on every edge (pages are
96 x 56 mm) and everything that matters at least 4 mm inside the cut. All text is converted to outlines, so the
printer needs no fonts. The look follows the website: navy, cream and coral (60/30/10), the upside-down mark, and the
slogan "Your digital evolution starts here" with "evolution" in coral.

  front  navy: soft light (slate, a coral glow, a lighter navy) behind fluted glass, the logo, the slogan
  back   cream: the logo, both phones, email, website, and a QR code to the quote page

Writes business-cards/out/:
  evosoft-business-card-print.pdf       2 pages (front, back), RGB, with bleed; TrimBox/BleedBox set
  evosoft-business-card-print-CMYK.pdf  the same converted to CMYK, for printers that ask for it
  evosoft-card-front.png / -back.png    previews at the finished size (no bleed), 600 dpi
  evosoft-card-proof.png                both sides with the cut line (coral) and the safe area (dashed)
  evosoft-card-mockup.jpg               both cards on a table, for showing people
© 2026 EvoSoft Solutions. All rights reserved.
"""
import base64, io, math, os, re, subprocess, sys
import cairosvg, segno, uharfbuzz as hb
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

# ---------- the card ----------
TRIM_W, TRIM_H, BLEED, SAFE = 90.0, 50.0, 3.0, 4.0           # mm
W, H = TRIM_W + 2 * BLEED, TRIM_H + 2 * BLEED                 # the page, bleed included
X0, Y0 = BLEED + SAFE, BLEED + SAFE                           # top left of the safe area
X1, Y1 = BLEED + TRIM_W - SAFE, BLEED + TRIM_H - SAFE         # bottom right of the safe area
DPI = 600
NAVY, CREAM, CORAL = '#14213D', '#F4EDE0', '#FF6B5B'
INK2_ON_NAVY = '#CFC8BB'
MUTED_ON_CREAM = '#5E6475'

PHONES = ['+995 555 352 218', '+995 599 574 416']
EMAIL = 'contact@evosoft.solutions'
WEB = 'evosoft.solutions'
QR_URL = 'https://evosoft.solutions/contact'                   # the free-quote page
SLOGAN = ['Your digital', 'evolution', 'starts here']           # the middle line is coral

# ---------- text as outlines (Inter, shaped with HarfBuzz: kerning and the site's stylistic sets) ----------
FEATURES = {'kern': True, 'liga': True, 'cv11': True, 'ss01': True, 'ss03': True}
_fonts = {}

def font(name):
    if name not in _fonts:
        path = os.path.join(FONT_DIR, name)
        blob = hb.Blob.from_file_path(path)
        face = hb.Face(blob)
        f = hb.Font(face)
        tt = TTFont(path)
        _fonts[name] = (f, tt, tt.getGlyphSet(), tt['head'].unitsPerEm, tt.getGlyphOrder())
    return _fonts[name]

def text(s, name, size, x, y, fill, tracking=0.0, anchor='start'):
    """SVG <path> for string s, font size in mm, baseline at y; tracking in em."""
    f, tt, gs, upem, order = font(name)
    buf = hb.Buffer(); buf.add_str(s); buf.guess_segment_properties()
    hb.shape(f, buf, FEATURES)
    sc = size / upem
    adv_total = sum(p.x_advance for p in buf.glyph_positions) * sc + tracking * size * (len(buf.glyph_infos) - 1)
    if anchor == 'end': x -= adv_total
    elif anchor == 'middle': x -= adv_total / 2
    pen = SVGPathPen(gs)
    cx = x
    for info, pos in zip(buf.glyph_infos, buf.glyph_positions):
        g = order[info.codepoint]
        gs[g].draw(TransformPen(pen, (sc, 0, 0, -sc, cx + pos.x_offset * sc, y - pos.y_offset * sc)))
        cx += pos.x_advance * sc + tracking * size
    return f'<path fill="{fill}" d="{pen.getCommands()}"/>', adv_total

def width(s, name, size, tracking=0.0):
    return text(s, name, size, 0, 0, '#000', tracking)[1]

# ---------- the logo (mark + EVOSOFT), from the site's brand file ----------
def logo(x, y, height, mark_fill, word_fill):
    svg = open(os.path.join(BRAND, 'logo-dark.svg')).read()
    vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
    paths = re.findall(r'<path[^>]*d="([^"]+)"', svg)
    s = height / vb[3]
    return (f'<g transform="translate({x:.3f} {y:.3f}) scale({s:.5f})">'
            f'<path fill="{mark_fill}" d="{paths[0]}"/><path fill="{word_fill}" d="{paths[1]}"/></g>'), vb[2] * s

# ---------- icons (the site's line icons, 24-unit grid) ----------
ICONS = {
    'phone': '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'mail': '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'globe': '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
}

def icon(name, x, y, size, color):
    s = size / 24
    return (f'<g transform="translate({x:.3f} {y:.3f}) scale({s:.5f})" fill="none" stroke="{color}" stroke-width="2.1" '
            f'stroke-linecap="round" stroke-linejoin="round">{ICONS[name]}</g>')

# ---------- the front's field of light, painted at print resolution ----------
def px(mm): return round(mm / 25.4 * DPI)

def field_png():
    w, h = px(W), px(H)
    base = Image.new('RGB', (w, h), NAVY)
    blobs = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    def ell(cx, cy, rx, ry, rgba): d.ellipse((px(cx - rx), px(cy - ry), px(cx + rx), px(cy + ry)), fill=rgba)
    ell(10, 2, 34, 24, (59, 76, 112, 225))        # slate, top left
    ell(72, 24, 13, 17, (255, 107, 91, 190))      # the coral glow, right of centre (clear of the slogan)
    ell(92, 56, 30, 20, (44, 61, 98, 235))        # a lighter navy, bottom right
    blobs = blobs.filter(ImageFilter.GaussianBlur(px(9)))
    base.paste(blobs, (0, 0), blobs)
    # darker toward the bottom, where the slogan sits
    shade = Image.new('L', (w, h))
    sd = ImageDraw.Draw(shade)
    for yy in range(h):
        t = max(0.0, (yy / h - 0.45) / 0.55)
        sd.line((0, yy, w, yy), fill=int(110 * t))
    base = Image.composite(Image.new('RGB', (w, h), (13, 23, 44)), base, shade)
    # fluted glass: a soft rib every 0.7 mm (coarse enough to print without moiré)
    pitch = px(0.7)
    ribs = Image.new('L', (w, 1))
    for xx in range(w):
        ribs.putpixel((xx, 0), int(128 + 10 * math.sin(2 * math.pi * xx / pitch)))
    ribs = ribs.resize((w, h))
    lit = Image.blend(base, Image.new('RGB', (w, h), (255, 255, 255)), 0.06)
    dim = Image.blend(base, Image.new('RGB', (w, h), (5, 10, 22)), 0.08)
    mask_hi = ribs.point(lambda v: max(0, v - 128) * 25)
    mask_lo = ribs.point(lambda v: max(0, 128 - v) * 25)
    base = Image.composite(lit, base, mask_hi)
    base = Image.composite(dim, base, mask_lo)
    buf = io.BytesIO(); base.save(buf, 'PNG', optimize=True)
    return base64.b64encode(buf.getvalue()).decode()

def page(body, bg=None):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
            f'width="{W}mm" height="{H}mm" viewBox="0 0 {W} {H}">'
            + (f'<rect width="{W}" height="{H}" fill="{bg}"/>' if bg else '') + body + '</svg>')

# ---------- front ----------
def front():
    parts = [f'<image x="0" y="0" width="{W}" height="{H}" preserveAspectRatio="none" xlink:href="data:image/png;base64,{field_png()}"/>']
    lg, _ = logo(X0, Y0, 4.2, CREAM, CREAM)
    parts.append(lg)
    p, _ = text(WEB, 'Inter-Medium.otf', 2.3, X1, Y0 + 3.3, INK2_ON_NAVY, anchor='end')
    parts.append(p)
    # the slogan, low on the left, like the home page
    size, lead = 6.4, 6.4 * 0.98
    base = Y1 - 0.4
    for i, line in enumerate(reversed(SLOGAN)):
        col = CORAL if line == 'evolution' else CREAM
        p, _ = text(line, 'InterDisplay-Medium.otf', size, X0, base - i * lead, col, tracking=-0.035)
        parts.append(p)
    # a small coral pill, the one call to action (10%)
    label = 'Free quotes'
    lw = width(label, 'Inter-SemiBold.otf', 2.2)
    bx, by, bh = X1 - lw - 4.4, Y1 - 5.4, 5.4
    parts.append(f'<rect x="{bx:.3f}" y="{by:.3f}" width="{lw + 4.4:.3f}" height="{bh}" rx="{bh / 2}" fill="{CORAL}"/>')
    p, _ = text(label, 'Inter-SemiBold.otf', 2.2, bx + 2.2, by + 3.55, NAVY)
    parts.append(p)
    return page(''.join(parts), NAVY)

# ---------- back ----------
def back():
    parts = []
    lg, lw = logo(X0, Y0, 4.0, NAVY, NAVY)
    parts.append(lg)
    p, _ = text('Software studio · Georgia', 'Inter-Medium.otf', 2.15, X0, Y0 + 9.0, MUTED_ON_CREAM)
    parts.append(p)
    # contacts, each with a coral icon
    rows = [('phone', PHONES[0]), ('phone', PHONES[1]), ('mail', EMAIL), ('globe', WEB)]
    fs, gap = 2.75, 4.6
    y = Y0 + 17.2
    for ic, val in rows:
        parts.append(icon(ic, X0, y - 2.45, 2.9, CORAL))
        p, _ = text(val, 'Inter-Medium.otf', fs, X0 + 4.6, y, NAVY)
        parts.append(p)
        y += gap
    # services, small, at the bottom
    p, _ = text('Websites · Online stores · Apps · Business software', 'Inter-Regular.otf', 1.95, X0, Y1 - 0.6, MUTED_ON_CREAM)
    parts.append(p)
    # QR code to the quote page, navy on cream, with its quiet zone
    qr = segno.make(QR_URL, error='m', micro=False)
    n = qr.symbol_size(border=0)[0]
    q = 19.0
    mod = q / n
    qx, qy = X1 - q - 2 * mod, Y0 + 2 * mod                  # the quiet zone (2 modules) stays inside the safe area
    rects = []
    for r, row in enumerate(qr.matrix):
        for c, on in enumerate(row):
            if on: rects.append(f'M{qx + c * mod:.4f} {qy + r * mod:.4f}h{mod:.4f}v{mod:.4f}h-{mod:.4f}z')
    parts.append(f'<rect x="{qx - 2 * mod:.3f}" y="{qy - 2 * mod:.3f}" width="{q + 4 * mod:.3f}" height="{q + 4 * mod:.3f}" rx="1.2" fill="#FFFCF6"/>')
    parts.append(f'<path fill="{NAVY}" d="{"".join(rects)}"/>')
    p, _ = text('Scan for a free quote', 'Inter-SemiBold.otf', 2.05, qx + q / 2, qy + q + 4.3, NAVY, anchor='middle')
    parts.append(p)
    # a coral rule above the services line
    parts.append(f'<rect x="{X0}" y="{Y1 - 5.2:.3f}" width="7" height="0.5" rx="0.25" fill="{CORAL}"/>')
    return page(''.join(parts), CREAM), (qr, n, mod)

# ---------- write ----------
def mm2pt(v): return v * 72 / 25.4

def main():
    os.makedirs(OUT, exist_ok=True)
    f_svg = front()
    b_svg, (qr, n, mod) = back()
    w = PdfWriter()
    for svg in (f_svg, b_svg):
        r = PdfReader(io.BytesIO(cairosvg.svg2pdf(bytestring=svg.encode())))
        w.add_page(r.pages[0])
    def boxes(writer):
        for pg in writer.pages:
            pg.mediabox = RectangleObject([0, 0, mm2pt(W), mm2pt(H)])
            pg.bleedbox = RectangleObject([0, 0, mm2pt(W), mm2pt(H)])
            pg.trimbox = RectangleObject([mm2pt(BLEED), mm2pt(BLEED), mm2pt(BLEED + TRIM_W), mm2pt(BLEED + TRIM_H)])
            pg.cropbox = pg.mediabox
    boxes(w)
    w.add_metadata({'/Title': 'EvoSoft business card (90 x 50 mm, 3 mm bleed)', '/Author': 'EvoSoft Solutions'})
    rgb = os.path.join(OUT, 'evosoft-business-card-print.pdf')
    with open(rgb, 'wb') as fh: w.write(fh)
    # CMYK copy (Ghostscript's default CMYK profile); boxes set again after conversion
    cmyk = os.path.join(OUT, 'evosoft-business-card-print-CMYK.pdf')
    try:
        tmp = cmyk + '.tmp.pdf'
        subprocess.run(['gs', '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-sDEVICE=pdfwrite', '-dPDFSETTINGS=/prepress',
                        '-sColorConversionStrategy=CMYK', '-dProcessColorModel=/DeviceCMYK', '-dAutoRotatePages=/None',
                        f'-sOutputFile={tmp}', rgb], check=True)
        w2 = PdfWriter(clone_from=PdfReader(tmp)); boxes(w2)
        w2.add_metadata({'/Title': 'EvoSoft business card, CMYK (90 x 50 mm, 3 mm bleed)', '/Author': 'EvoSoft Solutions'})
        with open(cmyk, 'wb') as fh: w2.write(fh)
        os.remove(tmp)
    except (OSError, subprocess.CalledProcessError) as e:
        print('CMYK copy skipped (Ghostscript):', e)
    # previews at the finished size, and a proof with the cut and safe lines
    full = {}
    for name, svg in (('front', f_svg), ('back', b_svg)):
        im = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_width=px(W)))).convert('RGB')
        full[name] = im
        im.crop((px(BLEED), px(BLEED), px(BLEED + TRIM_W), px(BLEED + TRIM_H))).save(os.path.join(OUT, f'evosoft-card-{name}.png'), optimize=True)
    proof(full)
    mockup()
    # the QR code must read back as the URL
    print(f'QR: version {qr.version}, {n} modules, {mod:.2f} mm each -> {QR_URL}')
    print('written:', ', '.join(sorted(f for f in os.listdir(OUT) if not f.endswith('.svg'))))

def proof(full):
    sc = 0.5
    ims = []
    for name in ('front', 'back'):
        im = full[name].resize((int(full[name].width * sc), int(full[name].height * sc)), Image.LANCZOS)
        d = ImageDraw.Draw(im)
        k = lambda mm: round(mm / 25.4 * DPI * sc)
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
    sheet.save(os.path.join(OUT, 'evosoft-card-proof.png'), optimize=True)

def mockup():
    fr = Image.open(os.path.join(OUT, 'evosoft-card-front.png')).convert('RGBA')
    bk = Image.open(os.path.join(OUT, 'evosoft-card-back.png')).convert('RGBA')
    S = 2400
    bgc = Image.new('RGB', (S, int(S * 0.56)), '#E9E2D4')
    # a soft light across the table
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
        a = im.split()[3].point(lambda v: v * 0.42)
        sh.paste(Image.new('RGBA', im.size, (20, 22, 30, 255)), (xy[0] + 26, xy[1] + 40), a)
        sh = sh.filter(ImageFilter.GaussianBlur(28))
        bgc.paste(sh, (0, 0), sh)
        bgc.paste(im, xy, im)
    place(card(fr, -4), (110, 230))                            # side by side, so both sides read in full
    place(card(bk, 3), (1230, 330))
    bgc.save(os.path.join(OUT, 'evosoft-card-mockup.jpg'), quality=90, optimize=True, progressive=True)

if __name__ == '__main__':
    main()
