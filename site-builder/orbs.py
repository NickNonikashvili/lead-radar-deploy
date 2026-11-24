#!/usr/bin/env python3
"""Images of the 3D spheres for the website, cut from the Blender sphere atlases the ad uses
(ad-video-classic/blender/sphere_atlas.py renders them: glossy blue, white, chrome, from every angle).

  python3 site-builder/orbs.py <atlas dir> [Inter-SemiBold.otf]

Writes into evosoft-site/assets/img/:
  orbs/blue.webp, pink.webp, white.webp, chrome.webp   sprite strips for the home page hero (orbs.js): 7 views around the front
                                            (every 20 degrees), seen from 10 degrees above (row 1) and below (row 2,
                                            for reflections in the floor), 128 px each
  orbs/head.webp                            a cluster of spheres on the glossy floor, behind the top of inner pages
  og.jpg                                    the share image: the slogan, the logo and the spheres
"""
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
IMG = os.path.join(HERE, '..', 'evosoft-site', 'assets', 'img')
ATLAS = sys.argv[1]
FONT = sys.argv[2] if len(sys.argv) > 2 else '/usr/share/fonts/opentype/inter/Inter-SemiBold.otf'
meta = json.load(open(os.path.join(ATLAS, 'atlas.json')))
PHI, TH = meta['phi'], meta['theta']
FRONT = [PHI.index(p) for p in (300, 320, 340, 0, 20, 40, 60)]
UP, DOWN = TH.index(10), TH.index(-10)

def tile(kind, i, j, size):
    T = meta['tiles'][kind]
    a = Image.open(os.path.join(ATLAS, f'atlas_{kind}.png')).convert('RGBA')
    t = a.crop((i * T, j * T, (i + 1) * T, (j + 1) * T)).resize((size, size), Image.LANCZOS)
    if kind == 'white':                      # the white material is rendered dim; lift it as the film does
        rgb = ImageEnhance.Brightness(t.convert('RGB')).enhance(1.4); t = Image.merge('RGBA', (*rgb.split(), t.split()[3]))
    return t

def strips():
    os.makedirs(os.path.join(IMG, 'orbs'), exist_ok=True)
    for kind in ('blue', 'pink', 'white', 'chrome'):
        S = 128
        out = Image.new('RGBA', (S * len(FRONT), S * 2), (0, 0, 0, 0))
        for k, i in enumerate(FRONT):
            out.paste(tile(kind, i, UP, S), (k * S, 0))
            out.paste(tile(kind, i, DOWN, S), (k * S, S))
        out.save(os.path.join(IMG, 'orbs', f'{kind}.webp'), quality=86, method=6)

def cluster(w, h, floor, spheres, refl=0.32):
    """spheres: (kind, x centre, radius, height above the floor, view index) -> RGBA image with floor reflections"""
    im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    for kind, x, r, lift, v in sorted(spheres, key=lambda s: s[2]):
        d = int(2.04 * r)
        cy = floor - r - lift
        # reflection: the view from below, flipped, fading with depth
        rf = tile(kind, FRONT[v], DOWN, d).transpose(Image.FLIP_TOP_BOTTOM)
        fade = Image.linear_gradient('L').resize((d, d)).point(lambda p: int((255 - p) * refl))
        ra = rf.split()[3].point(lambda p: p); ra = Image.composite(ra, Image.new('L', (d, d), 0), fade)
        rf.putalpha(Image.eval(ra, lambda p: p).point(lambda p: int(p)))
        rf.putalpha(Image.composite(rf.split()[3], Image.new('L', (d, d), 0), fade))
        im.alpha_composite(rf.filter(ImageFilter.GaussianBlur(1.2)), (int(x - d / 2), int(floor + r + lift - d / 2)))
        # soft contact shadow
        sh = Image.new('RGBA', (int(r * 2.6), int(r * 0.5)), (0, 0, 0, 0)); ImageDraw.Draw(sh).ellipse((0, 0, sh.width - 1, sh.height - 1), fill=(0, 0, 0, int(150 * max(0, 1 - lift / (3 * r)))))
        sh = sh.filter(ImageFilter.GaussianBlur(r * 0.12)); im.alpha_composite(sh, (int(x - sh.width / 2), int(floor - sh.height / 2)))
        im.alpha_composite(tile(kind, FRONT[v], UP, d), (int(x - d / 2), int(cy - d / 2)))
    return im

