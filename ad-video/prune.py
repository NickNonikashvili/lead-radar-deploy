import json, subprocess, sys, os
for name in sys.argv[1:]:
    p = f'clips/{name}/index.json'
    idx = json.load(open(p))
    blank = set(subprocess.check_output(['./clean.sh', name]).decode().split())
    before = len(idx['frames'])
    idx['frames'] = [f for f in idx['frames'] if f['f'] not in blank]
    idx['pruned'] = sorted(blank)
    json.dump(idx, open(p, 'w'))
    print(name, 'dropped', before - len(idx['frames']), 'blank frames')
