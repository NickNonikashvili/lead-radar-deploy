#!/usr/bin/env python3
"""Contact sheets of the rendered video for review: one sheet per beat, a frame every STEP seconds, labelled with the
video time; the caption shown at that moment is in the label too.  python3 qa_sheets.py <video.mp4> <outDir> [step]"""
import json, os, subprocess, sys
video, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 0.6
tl = json.load(open('comp/timeline.json'))
os.makedirs(out, exist_ok=True)
for bid, b in tl['beats'].items():
    t, files = b['start'] + 0.05, []
    while t < b['start'] + b['dur'] + 0.4:
        f = os.path.join(out, f'{bid}_{t:07.2f}.jpg')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', '-vf', 'scale=640:-1', f], check=True)
        cap = next((c['text'] for c in tl['captions'] if c['start'] <= t < c['end']), '')
        files += ['-label', f'{t:.1f}s  {cap[:60]}', f]
        t += step
    subprocess.run(['montage', *files, '-tile', '5x', '-geometry', '640x360+4+4', '-pointsize', '15', os.path.join(out, f'sheet-{bid}.jpg')], check=True)
    for x in files[1::2] if False else []:
        pass
    print(bid, 'sheet done')
