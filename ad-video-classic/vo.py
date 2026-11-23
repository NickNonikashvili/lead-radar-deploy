#!/usr/bin/env python3
"""Voice for the classical-art ad, made locally with Kokoro (open model, no API).
    python3 vo.py [voice] [speed] [outdir]
Writes <outdir>/L1.wav ... and lines.json (text per line)."""
import json, os, sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
LINES = [
    "Every masterpiece begins with a single line.",
    "Yours might be a website,",
    "a store that never sleeps,",
    "or the software your business runs on.",
    "We build it to order, by hand, in Georgia,",
    "and hang it where the whole world can see.",
    "EvoSoft. Your idea, made into a masterpiece.",
]
voice = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
speed = float(sys.argv[2]) if len(sys.argv) > 2 else 0.9
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join(HERE, 'vo')
os.makedirs(out, exist_ok=True)
k = Kokoro(os.path.join(HERE, 'models/kokoro-v1.0.onnx'), os.path.join(HERE, 'models/voices-v1.0.bin'))
for i, line in enumerate(LINES, 1):
    samples, sr = k.create(line.replace('EvoSoft', 'Evo Soft'), voice=voice, speed=speed, lang='en-us')
    # trim leading/trailing silence, keep a short tail
    a = np.asarray(samples, dtype=np.float32)
    nz = np.nonzero(np.abs(a) > 0.01)[0]
    if len(nz):
        a = a[max(0, nz[0] - int(0.02 * sr)): min(len(a), nz[-1] + int(0.12 * sr))]
    sf.write(os.path.join(out, f'L{i}.wav'), a, sr)
    print(f'L{i}: {len(a) / sr:.2f}s  {line}')
json.dump({'voice': voice, 'speed': speed, 'lines': LINES}, open(os.path.join(out, 'lines.json'), 'w'), indent=1)
