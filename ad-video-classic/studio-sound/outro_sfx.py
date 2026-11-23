# Sound design for the client's 7.5 s logo reveal (+1 s hold): ball bounces placed on the detected bounce frames,
# a crystalline shimmer when the big spheres turn into shards, whooshes as the shards fly in, a crisp lock and the
# startup chime the moment the X assembles, soft ticks as the EVOSOFT letters land.
#   python3 -I outro_sfx.py sfx_choice.json      (recorded samples to use; anything missing falls back to a built sound)
import json, sys, os, numpy as np, scipy.io.wavfile as w, scipy.signal as sg
SR = 48000; LEN = 8.5; FPS = 30
HERE = os.path.dirname(os.path.abspath(__file__))
choice = json.load(open(sys.argv[1])) if len(sys.argv) > 1 else {}
rng = np.random.default_rng(3)
out = np.zeros((int(LEN * SR), 2))

def load(path, a=None, b=None):
    """mono float at 48 kHz (decoded with ffmpeg), optionally cut to [a, b] seconds"""
    import subprocess
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(float)
    if a is not None: x = x[int(a * SR):int((b or a + 1) * SR)]
    x = x - x.mean()
    fade = min(len(x) // 4, int(0.004 * SR)); x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    return x / (np.abs(x).max() + 1e-9)

def place(sig, t, gain=1.0, pan=0.0, rate=1.0):
    if rate != 1.0:
        sig = sg.resample(sig, max(8, int(len(sig) / rate)))
    i = int(t * SR); j = min(len(out), i + len(sig))
    if j <= i: return
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[i:j, 0] += sig[:j - i] * gain * gl; out[i:j, 1] += sig[:j - i] * gain * gr

# ---- built fallbacks ----
def tock(size):
    n = int(0.09 * SR); tt = np.arange(n) / SR
    f0 = 2600 / (0.6 + size)
    s = sum(a * np.sin(2 * np.pi * f0 * m * tt) * np.exp(-tt * d) for m, a, d in ((1, 1, 60), (2.32, 0.5, 90), (4.1, 0.25, 140)))
    s += 0.3 * rng.standard_normal(n) * np.exp(-tt * 400)
    return s / np.abs(s).max()
def whoosh(lenth=0.55, f0=500, f1=3500):
    n = int(lenth * SR); tt = np.arange(n) / SR
    noise = rng.standard_normal(n); y = np.zeros(n); seg = 512
    for i in range(0, n, seg):
        fc = f0 + (f1 - f0) * (i / n)
        b, a = sg.butter(2, [fc * 0.6, min(fc * 1.6, 20000)], 'bp', fs=SR); y[i:i + seg] = sg.lfilter(b, a, noise[i:i + seg])
    env = np.sin(np.pi * tt / lenth) ** 2
    return y * env / (np.abs(y * env).max() + 1e-9)
def shimmer():
    n = int(0.9 * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for k in range(14):
        f = rng.uniform(3000, 9000); t0 = rng.uniform(0, 0.35); m = tt > t0
        s[m] += np.sin(2 * np.pi * f * (tt[m] - t0)) * np.exp(-(tt[m] - t0) * rng.uniform(8, 18)) * rng.uniform(0.3, 1)
    return s / np.abs(s).max()
def lock_click():
    n = int(0.25 * SR); tt = np.arange(n) / SR
    s = rng.standard_normal(n) * np.exp(-tt * 260) * 0.8 + np.sin(2 * np.pi * (120 - 200 * tt) * tt) * np.exp(-tt * 22)
    return s / np.abs(s).max()

def sample(kind, i=0):
    c = choice.get(kind)
    if not c: return None
    c = c[i % len(c)]
    return load(c['path'], c.get('start'), c.get('end'))

# ---- bounces ----
BJ = next(p for p in (os.path.join(HERE, 'bounces.json'), os.path.join(HERE, '..', 'outro', 'bounces.json')) if os.path.exists(p))
ev = [e for e in json.load(open(BJ)) if e['speed'] >= 3.5 and e['frame'] < 126]
for i, e in enumerate(ev):
    size = e['r'] / 17
    s = sample('bounce', i)
    g = 0.18 + 0.5 * min(1, e['speed'] / 11) * (0.5 + 0.5 * size)
    rate = 1.25 - 0.45 * size + rng.uniform(-0.06, 0.06)            # small balls sound higher
    place(s if s is not None else tock(size), e['frame'] / FPS - 0.004, g, (e['x'] - 0.5) * 1.4, rate)
# ---- the spheres turn into shards (frames ~88-96) ----
s = sample('shimmer'); place(s if s is not None else shimmer(), 2.93, 0.35, 0.0)
# ---- shards fly in ----
for i, (t0, pan, ln) in enumerate(((3.22, -0.5, 0.62), (3.48, 0.55, 0.6), (3.78, -0.2, 0.55))):
    s = sample('whoosh', i)
    if s is not None: s = s[:int(ln * 1.6 * SR)]
    place(s if s is not None else whoosh(ln), t0, 0.45, pan)
# ---- the X locks (frame 128) and the chime blooms ----
LOCK = 128 / FPS
s = sample('lock'); place(s if s is not None else lock_click(), LOCK - 0.006, 0.55, 0.0)
s = sample('boom')
if s is not None: place(s, LOCK - 0.012, 0.42, 0.0, 0.85)   # weight under the lock
sr_c, ch = w.read(os.path.join(HERE, 'chime.wav')); ch = ch.astype(float) / 32768
i = int((LOCK + 0.01) * SR); j = min(len(out), i + len(ch)); out[i:j] += ch[:j - i] * 0.9
# ---- EVOSOFT letters land ----
for k, f in enumerate((150, 152, 155, 157, 159, 161, 164)):
    s = sample('tick', k)
    place(s if s is not None else tock(0.1), f / FPS, 0.12, -0.2 + k * 0.08, 1.4)
# end: a gentle fade over the last second (the picture fades to black)
tt = np.arange(len(out)) / SR
out *= np.clip((LEN - 0.05 - tt) / 1.2, 0, 1)[:, None] ** 1.3
out *= 0.9 / np.abs(out).max()
w.write(os.path.join(HERE, 'outro_sfx.wav'), SR, (out * 32767).astype(np.int16))
print('outro_sfx.wav written;', len(ev), 'bounces; samples used:', {k: len(v) for k, v in choice.items()})
