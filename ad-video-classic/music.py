#!/usr/bin/env python3
"""Original score and sound design for the classical-art ad, synthesized from scratch (no samples, no licences).
D minor, 80 bpm: solo piano for the sketch, strings for the flowers, a soft beat with the 3D letters, a riser into
the gallery frame, a breakdown in space, a drop over the wheat field, silence in the dark, piano for the final
calligraphy and a major chord on the end card. Sections follow timeline.json.
    python3 -I music.py  -> music.wav (48 kHz stereo)"""
import json, os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TL = json.load(open(os.path.join(HERE, 'timeline.json')))
SR = 48000
DUR = TL['duration'] + 0.5
BEAT = 60 / TL['bpm']
BAR = 4 * BEAT
SC = TL['scenes']
RNG = np.random.default_rng(11)
N = int(DUR * SR)


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def t_(n):
    return np.arange(int(n * SR)) / SR


def place(buf, sig, start, gain=1.0):
    i = int(round(start * SR))
    if i < 0:
        sig, i = sig[-i:], 0
    j = min(buf.shape[-1], i + sig.shape[-1])
    if j <= i:
        return
    buf[..., i:j] += sig[..., : j - i] * gain


def fft_filter(x, lo=None, hi=None, slope=2.0):
    n = x.shape[-1]
    X = np.fft.rfft(x, n)
    f = np.fft.rfftfreq(n, 1 / SR)
    Hh = np.ones_like(f)
    if hi:
        Hh *= 1 / np.sqrt(1 + (f / hi) ** (2 * slope))
    if lo:
        with np.errstate(divide='ignore'):
            Hh *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * slope))
    return np.fft.irfft(X * Hh, n)


def reverb(x, seconds=2.8, mix=0.3, bright=6000):
    n = int(seconds * SR)
    tt = np.arange(n) / SR
    out = []
    for ch in range(x.shape[0]):
        ir = RNG.standard_normal(n) * np.exp(-tt * 6.9 / seconds)
        ir = fft_filter(ir, hi=bright)
        ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt(np.sum(ir ** 2))
        m = x.shape[1] + n
        size = 1 << int(np.ceil(np.log2(m)))
        wet = np.fft.irfft(np.fft.rfft(x[ch], size) * np.fft.rfft(ir, size), size)[: x.shape[1]]
        out.append(x[ch] * (1 - mix) + wet * mix)
    return np.stack(out)


def env(n, a, r, s=1.0):
    e = np.full(n, s)
    na, nr = min(n, int(a * SR)), min(n, int(r * SR))
    if na:
        e[:na] = np.linspace(0, s, na)
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


# ---------- instruments ----------
def piano(note, length=3.0, vel=0.5):
    f0 = midi(note)
    tt = t_(length)
    s = np.zeros_like(tt)
    B = 0.00035
    for k in range(1, 11):
        fk = k * f0 * np.sqrt(1 + B * k * k)
        if fk > 9000:
            break
        amp = (1 / k ** 1.25) * (1.0 if k == 1 else 0.85)
        s += amp * np.sin(2 * np.pi * fk * tt + k * 0.7) * np.exp(-tt * (0.9 + 0.55 * k) * (0.6 + f0 / 900))
    s *= env(len(tt), 0.004, 0.25)
    click = fft_filter(RNG.standard_normal(int(0.02 * SR)), lo=1500, hi=7000) * np.exp(-np.arange(int(0.02 * SR)) / SR * 220) * 0.15
    s[: len(click)] += click
    pan = np.clip((note - 60) / 30, -0.6, 0.6)
    return np.stack([s * (1 - pan) * vel, s * (1 + pan) * vel])


def strings(notes, length, vel=0.12, attack=1.2, release=1.4, bright=2200):
    tt = t_(length)
    out = np.zeros((2, len(tt)))
    for n in notes:
        f = midi(n)
        for ch, det in enumerate((-0.09, 0.09)):
            s = np.zeros_like(tt)
            for v in range(4):
                d = det * (v - 1.5) / 1.5 + RNG.uniform(-0.02, 0.02)
                ff = f * 2 ** (d / 12) * (1 + 0.003 * np.sin(2 * np.pi * 5.2 * tt + v))
                ph = 2 * np.pi * np.cumsum(ff) / SR
                s += sum(np.sin(k * ph) / k for k in range(1, 12) if k * f < 9000)
            out[ch] += s
    out = np.stack([fft_filter(c, hi=bright) for c in out])
    return out * env(len(tt), attack, release) * vel / max(1, len(notes))


def sub(note, length, vel=0.35):
    tt = t_(length)
    f = midi(note)
    s = np.tanh(1.6 * (np.sin(2 * np.pi * f * tt) + 0.2 * np.sin(4 * np.pi * f * tt))) * env(len(tt), 0.01, 0.3)
    return np.stack([s, s]) * vel


def kick(vel=0.6):
    tt = t_(0.45)
    f = 44 + 90 * np.exp(-tt * 30)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 7)
    click = fft_filter(RNG.standard_normal(len(tt)), lo=2500, hi=8000) * np.exp(-tt * 700) * 0.4
    s = s + click
    return np.stack([s, s]) * vel


