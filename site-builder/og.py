#!/usr/bin/env python3
"""The share image (evosoft-site/assets/img/og.jpg): black, the EvoSoft mark in 3D (assets/img/mark-3d.webp, rendered
in Blender), the slogan with "evolution" in neon yellow, the logo in the corner.

  python3 site-builder/og.py [Inter-SemiBold.otf]          (needs: pip install cairosvg pillow)
"""
import io, os, re, sys
from PIL import Image, ImageDraw, ImageFont
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'evosoft-site', 'assets', 'img')
FONT = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
BLACK, INK, YELLOW, BURGUNDY, DEEP = (5, 5, 5), (242, 242, 238), (238, 255, 0), (122, 0, 25), (62, 0, 13)
W, H = 1200, 630

def svg_png(svg, height=None, width=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_height=height, output_width=width))).convert('RGBA')

im = Image.new('RGBA', (W, H), BLACK + (255,))
# the mark in 3D (rendered in Blender: lacquered burgundy, neon-yellow edge light), large at the right
m = Image.open(os.path.join(IMG, 'mark-3d.webp')).convert('RGBA')
m = m.resize((int(m.width * 640 / m.height), 640), Image.LANCZOS)
im.alpha_composite(m, (W - m.width + 120, (H - m.height) // 2 - 6))
# a burgundy bar and a yellow square: the site's two colours, flat
d = ImageDraw.Draw(im)
d.rectangle((0, H - 14, W, H), fill=BURGUNDY + (255,))
d.rectangle((72, 152, 84, 164), fill=YELLOW + (255,))
fm = ImageFont.truetype('/usr/share/fonts/opentype/inter/Inter-Medium.otf', 18)
d.text((98, 148), 'SOFTWARE STUDIO IN GEORGIA', font=fm, fill=(180, 180, 174, 255))
# the slogan
f = ImageFont.truetype(FONT, 76)
d.text((70, 196), 'Your digital', font=f, fill=INK + (255,))
d.text((70, 284), 'evolution', font=f, fill=YELLOW + (255,))
d.text((70 + d.textlength('evolution', font=f), 284), ' starts here', font=f, fill=INK + (255,))
fs = ImageFont.truetype(FONT.replace('SemiBold', 'Medium'), 24)
d.text((72, 396), 'Websites, apps and business software, built to order.', font=fs, fill=(180, 180, 174, 255))
# the logo, white, top left
lg = svg_png(open(os.path.join(IMG, 'brand', 'logo-dark.svg')).read(), height=40 * 4)
lg = lg.resize((round(lg.width / 4), 40), Image.LANCZOS); im.alpha_composite(lg, (72, 66))
im.convert('RGB').save(os.path.join(IMG, 'og.jpg'), quality=90, optimize=True, progressive=True)
print('og.jpg written')
