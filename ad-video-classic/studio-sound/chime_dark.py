# The startup chord, darker: one big chord struck when the logo locks, like a computer powering on, but ominous.
# D minor with an added 9th, voiced low (D1 to E4), a brassy tone whose filter opens on the strike and closes as it
# rings, slow beating between detuned voices, a deep impact under it and a long dark hall. Our own sound, not Apple's.
import os, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
HERE = os.path.dirname(os.path.abspath(__file__))
sr = 48000; L = 7.5; n = int(L * sr); t = np.arange(n) / sr
rng = np.random.default_rng(11)
notes = [(36.71, 0.9, 0.0), (73.42, 1.0, 0.0), (110.0, 0.75, -0.25), (146.83, 0.7, 0.25), (174.61, 0.62, -0.4), (220.0, 0.45, 0.4), (329.63, 0.22, -0.1)]
strike = 1 - np.exp(-t / 0.004)
bloom = 1 - np.exp(-t / 0.25)
fc = 220 + 2600 * np.exp(-t * 2.2) + 500 * np.exp(-t * 0.4)       # brightness: opens on the hit, then darkens
out = np.zeros((n, 2))
for f, a, pan in notes:
    sig = np.zeros(n)
    for cents in (-9.0, 0.0, 8.0):
        fd = f * 2 ** (cents / 1200); ph = rng.uniform(0, 2 * np.pi)
        for k in range(1, 40):
            fk = fd * k
            if fk > 9000: break
            g = 1 / (1 + (fk / fc) ** 4)                             # 4-pole low-pass on each harmonic
            amp = (1 / k) * g * np.exp(-t * (0.12 + 0.02 * k))
            sig += amp * np.sin(2 * np.pi * fk * t + ph * k)
    sig *= strike * (0.45 + 0.55 * bloom) * a / 3
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[:, 0] += sig * gl; out[:, 1] += sig * gr
out *= (np.exp(-t * 0.28) * np.clip((L - t) / 1.2, 0, 1))[:, None]
# dark hall
ir_n = int(4.0 * sr); ti = np.arange(ir_n) / sr
ir = np.zeros((ir_n, 2))
for ch in range(2):
    nz = rng.standard_normal(ir_n) * np.exp(-ti * 6.9 / 3.6)
    b, a_ = sg.butter(2, 3200, 'lp', fs=sr); nz = sg.lfilter(b, a_, nz)
    ir[int(0.03 * sr):, ch] = nz[:ir_n - int(0.03 * sr)]
ir /= np.abs(ir).sum(0).max() / 30
wet = np.stack([sg.fftconvolve(out[:, c], ir[:, c])[:n] for c in range(2)], 1)
mix = out + 0.45 * wet
# the impact: a sub drop from 95 Hz to 30 Hz and a low noise crack
f_sub = 30 + 65 * np.exp(-t * 5)
sub = np.sin(2 * np.pi * np.cumsum(f_sub) / sr) * np.exp(-t * 2.2) * strike * 0.9
b, a_ = sg.butter(2, 700, 'lp', fs=sr)
crack = sg.lfilter(b, a_, rng.standard_normal(n)) * np.exp(-t * 18) * 1.6
mix += (sub + crack)[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.6); mix *= 0.9 / np.abs(mix).max()
w.write(os.path.join(HERE, 'chime_dark.wav'), sr, (mix * 32767).astype(np.int16))
print('chime_dark.wav', L, 's')
