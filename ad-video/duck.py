#!/usr/bin/env python3
"""Turns the music down under the narrator, from the narration's own word timings.

A sidechain compressor lets the music swell in every short pause between scenes and then snaps it back on the next
word, which is heard as pumping. Here the dips come from the timeline instead: the music goes down just before the
first word of a passage, stays down through pauses shorter than MERGE seconds, and comes back up slowly after the
last word (so the end card's chord plays at full level).
    python3 duck.py music.wav music-ducked.wav
"""
import json, os, sys, wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
NARR = os.environ.get('AD_NARR', 'narration')
DEPTH = 7.0         # dB under speech
INTRO_DEPTH = 3.0   # dB under the opening line, where the music is only a pad
MERGE = 2.0         # pauses shorter than this stay ducked
ATTACK, RELEASE, HOLD = 0.18, 0.9, 0.25


def regions():
    """Spoken passages [start, end, depth] from the timeline and each scene's word timings."""
    tl = json.load(open(os.path.join(HERE, 'comp', 'timeline.json')))
    out = []
    for bid, b in tl['beats'].items():
        p = os.path.join(HERE, NARR, f'{bid}.words.json')
        words = json.load(open(p))['words'] if os.path.exists(p) else []
        if words:
            out.append((b['narr_at'] + words[0]['s'], b['narr_at'] + words[-1]['e'], INTRO_DEPTH if bid == 'B1' else DEPTH))
    return sorted(out)


def curve(regs):
    """Gain in dB as control points: down before each passage, held through short pauses (gliding from one depth to the
    next), back up after the last word of a longer pause."""
    pts = [(0.0, 0.0)]
    for i, (s, e, d) in enumerate(regs):
        prev = regs[i - 1] if i else None
        if not prev or s - prev[1] >= MERGE:
            pts += [(s - ATTACK, 0.0), (s, -d)]
        else:
            pts.append((s, -d))          # a short pause: glide from the last depth to this one
        nxt = regs[i + 1] if i + 1 < len(regs) else None
        pts.append((e, -d))
        if not nxt or nxt[0] - e >= MERGE:
            pts += [(e + HOLD, -d), (e + HOLD + RELEASE, 0.0)]
    return pts


def main(src, dst):
    with wave.open(src) as w:
        sr, ch = w.getframerate(), w.getnchannels()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32).reshape(-1, ch) / 32768
    n = len(a)
    t = np.arange(n) / sr
    regs = regions()
    pts = curve(regs)
    db = np.interp(t, [p[0] for p in pts], [p[1] for p in pts]).astype(np.float32)
    # round the corners (a 120 ms moving average) so no change starts or stops abruptly
    k = int(0.12 * sr)
    db = np.convolve(np.pad(db, (k, k), mode='edge'), np.ones(k) / k, mode='same')[k:-k]
    g = (10 ** (db / 20)).astype(np.float32)[:, None]
    out = np.clip(a * g, -1, 1)
    with wave.open(dst, 'wb') as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((out * 32767).astype('<i2').tobytes())
    held = sum(1 for i in range(1, len(regs)) if regs[i][0] - regs[i - 1][1] < MERGE)
    print(f'ducked {len(regs)} passages ({held} pauses held), {regs[0][0]:.1f}-{regs[-1][1]:.1f}s')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
