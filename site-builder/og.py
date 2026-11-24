#!/usr/bin/env python3
"""The share image (evosoft-site/assets/img/og.jpg), drawn like the site's heroes: a navy field of soft light (slate
top left, a coral glow, deep navy bottom right) behind fluted glass, the slogan in cream with "evolution" in coral,
the logo in cream, and a coral pill.

  python3 site-builder/og.py [Inter-Medium.otf]          (needs: pip install cairosvg pillow)
"""
import io, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'evosoft-site', 'assets', 'img')
FONT = sys.argv[1] if len(sys.argv) > 1 else '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
NAVY, CREAM, CORAL = (20, 33, 61), (244, 237, 224), (255, 107, 91)
W, H = 1200, 630

def svg_png(svg, height=None, width=None):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_height=height, output_width=width))).convert('RGBA')

# the field: three blurred blobs on navy
im = Image.new('RGBA', (W, H), NAVY + (255,))
blobs = Image.new('RGBA', (W, H), (0, 0, 0, 0))
b = ImageDraw.Draw(blobs)
b.ellipse((-260, -320, 560, 420), fill=(59, 76, 112, 215))     # slate, top left
b.ellipse((560, 60, 900, 560), fill=CORAL + (175,))             # the coral glow
b.ellipse((760, 330, 1500, 1000), fill=(13, 23, 44, 230))       # deep navy, bottom right
im.alpha_composite(blobs.filter(ImageFilter.GaussianBlur(110)))
# a little darker toward the bottom
shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
sd = ImageDraw.Draw(shade)
for y in range(H):
    a = max(0, (y - H * 0.4) / (H * 0.6))
    sd.line((0, y, W, y), fill=(13, 23, 44, int(120 * a)))
im.alpha_composite(shade)
# fluted glass: a thin light rib and a soft dark groove every 6 px
flutes = Image.new('RGBA', (W, H), (0, 0, 0, 0))
fd = ImageDraw.Draw(flutes)
for x in range(0, W, 6):
    fd.line((x, 0, x, H), fill=(255, 255, 255, 14))
    fd.line((x + 4, 0, x + 4, H), fill=(5, 10, 22, 22))
im.alpha_composite(flutes)

d = ImageDraw.Draw(im)
# the logo, cream, top left
svg = open(os.path.join(IMG, 'brand', 'logo-dark.svg')).read().replace('#FFFFFF', '#F4EDE0')
lg = svg_png(svg, height=34 * 4)
lg = lg.resize((round(lg.width / 4), 34), Image.LANCZOS); im.alpha_composite(lg, (72, 62))
# a small label pill with a coral dot
fm = ImageFont.truetype(FONT, 19)
label = 'Software studio in Georgia'
lw = d.textlength(label, font=fm)
pill = Image.new('RGBA', (W, H), (0, 0, 0, 0))
ImageDraw.Draw(pill).rounded_rectangle((72, 196, 72 + lw + 50, 232), radius=18, fill=(244, 237, 224, 22), outline=(244, 237, 224, 46))
im.alpha_composite(pill)
d.ellipse((88, 210, 96, 218), fill=CORAL + (255,))
d.text((106, 202), label, font=fm, fill=(214, 208, 196, 255))
# the slogan
f = ImageFont.truetype(FONT, 92)
d.text((66, 252), 'Your digital', font=f, fill=CREAM + (255,))
d.text((66, 350), 'evolution', font=f, fill=CORAL + (255,))
d.text((66 + d.textlength('evolution ', font=f), 350), 'starts here', font=f, fill=CREAM + (255,))
fs = ImageFont.truetype(FONT.replace('Medium', 'Regular'), 25)
d.text((70, 490), 'Websites, apps and business software, built to order.', font=fs, fill=(214, 208, 196, 255))
# the coral pill, bottom right
fb = ImageFont.truetype(FONT.replace('Medium', 'SemiBold'), 23)
cta = 'Get a free quote  ↗'
cw = d.textlength(cta, font=fb)
x1, y1 = W - 72, H - 72
d.rounded_rectangle((x1 - cw - 60, y1 - 58, x1, y1), radius=29, fill=CORAL + (255,))
d.text((x1 - cw - 30, y1 - 44), cta, font=fb, fill=NAVY + (255,))
im.convert('RGB').save(os.path.join(IMG, 'og.jpg'), quality=90, optimize=True, progressive=True)
print('og.jpg written')