def head():
    sp = [('blue', 1180, 120, 0, 3), ('chrome', 1420, 70, 0, 2), ('pink', 980, 46, 0, 4), ('blue', 1560, 34, 140, 1),
          ('pink', 1310, 26, 0, 5), ('white', 1640, 52, 0, 2), ('chrome', 1080, 22, 210, 3), ('blue', 860, 18, 0, 4)]
    cluster(1800, 640, 470, sp).save(os.path.join(IMG, 'orbs', 'head.webp'), quality=84, method=6)

def og():
    W, H = 1200, 630
    bg = Image.new('RGB', (W, H), (4, 5, 8))
    d = ImageDraw.Draw(bg)
    # horizon glow and floor
    glow = Image.new('L', (W, H), 0); ImageDraw.Draw(glow).ellipse((380, 300, 1300, 560), fill=255)
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    bg = Image.composite(Image.new('RGB', (W, H), (22, 34, 66)), bg, glow.point(lambda p: int(p * 0.7)))
    pk = Image.new('L', (W, H), 0); ImageDraw.Draw(pk).ellipse((-200, 380, 520, 640), fill=255); pk = pk.filter(ImageFilter.GaussianBlur(110))
    bg = Image.composite(Image.new('RGB', (W, H), (70, 10, 48)), bg, pk.point(lambda p: int(p * 0.55)))
    im = bg.convert('RGBA')
    im.alpha_composite(cluster(W, H, 470, [('blue', 905, 108, 0, 3), ('chrome', 1085, 62, 0, 2), ('pink', 760, 40, 0, 4), ('blue', 1150, 30, 120, 1), ('white', 1010, 24, 0, 5), ('pink', 690, 18, 0, 4)]))
    # the slogan
    f1 = ImageFont.truetype(FONT, 64); dd = ImageDraw.Draw(im)
    dd.text((72, 180), 'Your digital', font=f1, fill=(238, 242, 248, 255))
    ew = int(dd.textlength('evolution', font=f1)); mask = Image.new('L', (ew + 10, 90), 0)
    ImageDraw.Draw(mask).text((0, 0), 'evolution', font=f1, fill=255)
    grad = Image.new('RGBA', mask.size)
    for x in range(mask.width):                  # electric blue -> violet -> neon pink, as on the website
        k = x / mask.width; c = [(110, 155, 255), (183, 132, 255), (255, 61, 154)]
        a, b, f = (c[0], c[1], k / 0.55) if k < 0.55 else (c[1], c[2], (k - 0.55) / 0.45)
        ImageDraw.Draw(grad).line([(x, 0), (x, 89)], fill=tuple(int(a[i] + (b[i] - a[i]) * f) for i in range(3)) + (255,))
    grad.putalpha(mask); im.alpha_composite(grad, (72, 258))
    dd.text((72 + ew, 258), ' starts here', font=f1, fill=(238, 242, 248, 255))
    fs = ImageFont.truetype(FONT.replace('SemiBold', 'Medium'), 24)
    dd.text((74, 360), 'Websites, apps and business software, built to order.', font=fs, fill=(150, 160, 178, 255))
    # the logo (white), top left
    import cairosvg, io
    svg = open(os.path.join(IMG, 'brand', 'logo-dark.svg')).read()
    lg = Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg.encode(), output_height=44 * 4))).convert('RGBA')
    lg = lg.resize((round(lg.width / 4), 44), Image.LANCZOS); im.alpha_composite(lg, (72, 72))
    im.convert('RGB').save(os.path.join(IMG, 'og.jpg'), quality=90, optimize=True, progressive=True)

if __name__ == '__main__':
    strips(); head(); og()
    print('orb sprites, head.webp and og.jpg written')
