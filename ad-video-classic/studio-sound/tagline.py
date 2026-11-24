# The end-screen line, "Your digital evolution starts here": the words rise in one after another out of a soft blur,
# centred above the EVOSOFT lockup, once the letters have landed. "evolution" is in the brand blue and glows as it lands.
# Writes a transparent PNG per frame for the extended logo reveal (9.5 s at 30 fps).
#   python3 tagline.py <outdir> [font.otf]
import sys, os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
OUT = sys.argv[1]; FONT = sys.argv[2] if len(sys.argv) > 2 else '/usr/share/fonts/opentype/inter/Inter-Medium.otf'
os.makedirs(OUT, exist_ok=True)
W, H, FPS, LEN = 1920, 1080, 30, 9.5
SS = 2                                    # draw at 2x, then scale down
SIZE, TRACK = 56, 1.6                     # px at 1080p, extra letter spacing in px
CX, BASE = 960, 318                       # centred on the lockup (x 366-1555), baseline above it (logo top is y 410)
T0, STAG, DUR, RISE = 5.85, 0.16, 0.55, 16
WORDS = [('Your', (255, 255, 255)), ('digital', (255, 255, 255)), ('evolution', (110, 155, 255)), ('starts', (255, 255, 255)), ('here', (255, 255, 255))]
font = ImageFont.truetype(FONT, SIZE * SS)
def text_w(s): return sum(font.getlength(c) + TRACK * SS for c in s) - TRACK * SS
space = font.getlength(' ') + TRACK * SS
total = sum(text_w(w) for w, _ in WORDS) + space * (len(WORDS) - 1)
x = CX * SS - total / 2
layout = []
for w, col in WORDS: layout.append((w, col, x)); x += text_w(w) + space
ascent, descent = font.getmetrics()
def word_img(w, col):
    im = Image.new('RGBA', (int(text_w(w) + 40 * SS), (ascent + descent) + 40 * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(im); xx = 20 * SS
    for ch in w: d.text((xx, 20 * SS), ch, font=font, fill=col + (255,)); xx += font.getlength(ch) + TRACK * SS
    return im
imgs = [word_img(w, c) for w, c, _ in layout]
ease = lambda k: 1 - (1 - k) ** 3
for f in range(int(LEN * FPS)):
    t = f / FPS
    frame = Image.new('RGBA', (W * SS, H * SS), (0, 0, 0, 0))
    for i, ((w, col, x0), im) in enumerate(zip(layout, imgs)):
        k = (t - T0 - i * STAG) / DUR
        if k <= 0: continue
        k = min(1, k); e = ease(k)
        a = int(255 * min(1, k * 1.6) * (0.92 if col == (255, 255, 255) else 1))
        blur = (1 - e) * 7 * SS
        wi = im.filter(ImageFilter.GaussianBlur(blur)) if blur > 0.3 else im
        r, g, b, al = wi.split(); al = al.point(lambda v: v * a // 255); wi = Image.merge('RGBA', (r, g, b, al))
        y = BASE * SS - ascent - 20 * SS + (1 - e) * RISE * SS
        if w == 'evolution':                      # a soft blue glow that swells as it lands and settles
            gk = max(0.0, math.sin(math.pi * min(1, k * 1.2))) * 0.9 + 0.35 * e
            glow = im.filter(ImageFilter.GaussianBlur(14 * SS)); gr, gg, gb, ga = glow.split()
            ga = ga.point(lambda v: int(v * gk * a / 255)); glow = Image.merge('RGBA', (gr, gg, gb, ga))
            frame.alpha_composite(glow, (int(x0 - 20 * SS), int(y)))
        frame.alpha_composite(wi, (int(x0 - 20 * SS), int(y)))
    frame.resize((W, H), Image.LANCZOS).save(os.path.join(OUT, f'{f:04d}.png'))
print('tagline frames:', int(LEN * FPS))
