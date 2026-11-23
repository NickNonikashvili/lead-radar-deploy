# Soundtrack for the studio ad: "Furious Freak" (Kevin MacLeod, CC BY 3.0) from 28.2 s, so its first bass hit lands
# when the white sphere hits the floor (2.0 s), its dead stop dims the lights and its explosion starts the store shot
# (17.15 s). The song fades under the logo reveal so the bounces, whooshes and the startup chime come through clean.
#   python3 -I mix5.py song.wav outro_sfx.wav out.wav
import sys, numpy as np, scipy.io.wavfile as w
song_p, sfx_p, out_p = sys.argv[1:4]
SR = 48000; START = 28.2; STORY = 1025 / 30; TOTAL = STORY + 8.5
sr, s = w.read(song_p); assert sr == SR; s = s.astype(float) / 32768
s = s[int(START * SR):int((START + TOTAL) * SR)]
s = np.pad(s, ((0, int(TOTAL * SR) - len(s)), (0, 0)))
t = np.arange(len(s)) / SR
g = np.ones_like(t)
g[t < 0.05] = t[t < 0.05] / 0.05                                   # no click at the start
a, b = STORY - 0.25, STORY + 2.9                                    # fade out under the falling spheres
m = (t >= a) & (t < b); g[m] = 0.5 * (1 + np.cos(np.pi * (t[m] - a) / (b - a))); g[t >= b] = 0
s *= g[:, None]
# loudness: match the loud part of the song to about -14 LUFS-ish by RMS (k-weighting is close enough for this genre)
loud = s[int(18 * SR):int(33 * SR)]
s *= 10 ** ((-15.5 - 20 * np.log10(np.sqrt((loud ** 2).mean()))) / 20)
sr2, x = w.read(sfx_p); assert sr2 == SR; x = x.astype(float) / 32768
i = int(round(STORY * SR)); j = min(len(s), i + len(x))
out = s.copy(); out[i:j] += x[:j - i] * 0.8
# soft limiter: never above -1 dBFS
lim = 10 ** (-1 / 20)
out = np.where(np.abs(out) > 0.7 * lim, np.sign(out) * (0.7 * lim + 0.3 * lim * np.tanh((np.abs(out) - 0.7 * lim) / (0.3 * lim))), out)
w.write(out_p, SR, (np.clip(out, -1, 1) * 32767).astype(np.int16))
print('mix', out_p, round(TOTAL, 3), 's; peak', round(20 * np.log10(np.abs(out).max()), 2), 'dBFS')
