# Ominous sound design for the client's logo reveal (7.5 s + 1 s hold). No sparkle: heavy bounces, a low drone that
# builds, a deep metallic hit when the spheres turn into shards, low air-pressure whooshes, a reversed swell sucking
# into the lock, then a deep impact and the dark startup chord as the X locks; low stamps as the letters land.
#   python3 -I outro_dark.py sfx_choice_dark.json   (recorded samples; run chime_dark.py first)
import json, sys, os, subprocess, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR = 48000; LEN = 8.5; FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
C = json.load(open(sys.argv[1]))
rng = np.random.default_rng(5)
out = np.zeros((int(LEN * SR), 2)); tt = np.arange(len(out)) / SR
LOCK = 128 / FPS

def load(path, a=None, b=None):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    if a is not None: x = x[int(a * SR):int((b or a + 1) * SR)]
    x = x - x.mean(); f = min(len(x) // 4, int(0.004 * SR)); x[:f] *= np.linspace(0, 1, f); x[-f:] *= np.linspace(1, 0, f)
    return x / (np.abs(x).max() + 1e-9)
def samp(kind, i=0):
    c = C[kind][i % len(C[kind])]; return load(c['path'], c.get('start'), c.get('end'))
def lp(x, fc, order=2):
    b, a = sg.butter(order, fc, 'lp', fs=SR); return sg.lfilter(b, a, x)
def place(sig, t, gain=1.0, pan=0.0, rate=1.0):
    if rate != 1.0: sig = sg.resample(sig, max(8, int(len(sig) / rate)))
    i = int(t * SR); j = min(len(out), i + len(sig))
    if j <= i or i < 0: return
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:j, 0] += sig[:j - i] * gain * gl; out[i:j, 1] += sig[:j - i] * gain * gr
def thump(f0=110, f1=45, dec=28, length=0.25):
    n = int(length * SR); t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * dec)

# ---- bounces: heavy balls on a hard floor (recorded clicks pitched down and darkened, plus a low body) ----
ev = [e for e in json.load(open(os.path.join(HERE, 'bounces.json'))) if e['speed'] >= 3.5 and e['frame'] < 126]
for i, e in enumerate(ev):
    size = e['r'] / 17; spd = min(1, e['speed'] / 11)
    t0 = e['frame'] / FPS - 0.004; pan = (e['x'] - 0.5) * 1.4
    s = lp(samp('bounce', i), 4500)
    place(s, t0, (0.12 + 0.3 * spd) * (0.5 + 0.5 * size), pan, 0.78 - 0.25 * size + rng.uniform(-0.04, 0.04))
    place(thump(130 - 50 * size, 40, 24), t0, (0.1 + 0.35 * spd) * (0.3 + 0.7 * size), pan)
# ---- a low drone that builds under everything and dies at the lock ----
drone = (np.sin(2 * np.pi * 36.71 * tt) + 0.7 * np.sin(2 * np.pi * 37.3 * tt + 1) + 0.35 * np.sin(2 * np.pi * 55.0 * tt)) * 0.5
drone += lp(rng.standard_normal(len(tt)), 140, 4) * 1.4
env = np.clip((tt - 0.2) / 4.0, 0, 1) ** 2 * np.clip((LOCK + 0.05 - tt) / 0.05, 0, 1)
out += (drone * env * 0.22)[:, None]
# ---- the spheres turn into shards: a deep metallic hit ----
place(lp(samp('metal'), 2500), 2.93, 0.42, 0.0, 0.5)
# ---- shards fly in: low air-pressure whooshes ----
for i, (t0, pan) in enumerate(((3.15, -0.5), (3.42, 0.55), (3.72, -0.2))):
    s = lp(samp('whoosh', i), 2200)[:int(1.1 * SR)]
    place(s, t0, 0.5, pan, 0.62)
# ---- reversed swell sucking into the lock (a reversed, pitched-down boom ending exactly on the lock) ----
rev = lp(samp('metal'), 1800)[:int(2.4 * SR)]
rev = sg.resample(rev, int(len(rev) / 0.55))[::-1]
rev *= np.linspace(0, 1, len(rev)) ** 1.6
place(rev, LOCK - len(rev) / SR, 0.5, 0.0)
# a filtered-noise riser over the last 1.3 s
n = int(1.3 * SR); r = rng.standard_normal(n); y = np.zeros(n); seg = 480
for k in range(0, n, seg):
    fc = 180 + 1400 * (k / n) ** 2; b, a = sg.butter(2, fc, 'lp', fs=SR); y[k:k + seg] = sg.lfilter(b, a, r[k:k + seg])
y *= np.linspace(0, 1, n) ** 2
place(y / np.abs(y).max(), LOCK - 1.3, 0.28, 0.0)
# ---- the X locks: deep impact + the dark startup chord ----
place(lp(samp('boom'), 1200), LOCK - 0.01, 0.85, 0.0, 0.8)
place(lp(samp('timp'), 1500), LOCK - 0.005, 0.7, 0.0, 0.63)
sr_c, ch = w.read(os.path.join(HERE, 'chime_dark.wav')); ch = ch.astype(float) / 32768
i = int(LOCK * SR); j = min(len(out), i + len(ch)); out[i:j] += ch[:j - i] * 0.95
# ---- EVOSOFT letters land: low stamps ----
for k, f in enumerate((150, 152, 155, 157, 159, 161, 164)):
    place(thump(95, 50, 35, 0.18), f / FPS, 0.16, -0.3 + k * 0.1)
    place(lp(samp('bounce', k + 3), 1800), f / FPS, 0.06, -0.3 + k * 0.1, 0.6)
out *= np.clip((LEN - 0.05 - tt) / 1.3, 0, 1)[:, None] ** 1.3
out = np.tanh(out / np.abs(out).max() * 1.3); out *= 0.9 / np.abs(out).max()
w.write(os.path.join(HERE, 'outro_dark.wav'), SR, (out * 32767).astype(np.int16))
print('outro_dark.wav written;', len(ev), 'bounces')
