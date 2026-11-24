#!/usr/bin/env python3
"""The EvoSoft logo, generated from one source of truth.

The mark is the X/A star (traced from the master artwork and made exactly symmetric), shown upside down; the wordmark is EVOSOFT in
Inter ExtraBold, slightly tracked, converted to outlines, matched to the 3D logo reveal. Writes:

  site-builder/lib/logo.mjs                 inline SVGs the build puts in every page (colours come from CSS)
  evosoft-site/assets/img/brand/logo.svg    mark + wordmark for light backgrounds
  evosoft-site/assets/img/brand/logo-dark.svg  the same for dark backgrounds
  evosoft-site/assets/img/brand/mark.svg    the mark on its own
  evosoft-site/assets/img/brand/icon.svg    app icon: white mark on a black tile (also assets/img/icon.svg)
  evosoft-site/assets/img/brand/logo-1200.png
  evosoft-site/assets/img/{icon-180,icon-512,favicon-32}.png and evosoft-site/favicon.ico

Needs: pip install fonttools brotli cairosvg pillow; ImageMagick (`convert`) for favicon.ico; Inter ExtraBold from
@fontsource/inter 5.3.0 (pinned, so the wordmark never changes by itself):

  cd "$(mktemp -d)" && npm pack @fontsource/inter@5.3.0 && tar -xzf fontsource-inter-5.3.0.tgz
  python3 /path/to/site-builder/logo.py "$PWD/package/files/inter-latin-800-normal.woff2"
"""
import os, subprocess, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(HERE, '..', 'evosoft-site')
BRAND = os.path.join(SITE, 'assets', 'img', 'brand')

INK = '#111318'      # the logo's black
PAPER = '#FFFFFF'

# ---- the mark: three polygons in a 419.5 x 388.5 box, symmetric about x = 209.75 ----
MW, MH = 419.5, 388.5
_c = MW / 2
def _m(pts): return [(_c + dx, y) for dx, y in pts]
TIP, STEP_O, STEP_I, BASE, APEX, TOP_X, TOP_Y = 192.75, 86.8, 42.0, 265.7, 195.7, 15.4, 100.7
MARK = [
    _m([(-TIP, 388.45), (-STEP_O, BASE), (-STEP_I, BASE), (0, APEX), (STEP_I, BASE), (STEP_O, BASE), (TIP, 388.45), (TOP_X, TOP_Y), (-TOP_X, TOP_Y)]),
    _m([(-_c, 0), (-75.7, 163.8), (-34.4, 96.7)]),
    _m([(_c, 0), (34.4, 96.7), (75.7, 163.8)]),
]

def num(v, nd=2):
    s = '%.*f' % (nd, v)
    s = s.rstrip('0').rstrip('.') if '.' in s else s
    return '0' if s in ('-0', '') else s

FLIP = True           # the mark is shown upside down (the client's choice): mirrored top to bottom inside its box

def mark_d(scale, ox=0.0, oy=0.0):
    fy = (lambda y: MH - y) if FLIP else (lambda y: y)
    return ''.join('M' + 'L'.join(num(ox + x * scale) + ' ' + num(oy + fy(y) * scale) for x, y in p) + 'Z' for p in MARK)

# ---- the wordmark ----
WORD = 'EVOSOFT'
TRACK = 0.03           # extra space between letters, in ems (matches the reveal)
CAP_RATIO = 2.08       # mark height / cap height, as in the reveal
GAP = 0.62             # space between mark and word, in cap heights

def word_paths(font_path, cap_px, x0, baseline):
    f = TTFont(font_path)
    upm, cap = f['head'].unitsPerEm, f['OS/2'].sCapHeight
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f['hmtx']
    s = cap_px / cap
    x, ds = x0, []
    names = [cmap[ord(ch)] for ch in WORD]
    first_lsb = hmtx[names[0]][1]
    x -= first_lsb * s                      # the E's stem starts exactly at x0
    for i, n in enumerate(names):
        pen = SVGPathPen(gs, ntos=lambda v: num(v, 2))
        gs[n].draw(TransformPen(pen, (s, 0, 0, -s, x, baseline)))
        ds.append(pen.getCommands())
        x += hmtx[n][0] * s + (TRACK * upm * s if i < len(names) - 1 else 0)
    last = names[-1]
    adv, lsb = hmtx[last]
    glyf = f['glyf'][last] if 'glyf' in f else None
    xmax = glyf.xMax if glyf is not None and hasattr(glyf, 'xMax') else adv - lsb
    right = x - adv * s + xmax * s          # true right edge of the T
    return ''.join(ds), right

def lockup(font_path, height=64.0):
    """Mark + wordmark, `height` units tall. Returns (mark_d, word_d, width)."""
    scale = height / MH
    mw = MW * scale
    cap = height / CAP_RATIO
    x0 = mw + GAP * cap
    baseline = height / 2 + cap / 2
    wd, right = word_paths(font_path, cap, x0, baseline)
    return mark_d(scale), wd, right

def svg(view_w, view_h, body, extra=''):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {num(view_w)} {num(view_h)}" role="img" aria-label="EvoSoft"{extra}><title>EvoSoft</title>{body}</svg>'

