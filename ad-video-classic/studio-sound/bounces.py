# Find each sphere's bounces in the logo reveal: track bright blobs frame to frame, a bounce is where a blob stops
# falling and starts rising. Output: frame, kind (blue/white), size, x position (for stereo pan).
import numpy as np, json
from PIL import Image
from scipy import ndimage as nd
F = 225
def blobs(i):
    a = np.asarray(Image.open(f'f{i:03d}.png').convert('RGB')).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    out = []
    for kind, m in (('blue', (b > 110) & (b > r + 45)), ('white', (r > 165) & (g > 165) & (b > 165) & (np.abs(r - b) < 40))):
        lab, n = nd.label(nd.binary_opening(m, iterations=1))
        for k in range(1, n + 1):
            ys, xs = np.nonzero(lab == k)
            if len(xs) < 5: continue
            out.append({'kind': kind, 'x': xs.mean(), 'y': ys.mean(), 'r': np.sqrt(len(xs) / np.pi), 'bottom': ys.max()})
    return out
frames = [blobs(i) for i in range(1, F + 1)]
tracks = []  # each: list of (frame, blob)
active = []
for fi, bl in enumerate(frames):
    used = set(); nxt = []
    for tr in active:
        f0, b0 = tr[-1]
        vy = (b0['y'] - tr[-2][1]['y']) if len(tr) > 1 else 0
        best, bd = None, 1e9
        for j, b in enumerate(bl):
            if j in used or b['kind'] != b0['kind']: continue
            d = np.hypot(b['x'] - b0['x'], b['y'] - (b0['y'] + vy)) + 2 * abs(b['r'] - b0['r'])
            if d < bd: best, bd = j, d
        if best is not None and bd < max(6, 0.9 * b0['r'] + 4):
            used.add(best); tr.append((fi, bl[best])); nxt.append(tr)
        else:
            tracks.append(tr)
    for j, b in enumerate(bl):
        if j not in used: nxt.append([(fi, b)])
    active = nxt
tracks += active
events = []
for tr in tracks:
    if len(tr) < 6: continue
    ys = np.array([b['y'] for _, b in tr]); fs = [f for f, _ in tr]
    vy = np.gradient(ys)
    for k in range(2, len(tr) - 2):
        if vy[k - 2] > 0.8 and vy[k - 1] > 0.3 and vy[k + 1] < -0.2 and ys[k] >= ys[k - 1] and ys[k] >= ys[k + 1]:
            b = tr[k][1]
            events.append({'frame': fs[k] + 1, 'kind': b['kind'], 'r': round(float(b['r']), 1), 'x': round(float(b['x']) / 480, 3), 'speed': round(float(vy[k - 2]), 2)})
events.sort(key=lambda e: e['frame'])
json.dump(events, open('bounces.json', 'w'), indent=0)
print(len(events), 'bounces'); print([(e['frame'], e['kind'][0], e['r'], e['speed']) for e in events])
