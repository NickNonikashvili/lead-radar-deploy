import numpy as np, scipy.io.wavfile as w, scipy.signal as sg
sr, a = w.read('artad2/rec.wav'); a = a.astype(np.float32).mean(1) / 32768
hop = 480
f, t, Z = sg.stft(a, sr, nperseg=2048, noverlap=2048 - hop, boundary=None); M = np.log1p(50 * np.abs(Z))
edges = np.geomspace(60, 12000, 33)
bands = np.array([M[(f >= lo) & (f < hi)].mean(0) for lo, hi in zip(edges[:-1], edges[1:]) if ((f >= lo) & (f < hi)).any()])
bands = (bands - bands.mean(1, keepdims=True))
fr = lambda s: int(round(s * sr / hop))
B = lambda k: 2.36 + k * 0.4731
voc = M[(f > 300) & (f < 3000)].mean(0)
def cor(x, y):
    n = min(x.shape[1], y.shape[1]); return float(np.corrcoef(x[:, :n].ravel(), y[:, :n].ravel())[0, 1])
res = []
for k1 in range(40, 67):
    P1, P2 = B(k1), B(k1 - 32)
    pre = cor(bands[:, fr(P1 - 1.9):fr(P1)], bands[:, fr(P2 - 1.9):fr(P2)])
    post = cor(bands[:, fr(P1):fr(P1 + 1.9)], bands[:, fr(P2):fr(P2 + 1.9)])
    res.append((round(min(pre, post), 3), round(pre, 3), round(post, 3), k1, round(P1, 3), round(P2, 3), round(float(voc[fr(P1) - 5:fr(P1) + 5].mean()), 2), round(float(voc[fr(P2) - 5:fr(P2) + 5].mean()), 2)))
print('min(pre,post) pre post k1 P1 P2 vocP1 vocP2')
for r in sorted(res, reverse=True)[:10]: print(r)
