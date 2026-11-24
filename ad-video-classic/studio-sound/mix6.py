# Soundtrack for the one-take ad: "Furious Freak" (Kevin MacLeod, CC BY 3.0) from 28.2 s, a few sound accents on the
# camera's big moments, then the ominous logo-reveal sound design.
#   python3 -I mix6.py song.wav sfx_choice_dark.json outro_dark.wav out.wav
import sys, json, subprocess, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
song_p, choice_p, outro_p, out_p = sys.argv[1:5]
SR = 48000; START = 28.2; STORY = 969 / 30; TOTAL = STORY + 8.5
C = json.load(open(choice_p)); rng = np.random.default_rng(9)
def load(c):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', c['path'], '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    if 'start' in c: x = x[int(c['start'] * SR):int(c.get('end', c['start'] + 1) * SR)]
    x = x - x.mean(); f = min(len(x) // 4, int(0.004 * SR)); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x / (np.abs(x).max() + 1e-9)
def lp(x, fc): b, a = sg.butter(2, fc, 'lp', fs=SR); return sg.lfilter(b, a, x)
sr, s = w.read(song_p); assert sr == SR; s = s.astype(float) / 32768
NT = int(round(TOTAL * SR)); s = s[int(START * SR):int(START * SR) + NT]; s = np.pad(s, ((0, NT - len(s)), (0, 0)))
t = np.arange(len(s)) / SR
g = np.clip(t / 0.05, 0, 1)
# the hand-over: a long, even fade (in dB) that starts as the lights drain, sinks under the start of the logo reveal
# and is gone just before the X locks; the song also turns muffled, as if it were falling into the orb with the camera
LOCK = STORY + 128 / 30
F0, F1, F2 = 29.4, STORY, LOCK - 0.35                    # 0 dB -> -6 dB at the hand-over -> silence before the lock
u1 = np.clip((t - F0) / (F1 - F0), 0, 1); u2 = np.clip((t - F1) / (F2 - F1), 0, 1)
db = np.where(t < F1, -6 * u1 ** 1.5, -6 - 54 * u2 ** 2.0)
g *= 10 ** (np.maximum(db, -80) / 20); g[t >= F2] = 0
s *= g[:, None]
fc = np.where(t < 30.4, 18000.0, 18000.0 * (280 / 18000) ** (np.clip((t - 30.4) / (LOCK - 30.4), 0, 1) ** 0.6))
a1 = np.exp(-2 * np.pi * fc / SR)                         # two one-pole low-passes, cutoff sweeping 18 kHz -> 280 Hz
for ch in range(2):
    x = s[:, ch]; i0 = int(30.3 * SR); y1 = x[i0]; y2 = x[i0]
    for i in range(i0, len(x)):
        y1 = (1 - a1[i]) * x[i] + a1[i] * y1; y2 = (1 - a1[i]) * y1 + a1[i] * y2; x[i] = y2
loud = s[int(18 * SR):int(30 * SR)]
s *= 10 ** ((-15.5 - 20 * np.log10(np.sqrt((loud ** 2).mean()))) / 20)
fx = np.zeros_like(s)
def place(sig, t0, gain, pan=0.0, rate=1.0):
    if rate != 1.0: sig = sg.resample(sig, max(8, int(len(sig) / rate)))
    i = int(t0 * SR); j = min(len(fx), i + len(sig))
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    fx[i:j, 0] += sig[:j - i] * gain * gl; fx[i:j, 1] += sig[:j - i] * gain * gr
wh = [load(c) for c in C['whoosh']]
# through the website (5.78) and through the giant phone (9.56): air rushing past the lens, peaking on the pass
for t0, k in ((5.784, 0), (9.563, 1)):
    x = lp(wh[k], 3500); pk = np.argmax(np.abs(x)) / SR
    place(x, t0 - pk / 0.8, 0.35, 0.0, 0.8)
# time freezes (16.27): a falling, slowing whoosh into the silence and a low pulse while it hangs
x = lp(wh[2], 2500); place(x, 16.20, 0.4, 0.0, 0.45)
n = int(0.12 * SR); tt = np.arange(n) / SR
thump = np.sin(2 * np.pi * np.cumsum(48 + 30 * np.exp(-tt * 40)) / SR) * np.exp(-tt * 28)
for t0 in (16.45, 16.92): place(thump, t0, 0.35)
# the orb's heartbeat (lub-dub on each pulse) as the song sinks away
for k in range(4):
    t0 = 30.387 + k * 0.4724; place(thump, t0, 0.55); place(thump, t0 + 0.17, 0.38)
# passing the Mailtabs and StudyCat screens, and flying through the towers of orders
for t0, k, pan in ((12.85, 0, 0.5), (14.45, 1, -0.5), (21.88, 2, 0.0)):
    x = lp(wh[k], 3000); pk = np.argmax(np.abs(x)) / SR; place(x, t0 - pk / 0.9, 0.28, pan, 0.9)
# the store screen lands
place(thump, 19.05, 0.4)
# a low swell under the drain
x = lp(load(C['metal'][0])[:int(2.0 * SR)], 900); x = sg.resample(x, int(len(x) / 0.5))[::-1]
x = x[-int(2.2 * SR):] * np.linspace(0, 1, int(2.2 * SR)) ** 2; place(x / np.abs(x).max(), 27.0, 0.22)
# the drop (17.16): a deep boom under the music's explosion
boom = lp(load(C['boom'][0]), 900); place(boom, 17.15, 0.45, 0.0, 0.85)
# falling into the orb (31.8-32.28): a dark swallowing swell
x = lp(load(C['metal'][0])[:int(2.2 * SR)], 1500); x = sg.resample(x, int(len(x) / 0.55))[::-1]
x *= np.linspace(0, 1, len(x)) ** 2; place(x / np.abs(x).max(), 32.15 - len(x) / SR, 0.6)
# the logo reveal
sr2, o = w.read(outro_p); o = o.astype(float) / 32768
i = int(round(STORY * SR)); j = min(len(s), i + len(o))
out = s + fx * 0.9; out[i:j] += o[:j - i] * 0.8
lim = 10 ** (-1 / 20)
out = np.where(np.abs(out) > 0.7 * lim, np.sign(out) * (0.7 * lim + 0.3 * lim * np.tanh((np.abs(out) - 0.7 * lim) / (0.3 * lim))), out)
w.write(out_p, SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
print('mix', out_p, round(TOTAL, 3), 's; peak', round(20 * np.log10(np.abs(out).max()), 2), 'dBFS')
