# Music for the ad with the logo-reveal outro: the reel's song with a beat-aligned jump so that its
# stop-and-drop (23.18 s in the song) hits when the 3D X locks (outro frame 130), then a fade under the held lockup.
import numpy as np, scipy.io.wavfile as w, scipy.signal as sg, json, sys
sr, a = w.read('artad2/rec.wav'); a = a.astype(np.float32) / 32768
mono = a.mean(1)
B = lambda k: 2.36 + k * 0.4731
def onset(t0, win=0.06):
    """time of the strongest attack within +-win of t0 (high-passed energy rise)"""
    hp = sg.sosfilt(sg.butter(4, 2000, 'hp', fs=sr, output='sos'), mono[int((t0 - 0.2) * sr):int((t0 + 0.2) * sr)])
    e = np.convolve(hp ** 2, np.ones(96) / 96, 'same'); d = np.diff(e, prepend=e[0])
    i0, i1 = int((0.2 - win) * sr), int((0.2 + win) * sr)
    return t0 - 0.2 + (i0 + np.argmax(d[i0:i1])) / sr
P1g, P2g = B(49), B(49 - 32)
P1, P2 = onset(P1g), onset(P2g)
# drop after the silence near 23.0-23.3
seg = mono[int(22.8 * sr):int(23.5 * sr)]; env = np.convolve(seg ** 2, np.ones(240) / 240, 'same')
quiet = np.where(env < env.max() * 1e-3)[0]
drop = 22.8 + (quiet[-1] if len(quiet) else 0) / sr
drop = onset(drop + 0.01, 0.04)
shift = P1 - P2
# refine: the shift whose drum pattern lines up best over +-3 s around the cut (1 ms steps)
hp = sg.sosfilt(sg.butter(4, 1500, 'hp', fs=sr, output='sos'), mono)
on = np.maximum(0, np.diff(np.convolve(hp ** 2, np.ones(240) / 240, 'same')[::48], prepend=0))
win = lambda t: on[int(t * 1000) - 3000:int(t * 1000) + 3000]
cands = np.arange(shift - 0.02, shift + 0.02, 0.001)
score = [np.dot(win(P1), win(P1 - c)) / (np.linalg.norm(win(P1)) * np.linalg.norm(win(P1 - c))) for c in cands]
shift = float(cands[int(np.argmax(score))]); P2 = P1 - shift
print(f'P1 {P1:.4f} (grid {P1g:.4f})  P2 {P2:.4f} (grid {P2g:.4f})  shift {shift:.4f}  drop in song {drop:.4f} -> out {drop + shift:.4f}')
OUT_T0 = float(sys.argv[1]) if len(sys.argv) > 1 else 34.0      # outro start in the ad
LOCK = OUT_T0 + 130 / 30
END = OUT_T0 + 7.5 + 1.0                                         # outro + a one-second hold on the lockup
print(f'lock at {LOCK:.3f}, drop at {drop + shift:.3f}, diff {(drop + shift - LOCK) * 1000:.0f} ms')
cut = P1 - 0.012                                                 # just before the attack, so the crossfade hides under it
xf = int(0.03 * sr)
head = a[:int(cut * sr)]
tail = a[int((cut - shift) * sr):int((cut - shift) * sr) + int((END - cut) * sr) + xf]
ramp = np.sin(np.linspace(0, np.pi / 2, xf))[:, None]
mid = head[-xf:] * np.cos(np.linspace(0, np.pi / 2, xf))[:, None] + tail[:xf] * ramp
y = np.concatenate([head[:-xf], mid, tail[xf:]])[:int(END * sr)]
n = len(y); tt = np.arange(n) / sr
f0, f1 = END - 1.9, END - 0.1                                    # gentle fade under the held lockup
g = np.clip((f1 - tt) / (f1 - f0), 0, 1) ** 1.6
y = y * g[:, None]
fi = int(0.02 * sr); y[:fi] *= np.linspace(0, 1, fi)[:, None]
w.write('outro/music_raw.wav', sr, (np.clip(y, -1, 1) * 32767).astype(np.int16))
json.dump({'P1': P1, 'P2': P2, 'shift': shift, 'drop_song': drop, 'drop_out': drop + shift, 'lock': LOCK, 'end': END}, open('outro/music.json', 'w'), indent=1)
