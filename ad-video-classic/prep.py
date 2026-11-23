#!/usr/bin/env python3
"""Procedural textures and derived images for the classical-art ad.
    python3 -I prep.py      -> art/lines.png, art/lines_reveal.png, art/wood.jpg, art/stars.jpg, art/glow.png, art/giltframe.png"""
import os

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, 'art')
rng = np.random.default_rng(5)

# hands crop of the Creation of Adam (u0, v0, u1, v1) — must match scenes.js CROP_HANDS
CROP_HANDS = (0.219, 0.25, 0.539, 0.647)
GAP = (0.379, 0.448)


def gauss(a, s):
    return np.asarray(Image.fromarray(a.astype(np.float32)).filter(ImageFilter.GaussianBlur(s)), dtype=np.float32)


def blur(a, s):
    from scipy.ndimage import gaussian_filter
    return gaussian_filter(a.astype(np.float32), s)


def lines():
    im = Image.open(os.path.join(ART, 'creation_adam.jpg')).convert('L')
    w, h = im.size
    u0, v0, u1, v1 = CROP_HANDS
    box = (round(u0 * w), round(v0 * h), round(u1 * w), round(v1 * h))
    crop = im.crop(box)
    W = 2400
    crop = crop.resize((W, round(W * crop.size[1] / crop.size[0])), Image.BICUBIC)
    g = np.asarray(crop, dtype=np.float32) / 255
    # XDoG: difference of Gaussians, sharpened into pencil lines
    s, k, p, eps, phi = 2.2, 1.6, 22.0, 0.0, 9.0
    g1, g2 = blur(g, s), blur(g, s * k)
    d = (1 + p) * g1 - p * g2
    e = np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))
    ink = np.clip(1 - e, 0, 1)
    ink = np.clip((ink - 0.08) / 0.6, 0, 1) ** 0.8
    # light hatching texture so it reads as graphite
    grain = blur(rng.random(ink.shape).astype(np.float32), 0.7)
    ink *= 0.75 + 0.5 * grain
    ink = np.clip(ink, 0, 1)
    rgba = np.zeros(ink.shape + (4,), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 52, 50, 48
    rgba[..., 3] = (ink * 235).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(ART, 'lines.png'))
    # drawing order: outward from the gap between the fingertips, with a little wobble
    H_, W_ = ink.shape
    yy, xx = np.mgrid[0:H_, 0:W_].astype(np.float32)
    gx = (GAP[0] - u0) / (u1 - u0) * W_
    gy = (GAP[1] - v0) / (v1 - v0) * H_
    dist = np.hypot((xx - gx) / W_ * 1.0, (yy - gy) / W_ * 1.3)
    dist = dist / dist.max()
    wob = blur(rng.random(ink.shape).astype(np.float32), 30) * 0.18
    r = np.clip(dist * 0.85 + wob, 0, 1)
    r = (r - r.min()) / (r.max() - r.min())
    Image.fromarray((r * 250 + 2).astype(np.uint8), 'L').save(os.path.join(ART, 'lines_reveal.png'))
    print('lines', ink.shape)


