#!/usr/bin/env python3
"""Depth maps for the paintings (Depth Anything V2, run locally with ONNX Runtime).
    python3 -I depth.py art/<key>.jpg [...]      -> art/<key>.depth.png (16-bit, white = near), plus a preview
The renderer pushes each painting back by its depth, so a moving camera sees real parallax."""
import os, sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = os.path.join(HERE, 'models/depth-base/onnx/model.onnx')
sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])
inp = sess.get_inputs()[0].name
MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


def depth(path, long_side=1036):
    im = Image.open(path).convert('RGB')
    w, h = im.size
    s = long_side / max(w, h)
    W, H = max(14, round(w * s / 14) * 14), max(14, round(h * s / 14) * 14)
    x = (np.asarray(im.resize((W, H), Image.BICUBIC), dtype=np.float32) / 255 - MEAN) / STD
    x = x.transpose(2, 0, 1)[None].astype(np.float32)
    d = sess.run(None, {inp: x})[0][0]
    d = (d - np.percentile(d, 1)) / max(1e-6, np.percentile(d, 99.5) - np.percentile(d, 1))
    d = np.clip(d, 0, 1)
    out = Image.fromarray((d * 65535).astype(np.uint16))
    # depth at 1024 px on the long side, slightly smoothed so the surface doesn't tear at edges
    out = out.resize((round(w * 1024 / max(w, h)), round(h * 1024 / max(w, h))), Image.BICUBIC)
    base = os.path.splitext(path)[0]
    out.save(base + '.depth.png')
    prev = Image.fromarray((np.asarray(out, dtype=np.float32) / 257).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0))
    prev.save(base + '.depth-preview.jpg', quality=80)
    return out.size


if __name__ == '__main__':
    for p in sys.argv[1:]:
        print(p, depth(p))
