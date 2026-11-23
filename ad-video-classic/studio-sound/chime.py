# A warm "the computer is ready" startup chord, in the spirit of the classic Mac chime but our own:
# D major spread over three octaves, detuned voices, a bright strike that blooms and rings out, with a hall reverb.
import numpy as np, scipy.io.wavfile as w, scipy.signal as sg
sr = 48000; L = 7.0; n = int(L * sr); t = np.arange(n) / sr
rng = np.random.default_rng(7)
notes = [(73.42, 0.95, 0.0), (110.0, 0.7, -0.15), (146.83, 0.75, 0.12), (185.0, 0.55, -0.3), (220.0, 0.55, 0.3), (293.66, 0.42, -0.45), (369.99, 0.34, 0.45), (440.0, 0.28, -0.2), (587.33, 0.14, 0.25)]
out = np.zeros((n, 2))
strike = 1 - np.exp(-t / 0.006)
bloom = 1 - np.exp(-t / 0.18)
for f, a, pan in notes:
    sig = np.zeros(n)
    for cents in (-6.5, 0.0, 6.0):
        fd = f * 2 ** (cents / 1200)
        ph = rng.uniform(0, 2 * np.pi)
        for k in range(1, 15):
            if fd * k > 12000: break
            amp = 1 / k ** 1.25
            dec = np.exp(-t * (0.28 + 0.17 * k))          # higher harmonics fade first: the tone softens as it rings
            env = strike * (0.55 + 0.45 * bloom) if k <= 3 else strike
            sig += amp * dec * env * np.sin(2 * np.pi * fd * k * t + ph * k)
    # a glassy strike on the upper notes
    if f > 200:
        for ratio, dk in ((2.76, 6.0), (5.4, 11.0)):
            sig += 0.18 * np.exp(-t * dk) * strike * np.sin(2 * np.pi * f * ratio * t)
    sig *= a / 3
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[:, 0] += sig * gl; out[:, 1] += sig * gr
# slow overall decay and a soft fade at the end
out *= np.exp(-t * 0.1)[:, None] * np.clip((L - t) / 0.8, 0, 1)[:, None]
# hall reverb: decaying noise, darker as it decays
ir_n = int(3.2 * sr); ti = np.arange(ir_n) / sr
ir = np.zeros((ir_n, 2))
for ch in range(2):
    noise = rng.standard_normal(ir_n) * np.exp(-ti * 6.9 / 2.8)
    b, a_ = sg.butter(2, 6000, 'lp', fs=sr); noise = sg.lfilter(b, a_, noise)
    ir[int(0.022 * sr):, ch] = noise[:ir_n - int(0.022 * sr)]
ir /= np.abs(ir).sum(0).max() / 30
wet = np.stack([sg.fftconvolve(out[:, c], ir[:, c])[:n] for c in range(2)], 1)
mix = out + 0.32 * wet
# a soft sub thump under the strike (felt more than heard)
thump = np.sin(2 * np.pi * (52 * t - 14 * t ** 2 / 2)) * np.exp(-t * 7) * strike * 0.35
mix += thump[:, None]
mix = np.tanh(mix / np.abs(mix).max() * 1.2) ; mix *= 0.89 / np.abs(mix).max()
w.write(__import__('os').path.join(__import__('os').path.dirname(__import__('os').path.abspath(__file__)), 'chime.wav'), sr, (mix * 32767).astype(np.int16))
print('chime.wav', L, 's; peak', round(float(np.abs(mix).max()), 3))
