#!/usr/bin/env python3
"""A calm, modern background track for the EvoSoft ad, synthesized from scratch (no samples, no licences).

Warm pad chords, a soft plucked arpeggio, a round bass and light drums at 100 bpm, in C major
(Fmaj7 - G6 - Em7 - Am7). An intro with the pad only, the full groove under the narration, and a held
chord under the end card.

    python3 music.py --duration 126 --groove 5.2 --outro 118.5 --out music.wav
"""
import argparse
import wave

import numpy as np

SR = 48000
BPM = 100.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(7)
OFFSET = 0.0   # where the first bar line falls (s); set by --phase so a bar starts exactly on a scene cut


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


# chord tones (MIDI): pad voicing, arpeggio notes, bass root
CHORDS = [
    {"pad": [53, 57, 60, 64], "arp": [65, 69, 72, 76, 72, 69, 67, 69], "bass": 41},  # Fmaj7
    {"pad": [55, 59, 62, 64], "arp": [67, 71, 74, 76, 74, 71, 69, 71], "bass": 43},  # G6
    {"pad": [52, 55, 59, 62], "arp": [64, 67, 71, 74, 71, 67, 66, 67], "bass": 40},  # Em7
    {"pad": [52, 57, 60, 64], "arp": [64, 69, 72, 76, 72, 69, 67, 69], "bass": 45},  # Am7
]


def fft_filter(x, lo=None, hi=None, slope=2.0):
    """Static high/low-pass in the frequency domain (smooth Butterworth-like magnitude)."""
    n = len(x)
    X = np.fft.rfft(x, n)
    f = np.fft.rfftfreq(n, 1 / SR)
    H = np.ones_like(f)
    if hi:
        H *= 1 / np.sqrt(1 + (f / hi) ** (2 * slope))
    if lo:
        with np.errstate(divide="ignore"):
            H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-6)) ** (2 * slope))
    return np.fft.irfft(X * H, n)


def saw(freq, t, maxf=5000.0):
    """Band-limited sawtooth (additive)."""
    out = np.zeros_like(t)
    k = 1
    while k * freq < maxf and k <= 40:
        out += np.sin(2 * np.pi * k * freq * t) / k
        k += 1
    return out * 0.55


def adsr(n, a, r, sustain=1.0):
    env = np.full(n, sustain)
    na, nr = int(a * SR), int(r * SR)
    if na:
        env[:na] = np.linspace(0, sustain, na)
    if nr:
        env[-nr:] *= np.linspace(1, 0, nr)
    return env


def place(buf, sig, start):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def reverb(x, seconds=2.2, mix=0.28):
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = RNG.standard_normal(n) * np.exp(-t * 6.0 / seconds)
    ir = fft_filter(ir, hi=6000)
    ir /= np.sqrt(np.sum(ir ** 2))
    m = len(x) + n
    size = 1 << int(np.ceil(np.log2(m)))
    wet = np.fft.irfft(np.fft.rfft(x, size) * np.fft.rfft(ir, size), size)[: len(x)]
    return x * (1 - mix) + wet * mix * 0.9


