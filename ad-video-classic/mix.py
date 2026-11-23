#!/usr/bin/env python3
"""Voice + music for the classical-art ad: places the voice lines at their times (timeline.json), dips the music
under them (held through short pauses), and writes vo.wav (voice track) and music-ducked.wav at 48 kHz.
    python3 -I mix.py   (then assemble.sh does the voice EQ/compression, loudness and encoding)"""
import json, os, wave

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
SR = 48000
DUCK_DB, MERGE, ATTACK, RELEASE = 8.0, 1.6, 0.15, 0.8


def read_wav(p):
    with wave.open(p) as w:
        a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32).reshape(-1, w.getnchannels()) / 32768
        return a.T, w.getframerate()


music, sr = read_wav(os.path.join(HERE, 'music.wav'))
assert sr == SR
N = music.shape[1]
vo = np.zeros(N, np.float32)
regions = []
for line, at in TL['vo'].items():
    a, r = sf.read(os.path.join(HERE, 'vo', f'{line}.wav'), dtype='float32')
    if a.ndim > 1:
        a = a.mean(1)
    a = resample_poly(a, SR, r).astype(np.float32)
    i = int(at * SR)
    vo[i:i + len(a)] += a[: N - i]
    regions.append([at, at + len(a) / SR])
regions.sort()
# merge lines with short pauses between them, so the music doesn't bob up and down
merged = [regions[0]]
for s, e in regions[1:]:
    if s - merged[-1][1] < MERGE:
        merged[-1][1] = e
    else:
        merged.append([s, e])
t = np.arange(N) / SR
db = np.zeros(N, np.float32)
for s, e in merged:
    k_in = np.clip((t - (s - ATTACK)) / ATTACK, 0, 1)
    k_out = np.clip(1 - (t - (e + 0.15)) / RELEASE, 0, 1)
    k = np.minimum(k_in, k_out)
    db = np.minimum(db, -DUCK_DB * k * k * (3 - 2 * k))
music = music * (10 ** (db / 20))[None, :]


def write(p, a):
    a = np.atleast_2d(a)
    with wave.open(p, 'wb') as w:
        w.setnchannels(a.shape[0]); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(a.T, -1, 1) * 32767).astype('<i2').tobytes())


write(os.path.join(HERE, 'vo.wav'), vo / max(1e-6, np.abs(vo).max()) * 0.9)
write(os.path.join(HERE, 'music-ducked.wav'), music)
print('voice passages', [(round(s, 2), round(e, 2)) for s, e in merged])
