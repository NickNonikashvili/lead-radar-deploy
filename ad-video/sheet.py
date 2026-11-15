import json, subprocess, sys
name, step = sys.argv[1], float(sys.argv[2] if len(sys.argv) > 2 else 0.5)
idx = json.load(open(f'clips/{name}/index.json'))
fr = idx['frames']; end = fr[-1]['t']
picks, t = [], 0.0
while t <= end + 1e-6:
    f = max((x for x in fr if x['t'] <= t + 1e-6), key=lambda x: x['t'], default=fr[0])
    picks.append((t, f['f'])); t += step
args = ['montage']
for t, f in picks:
    args += ['-label', f'{t:.1f}s', f'clips/{name}/{f}']
cols = 6 if idx['viewport']['width'] > 500 else 10
args += ['-tile', f'{cols}x', '-geometry', ('360x225+3+3' if cols == 6 else '150x325+3+3'), '-pointsize', '18', f'sheet-{name}.jpg']
subprocess.check_call(args)
print(f'sheet-{name}.jpg', len(picks), 'frames, clip', round(end, 2), 's')