def build(duration, groove_from, outro_from, break_from=None, break_bars=2):
    n = int((duration + 3) * SR)
    pad = np.zeros((2, n))
    arp = np.zeros((2, n))
    bass = np.zeros(n)
    drums = np.zeros((2, n))
    bars = int(np.ceil((duration + 3) / BAR))

    for b in range(bars):
        start = OFFSET + b * BAR
        if start >= outro_from:
            break
        ch = CHORDS[b % 4]
        # pad: each note = detuned saws per channel, slow swell
        length = BAR + 0.6
        t = np.arange(int(length * SR)) / SR
        env = adsr(len(t), 0.5, 0.7)
        for ci, det in enumerate((-0.07, 0.07)):
            s = np.zeros_like(t)
            for note in ch["pad"]:
                f = midi(note)
                s += saw(f * 2 ** (det / 12), t) + 0.6 * saw(f * 2 ** (-det / 12), t + 0.013)
            place(pad[ci], s * env * 0.05, start)
        if start + 0.01 < groove_from:
            continue
        # a two-bar breather in the middle (from any beat): pad and arpeggio only
        in_break = lambda tt: break_from is not None and break_from - 0.01 <= tt < break_from + break_bars * BAR - 0.01
        loop = b // 4
        # plucked arpeggio, eighth notes, ping-pong across the stereo field
        # every other loop the arpeggio turns around and climbs an octave on its last notes, so it doesn't repeat
        pattern = ch["arp"] if loop % 2 == 0 else ch["arp"][::-1][:6] + [n + 12 for n in ch["arp"][2:4]]
        for k, note in enumerate(pattern):
            nt = start + k * BEAT / 2
            if nt >= outro_from:
                break
            tt = np.arange(int(0.9 * SR)) / SR
            f = midi(note)
            tone = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt) + 0.08 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt / 0.22)
            tone *= adsr(len(tt), 0.004, 0.05)
            vel = 0.11 if k % 2 == 0 else 0.08
            pan = 0.35 if k % 2 == 0 else 0.65
            place(arp[0], tone * vel * (1 - pan) * 1.4, nt)
            place(arp[1], tone * vel * pan * 1.4, nt)
        # bass: root on 1 and the "and" of 2, round and short
        for pos, ln in ((0, 1.4), (1.5 * BEAT, 0.9), (2.5 * BEAT, 1.2)):
            if in_break(start + pos):
                continue
            tt = np.arange(int(ln * SR)) / SR
            f = midi(ch["bass"])
            tone = np.sin(2 * np.pi * f * tt) + 0.18 * np.sin(2 * np.pi * 2 * f * tt)
            tone = np.tanh(tone * 1.4) * adsr(len(tt), 0.01, 0.25)
            place(bass, tone * 0.16, start + pos)
        # drums: soft kick on 1 and 3, a snap on 2 and 4, a shaker on sixteenths
        for beat in range(4):
            bt = start + beat * BEAT
            if in_break(bt):
                continue
            if break_from is not None and bt >= break_from + break_bars * BAR and beat in (1, 3):
                # after the break: an open hat on the off-beats lifts the second half
                tt = np.arange(int(0.22 * SR)) / SR
                oh = fft_filter(RNG.standard_normal(len(tt)), lo=6000) * np.exp(-tt * 14)
                place(drums[0], oh * 0.022, bt + BEAT / 2)
                place(drums[1], oh * 0.022, bt + BEAT / 2 + 0.004)
            if beat in (0, 2):
                tt = np.arange(int(0.35 * SR)) / SR
                f = 48 + 70 * np.exp(-tt * 35)
                kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
                place(drums[0], kick * 0.30, bt)
                place(drums[1], kick * 0.30, bt)
            else:
                tt = np.arange(int(0.18 * SR)) / SR
                snap = fft_filter(RNG.standard_normal(len(tt)), lo=1200, hi=7000) * np.exp(-tt * 28)
                place(drums[0], snap * 0.07, bt)
                place(drums[1], snap * 0.07, bt + 0.006)
            for s16 in range(4):
                st = bt + s16 * BEAT / 4
                tt = np.arange(int(0.06 * SR)) / SR
                hat = fft_filter(RNG.standard_normal(len(tt)), lo=7000) * np.exp(-tt * 70)
                acc = 0.035 if s16 == 2 else 0.018
                place(drums[s16 % 2], hat * acc, st)

    # outro: one long Fmaj9 chord that rings under the end card
    t = np.arange(int((duration - outro_from + 3) * SR)) / SR
    env = adsr(len(t), 0.4, 2.5)
    for ci, det in enumerate((-0.07, 0.07)):
        s = np.zeros_like(t)
        for note in [41, 53, 57, 60, 64, 67]:
            s += saw(midi(note) * 2 ** (det / 12), t, maxf=3500)
        place(pad[ci], s * env * 0.05, outro_from)
    tt = np.arange(int(3.0 * SR)) / SR
    for k, note in enumerate([65, 69, 72, 76, 79]):
        f = midi(note)
        tone = (np.sin(2 * np.pi * f * tt) + 0.25 * np.sin(2 * np.pi * 2 * f * tt)) * np.exp(-tt / 0.6)
        place(arp[k % 2], tone * 0.09, outro_from + 0.15 + k * BEAT / 2)

    pad = np.stack([fft_filter(c, lo=90, hi=1700) for c in pad])
    arp = np.stack([fft_filter(c, lo=180, hi=5200) for c in arp])
    bass = fft_filter(bass, hi=900)
    # simple stereo delay on the arpeggio (dotted eighth)
    d = int(0.75 * BEAT * SR)
    echo = np.zeros_like(arp)
    echo[1, d:] += arp[0, :-d] * 0.32
    echo[0, 2 * d:] += arp[1, : -2 * d] * 0.2
    arp = arp + echo
    mix = pad * 1.0 + arp + drums + np.stack([bass, bass])
    mix = np.stack([reverb(c, 2.4, 0.3) for c in mix])
    mix = mix[:, : int(duration * SR)]
    # gentle glue: soft clip, then fades
    mix = np.tanh(mix * 1.3) / 1.3
    fade_in = int(1.2 * SR)
    mix[:, :fade_in] *= np.linspace(0, 1, fade_in)
    fade_out = int(1.2 * SR)
    mix[:, -fade_out:] *= np.linspace(1, 0, fade_out) ** 1.5
    peak = np.max(np.abs(mix))
    return mix / peak * 0.89


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--duration", type=float, required=True)
    ap.add_argument("--groove", type=float, default=5.0, help="when the beat and arpeggio come in (s)")
    ap.add_argument("--outro", type=float, required=True, help="when the final held chord starts (s)")
    ap.add_argument("--brk", type=float, default=None, help="start of a two-bar break without drums and bass (s)")
    ap.add_argument("--phase", type=float, default=0.0, help="a time (s) that must fall on a bar line")
    ap.add_argument("--out", default="music.wav")
    a = ap.parse_args()
    global OFFSET
    OFFSET = a.phase % BAR
    on_bar = lambda x: OFFSET + round((x - OFFSET) / BAR) * BAR
    groove = on_bar(a.groove)  # start on a bar line
    outro = on_bar(a.outro)
    brk = on_bar(a.brk) if a.brk is not None else None
    mix = build(a.duration, groove, outro, brk)
    data = (np.clip(mix.T, -1, 1) * 32767).astype("<i2")
    with wave.open(a.out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())
    print(f"wrote {a.out}: {a.duration:.1f}s, groove from {groove:.2f}s, outro from {outro:.2f}s")


if __name__ == "__main__":
    main()
