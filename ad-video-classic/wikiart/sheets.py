"""Contact sheets of WikiArt candidates per scene role (old-master styles only).
Styles (alphabetical): 4 Baroque, 8 Early Ren., 11 High Ren., 13 Mannerism, 15 Naive, 17 Northern Ren., 20 Post-Impr.,
21 Realism, 22 Rococo, 23 Romanticism, 24 Symbolism. Genres: 1 cityscape, 2 genre, 4 landscape, 6 portrait,
7 religious, 9 still life."""
import glob, io, json, os, sys

import numpy as np
import pyarrow.parquet as pq
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
OLD = {4, 8, 11, 13, 17, 22, 23}
ROLES = {
    'flowers': lambda s, g, st: g == 9 and s in {4, 17, 22} and st['dark'] > 0.45,
    'portrait': lambda s, g, st: g == 6 and s in {4, 17, 11, 22, 13},
    'romantic': lambda s, g, st: g == 4 and s == 23 and st['ar'] > 1.2,
    'night': lambda s, g, st: g in (4, 1) and s in {20, 23, 21} and st['mean'] < 0.33 and st['blue'] > 0.0,
    'group': lambda s, g, st: g in (2, 6, 7) and s in {4, 17} and st['ar'] > 1.25,
    'naive': lambda s, g, st: s == 15,
    'gold': lambda s, g, st: g == 4 and s in {20, 21, 23, 12} and st['yellow'] > 0.28 and st['ar'] > 1.2,
    'sea': lambda s, g, st: g == 4 and s in {23, 21} and st['ar'] > 1.3 and st['blue'] > 0.03,
}


def stats(im):
    a = np.asarray(im.convert('RGB').resize((64, 64)), dtype=np.float32) / 255
    lum = a.mean(-1)
    return {'mean': float(lum.mean()), 'dark': float((lum < 0.18).mean()), 'blue': float((a[..., 2] - a[..., 0]).mean()),
            'yellow': float(((a[..., 0] > 0.55) & (a[..., 1] > 0.45) & (a[..., 2] < 0.4)).mean()), 'ar': im.size[0] / im.size[1]}


role = sys.argv[1]
limit = int(sys.argv[2]) if len(sys.argv) > 2 else 60
picks = []
for f in sorted(glob.glob(os.path.join(HERE, 's*.parquet'))):
    t = pq.read_table(f)
    for i, (img, a, g, s) in enumerate(zip(t.column('image').to_pylist(), t.column('artist').to_pylist(), t.column('genre').to_pylist(), t.column('style').to_pylist())):
        if s not in OLD | {15, 20, 21, 12}:
            continue
        im = Image.open(io.BytesIO(img['bytes']))
        if max(im.size) < 1400:
            continue
        st = stats(im)
        if ROLES[role](s, g, st):
            picks.append((os.path.basename(f)[:-8], i, a, s, g, im.size, im.copy().convert('RGB')))
        if len(picks) >= limit:
            break
    if len(picks) >= limit:
        break
W, H = 300, 200
cols = 8
sheet = Image.new('RGB', (cols * W, ((len(picks) + cols - 1) // cols) * (H + 18)), 'white')
d = ImageDraw.Draw(sheet)
for k, (sh, i, a, s, g, size, im) in enumerate(picks):
    im.thumbnail((W, H))
    x, y = (k % cols) * W, (k // cols) * (H + 18)
    sheet.paste(im, (x + (W - im.size[0]) // 2, y))
    d.text((x + 4, y + H + 2), f'{sh}:{i} a{a} s{s} {size[0]}x{size[1]}', fill='black')
sheet.save(os.path.join(HERE, f'sheet-{role}.jpg'), quality=80)
json.dump([p[:6] for p in picks], open(os.path.join(HERE, f'sheet-{role}.json'), 'w'))
print(role, len(picks))