def icon_svg(tile=INK, fg=PAPER, mark_w=44.0):
    s = mark_w / MW
    h = MH * s
    return svg(64, 64, f'<rect width="64" height="64" rx="14" fill="{tile}"/><path fill="{fg}" d="{mark_d(s, (64 - mark_w) / 2, (64 - h) / 2 + 0.6)}"/>')

def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as fh: fh.write(text)

def main(font_path):
    import cairosvg
    md, wd, W = lockup(font_path, 64.0)
    W = round(W + 0.5, 1)
    # inline versions: colours from CSS (.logo-x, .logo-word; .logo-tile on the small mark)
    logo_inline = f'<svg class="logo" viewBox="0 0 {num(W)} 64" aria-hidden="true" focusable="false"><path class="logo-x" d="{md}"/><path class="logo-word" d="{wd}"/></svg>'
    ms = 50.0 / MW     # as big as on the small favicon, so the A and its notch still read at 30 px
    mark_inline = (f'<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><rect width="64" height="64" rx="15" class="logo-tile"/>'
                   f'<path class="logo-x" d="{mark_d(ms, (64 - 50) / 2, (64 - MH * ms) / 2 + 0.6)}"/></svg>')
    write(os.path.join(HERE, 'lib', 'logo.mjs'),
          '// Generated by site-builder/logo.py: the EvoSoft logo as inline SVG (the X/A mark, and EVOSOFT in Inter ExtraBold converted to paths).\n'
          '// Colours come from CSS: .logo-x, .logo-word, .logo-tile.\n'
          f'export const logoInline = {repr_js(logo_inline)};\n'
          f'export const markInline = {repr_js(mark_inline)};\n'
          f'export const logoWidth = {num(W)};\n'
          f'export const markPath = {repr_js(mark_d(1))};\n'
          f'export const markBox = [{num(MW)}, {num(MH)}];\n')
    # files
    light = svg(W, 64, f'<path fill="{INK}" d="{md}"/><path fill="{INK}" d="{wd}"/>')
    dark = svg(W, 64, f'<path fill="{PAPER}" d="{md}"/><path fill="{PAPER}" d="{wd}"/>')
    mark = svg(MW, MH, f'<path fill="{INK}" d="{mark_d(1)}"/>')
    icon = icon_svg()
    write(os.path.join(BRAND, 'logo.svg'), light + '\n')
    write(os.path.join(BRAND, 'logo-dark.svg'), dark + '\n')
    write(os.path.join(BRAND, 'mark.svg'), mark + '\n')
    write(os.path.join(BRAND, 'icon.svg'), icon + '\n')
    write(os.path.join(SITE, 'assets', 'img', 'icon.svg'), icon + '\n')
    img = os.path.join(SITE, 'assets', 'img')
    cairosvg.svg2png(bytestring=light.encode(), write_to=os.path.join(BRAND, 'logo-1200.png'), output_width=1200)
    cairosvg.svg2png(bytestring=icon.encode(), write_to=os.path.join(img, 'icon-512.png'), output_width=512, output_height=512)
    cairosvg.svg2png(bytestring=icon.encode(), write_to=os.path.join(img, 'icon-180.png'), output_width=180, output_height=180)
    # small sizes: a bigger mark on the tile so it still reads at 16-32 px
    small = icon_svg(mark_w=50.0)
    tmp = []
    for px in (16, 32, 48):
        p = os.path.join(img, f'favicon-{px}.png')
        cairosvg.svg2png(bytestring=small.encode(), write_to=p, output_width=px, output_height=px)
        tmp.append(p)
    subprocess.run(['convert', *tmp, os.path.join(SITE, 'favicon.ico')], check=True)
    for p in tmp:
        if not p.endswith('favicon-32.png'): os.remove(p)
    # the share image (og.jpg) is drawn by og.py, with the slogan and the mark; og_logo() is kept for a light one
    print(f'logo {W} x 64; wrote logo.mjs, brand SVGs, PNG icons and favicon.ico (og.jpg: run og.py)')

def og_logo(light_svg, height=44, left=64, centre_y=72.5):
    """Redraw the logo in the top-left of the share image: clear that strip with each row's own background, then paste."""
    import io, cairosvg
    from PIL import Image
    path = os.path.join(SITE, 'assets', 'img', 'og.jpg')
    og = Image.open(path).convert('RGB')
    px = og.load()
    for y in range(40, 106):
        row = [px[x, y] for x in range(340, 640)]
        bg = tuple(round(sum(c[i] for c in row) / len(row)) for i in range(3))
        for x in range(40, 330): px[x, y] = bg
    big = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=light_svg.encode(), output_height=height * 4))).convert('RGBA')
    lk = big.resize((round(big.width / 4), height), Image.LANCZOS)
    og.paste(lk, (left, round(centre_y - height / 2)), lk)
    og.save(path, quality=90, optimize=True, progressive=True)

def repr_js(s):
    return '"' + s.replace('\\', '\\\\').replace('"', '\\"') + '"'

if __name__ == '__main__':
    if len(sys.argv) < 2: sys.exit(__doc__)
    main(sys.argv[1])