def snap(vel=0.3):
    tt = t_(0.3)
    n = fft_filter(RNG.standard_normal(len(tt)), lo=1200, hi=7500) * np.exp(-tt * 18)
    body = np.sin(2 * np.pi * 190 * tt) * np.exp(-tt * 30) * 0.5
    s = n + body
    return np.stack([s, np.roll(s, 90)]) * vel


def hat(vel=0.08, open_=False):
    tt = t_(0.25 if open_ else 0.06)
    s = fft_filter(RNG.standard_normal(len(tt)), lo=7000) * np.exp(-tt * (12 if open_ else 80))
    return np.stack([s, s]) * vel


def noise_sweep(length, f0, f1, vel=0.25, rise=True):
    """A whoosh: band-passed noise whose centre sweeps from f0 to f1."""
    n = int(length * SR)
    x = RNG.standard_normal(n)
    out = np.zeros(n)
    seg = int(0.02 * SR)
    for i in range(0, n, seg):
        k = i / n
        fc = f0 * (f1 / f0) ** k
        part = x[max(0, i - seg): i + 2 * seg]
        y = fft_filter(part, lo=fc * 0.6, hi=fc * 1.6)
        out[i: i + seg] = y[seg: seg + seg][: len(out[i: i + seg])] if i >= seg else y[: seg][: len(out[i: i + seg])]
    e = np.linspace(0, 1, n) ** 2 if rise else np.exp(-np.linspace(0, 5, n))
    e *= env(n, 0.01, 0.05)
    s = out * e
    return np.stack([s, np.roll(s, 240)]) * vel


def boom(vel=0.6, length=2.2):
    tt = t_(length)
    s = np.sin(2 * np.pi * (38 + 30 * np.exp(-tt * 6)) * tt) * np.exp(-tt * 2.2)
    s += fft_filter(RNG.standard_normal(len(tt)), hi=400) * np.exp(-tt * 5) * 0.6
    return np.stack([s, s]) * vel


def shimmer(start, vel=0.06, count=14, spread=1.2, base=84):
    out = np.zeros((2, int((spread + 2.5) * SR)))
    for k in range(count):
        n = base + int(RNG.choice([0, 2, 4, 7, 9, 12, 14, 16, 19]))
        tt = t_(2.0)
        s = (np.sin(2 * np.pi * midi(n) * tt) + 0.3 * np.sin(2 * np.pi * midi(n) * 2.01 * tt)) * np.exp(-tt * 3.2) * env(len(tt), 0.003, 0.1)
        pan = RNG.uniform(-0.8, 0.8)
        place(out, np.stack([s * (1 - pan), s * (1 + pan)]), RNG.uniform(0, spread), vel)
    return out


def pencil(length, vel=0.08):
    """graphite on paper: scratchy noise in strokes"""
    n = int(length * SR)
    x = fft_filter(RNG.standard_normal(n), lo=1800, hi=7000)
    tt = np.arange(n) / SR
    strokes = 0.5 + 0.5 * np.sin(2 * np.pi * 2.6 * tt + 2 * np.sin(2 * np.pi * 0.7 * tt))
    grain = 0.6 + 0.4 * (RNG.random(n) > 0.5)
    s = x * strokes ** 2 * grain * env(n, 0.1, 0.3)
    return np.stack([s, s * 0.9]) * vel


def flutter(length=0.9, vel=0.2):
    n = int(length * SR)
    tt = np.arange(n) / SR
    x = fft_filter(RNG.standard_normal(n), lo=500, hi=5000)
    am = (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 14 * tt * (1 - 0.5 * tt / length)))) * np.exp(-tt * 3)
    s = x * am
    return np.stack([s, np.roll(s, 120)]) * vel


# ---------- score ----------
mus = np.zeros((2, N))     # music bus (ducked under the voice later)
sfx = np.zeros((2, N))     # sound effects (not ducked)
A0, A1 = SC['A']; D0 = SC['D'][0]; F0 = SC['F'][0]; H0 = SC['H'][0]; I0 = SC['I'][0]; J0 = SC['J'][0]; K0, K1 = SC['K']; L0 = SC['L'][0]; M0 = SC['M'][0]
# D minor: Dm(add9) - Bbmaj7 - F - C, one chord per bar
CH = [
    {'root': 38, 'pad': [50, 53, 57, 64], 'arp': [62, 65, 69, 76, 69, 65, 64, 65]},
    {'root': 34, 'pad': [46, 50, 53, 57], 'arp': [58, 62, 65, 69, 65, 62, 60, 62]},
    {'root': 41, 'pad': [48, 53, 57, 60], 'arp': [60, 65, 69, 72, 69, 65, 64, 65]},
    {'root': 36, 'pad': [48, 52, 55, 62], 'arp': [60, 64, 67, 74, 67, 64, 62, 64]},
]