def wood():
    W, H = 2048, 2048
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    planks = (xx // 340).astype(int)
    off = rng.random(8) * 1000
    tone = rng.uniform(0.85, 1.1, 8)
    n1 = blur(rng.random((H, W)).astype(np.float32), 2)
    n2 = blur(rng.random((H, W)).astype(np.float32), 18)
    # grain runs along each plank (vertical), wavy, with knots of darker figure
    warp = blur(rng.random((H, W)).astype(np.float32), 40) * 60
    grain = np.sin(((xx % 340) + warp + off[planks % 8]) * 0.11 + np.sin(yy * 0.004 + off[planks % 8]) * 3)
    fine = blur(rng.random((H, W)).astype(np.float32), (0.6, 6))
    base = 0.55 + 0.16 * grain + 0.5 * (fine - 0.5) + 0.25 * (n2 - 0.5) * 4
    base *= tone[planks % 8]
    seam = np.exp(-((xx % 340) / 2.5) ** 2) + np.exp(-((340 - xx % 340) / 2.5) ** 2)
    base *= 1 - 0.55 * seam
    c = np.stack([base * 0.36, base * 0.2, base * 0.11], -1)
    Image.fromarray(np.clip(c * 255, 0, 255).astype(np.uint8)).save(os.path.join(ART, 'wood.jpg'), quality=90)


def stars():
    W, H = 4096, 2304
    img = np.zeros((H, W, 3), np.float32)
    # faint nebula band
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    band = np.exp(-(((yy - H * 0.35) - (xx - W / 2) * 0.25) / (H * 0.22)) ** 2)
    neb = blur(rng.random((H // 4, W // 4)).astype(np.float32), 12)
    from scipy.ndimage import zoom
    neb = zoom(neb, 4, order=1)[:H, :W]
    img += (band * (neb - 0.45).clip(0) * 0.25)[..., None] * np.array([0.5, 0.45, 0.8])
    n = 9000
    xs, ys = rng.integers(0, W, n), rng.integers(0, H, n)
    br = rng.random(n) ** 6
    for x, y, b in zip(xs, ys, br):
        col = np.array([1, 0.95, 0.88]) if rng.random() < 0.7 else np.array([0.8, 0.88, 1])
        r = 1 if b < 0.6 else 2
        img[max(0, y - r + 1): y + r, max(0, x - r + 1): x + r] += col * (0.25 + 0.9 * b)
    img = np.clip(img, 0, 1)
    Image.fromarray((img * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)).save(os.path.join(ART, 'stars.jpg'), quality=92)


def glow():
    S = 512
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32)
    r = np.hypot(xx - S / 2, yy - S / 2) / (S / 2)
    a = np.clip(np.exp(-r * r * 5.5) + 0.35 * np.exp(-r * 2.2) * (1 - r).clip(0), 0, 1)
    rgba = np.zeros((S, S, 4), np.uint8)
    rgba[..., 0], rgba[..., 1], rgba[..., 2] = 255, 236, 200
    rgba[..., 3] = (a * 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(ART, 'glow.png'))


def giltframe():
    """A carved gilt frame (2400x1600, opening 1880x1080 in the middle), transparent inside."""
    W, H, B = 2400, 1600, 260
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    # distance from the outer edge, in the frame's width direction
    d = np.minimum.reduce([xx, W - 1 - xx, yy, H - 1 - yy])
    inside = d >= B
    t = np.clip(d / B, 0, 1)
    # moulding profile: outer round, a hollow, a beaded ridge, inner slope
    prof = 0.55 + 0.35 * np.sin(t * np.pi * 2.2) + 0.25 * np.exp(-((t - 0.62) / 0.05) ** 2) - 0.2 * np.exp(-((t - 0.85) / 0.06) ** 2)
    # light from the top-left: brighter on top/left faces
    side_top = (yy < xx * H / W) & (yy < (W - xx) * H / W)
    side_left = (xx < yy * W / H) & (xx < (H - yy) * W / H)
    light = np.where(side_top | side_left, 1.15, 0.78)
    # carved ornament: leafy noise along the hollow
    orn = blur(rng.random((H, W)).astype(np.float32), 3.5)
    orn = (orn - orn.mean()) / orn.std()
    carve = np.exp(-((t - 0.35) / 0.12) ** 2) * orn * 0.35 + np.exp(-((t - 0.75) / 0.04) ** 2) * np.sin((xx + yy) * 0.25) * 0.2
    v = np.clip(prof * light + carve, 0.05, 1.6)
    gold = np.stack([v * 0.93, v * 0.72, v * 0.36], -1)
    gold += np.clip(v - 1.0, 0, None)[..., None] * np.array([0.5, 0.45, 0.35])
    rgba = np.zeros((H, W, 4), np.uint8)
    rgba[..., :3] = np.clip(gold * 220, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(inside, 0, 255).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(os.path.join(ART, 'giltframe.png'))


if __name__ == '__main__':
    import sys
    for f in (sys.argv[1:] or ['lines', 'wood', 'stars', 'glow', 'giltframe']):
        globals()[f]()
    print('ok')