def chord_at(t):
    return CH[int(t // BAR) % 4]


def in_(t, a, b):
    return a <= t < b


nbars = int(np.ceil(DUR / BAR))
for b in range(nbars):
    t0 = b * BAR
    ch = CH[b % 4]
    if t0 >= M0:
        break
    # strings from the flowers on, out in the dark, back for the last calligraphy
    if t0 + BAR > SC['B'][0] and not in_(t0, K0, L0) and t0 < M0:
        vol = 0.10 if t0 < D0 else 0.13
        if in_(t0, I0 - 0.1, J0):
            vol = 0.2
        place(mus, strings(ch['pad'], BAR + 1.4, vel=vol), t0)
    for k in range(8):
        nt = t0 + k * BEAT / 2
        # piano: sparse in the intro, arpeggio in the groove, sparse again at the end; none in the dark
        if in_(nt, K0, L0) or nt >= M0:
            continue
        if nt < D0 or nt >= L0:
            if k % 2:
                continue
            vel = 0.22 if nt < D0 else 0.2
        else:
            vel = 0.16 if k % 2 == 0 else 0.11
        place(mus, piano(ch['arp'][k], 2.6, vel), nt)
    # bass and drums: from the letters (D) to the dark (K), except the breakdown in space (I)
    for k in range(4):
        bt = t0 + k * BEAT
        groove = in_(bt, D0, I0) or in_(bt, J0, K0 + 0.75 * BEAT)
        if not groove:
            continue
        drop = in_(bt, J0, K0 + 0.75 * BEAT)
        if k in (0, 2):
            place(mus, kick(0.55 if not drop else 0.7), bt)
            place(mus, sub(ch['root'], BEAT * 1.6, 0.3), bt)
        if k in (1, 3):
            place(mus, snap(0.22 if bt < F0 else 0.3), bt)
        for s16 in range(4 if (bt >= F0 or drop) else 2):
            place(mus, hat(0.05 if s16 % 2 else 0.08), bt + s16 * BEAT / (4 if (bt >= F0 or drop) else 2))
        if drop and k in (1, 3):
            place(mus, hat(0.07, open_=True), bt + BEAT / 2)

# the build into the gallery frame: snare roll + riser
roll_s, roll_e = H0 + 0.6, I0
nroll = int((roll_e - roll_s) / (BEAT / 4))
for i in range(nroll):
    tt = roll_s + i * BEAT / 4
    place(mus, snap(0.05 + 0.2 * (i / nroll) ** 2), tt)
place(sfx, noise_sweep(I0 - H0 - 0.3, 300, 6000, vel=0.12), H0 + 0.3)
# end card: a D major chord rings out (the minor piece resolves)
place(mus, strings([50, 54, 57, 62, 66], DUR - M0 + 0.5, vel=0.2, attack=0.4, release=2.5, bright=3000), M0)
for i, n in enumerate([50, 57, 62, 66, 69, 74]):
    place(mus, piano(n, 4.5, 0.2), M0 + 0.25 + i * 0.12)

# ---------- sound design ----------
place(sfx, pencil(1.9, 0.07), A0 + 0.3)                       # the line being drawn
place(sfx, shimmer(4.0, vel=0.05, count=12, spread=0.6), 4.0)  # fingers touch
place(sfx, boom(0.35), SC['B'][0])                              # out of black into the flowers
place(sfx, noise_sweep(0.8, 200, 3000, vel=0.08), SC['C'][0] - 0.5)
place(sfx, noise_sweep(0.9, 300, 4000, vel=0.1), SC['E'][1] - 1.0)   # pull back from the painting
place(sfx, noise_sweep(0.6, 3000, 400, vel=0.12, rise=False), F0 - 0.1)  # whip into the red room
place(sfx, boom(0.4), F0)
place(sfx, noise_sweep(0.8, 400, 3000, vel=0.08), SC['F'][1] - 0.9)
place(sfx, flutter(0.9, 0.12), SC['G'][0] + 0.15)               # parchment flies in
place(sfx, boom(0.5, 3.0), I0)                                  # into space
place(sfx, shimmer(I0 + 1.0, vel=0.035, count=10, spread=1.8, base=88), I0 + 1.0)
place(sfx, noise_sweep(1.4, 200, 5000, vel=0.12), J0 - 0.4)     # the field rushes past
place(sfx, noise_sweep(1.2, 2500, 150, vel=0.08, rise=False), K0)
place(sfx, flutter(0.7, 0.08), L0 + 0.1)
place(sfx, shimmer(M0, vel=0.05, count=16, spread=1.0, base=86), M0)
place(sfx, boom(0.25, 2.5), M0)

mus = reverb(mus, 2.6, 0.28)
sfx = reverb(sfx, 1.8, 0.18)
mix = mus + sfx * 0.9
# fades
fi = int(0.3 * SR); mix[:, :fi] *= np.linspace(0, 1, fi)
fo = int(2.2 * SR); mix[:, N - fo:] *= np.linspace(1, 0, fo) ** 1.6
mix = np.tanh(mix * 1.2) / 1.2
mix = mix / np.max(np.abs(mix)) * 0.9

import wave
with wave.open(os.path.join(HERE, 'music.wav'), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes())
print(f'music.wav {DUR:.1f}s')
