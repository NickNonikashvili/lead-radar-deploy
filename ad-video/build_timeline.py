#!/usr/bin/env python3
"""Builds comp/timeline.json, narration.wav and captions (SRT) from script.json, the narration and the clips.

Each beat lasts as long as its narration plus a little air. Footage is tied to the words: a scene's `map` pins
moments in the recording (its marks) to spoken words, so a login is copied as the narrator says "Copy", and the
site turns Russian on "Russian". Screenshot scenes change picture on a cue word.
    python3 build_timeline.py
"""
import difflib, json, os, re, wave

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
XF = 0.5          # crossfade, must match comp.js
LEAD = 0.45       # narration starts this long after its scene starts
TAIL = 0.5        # air after the narration before the next scene
SR = 48000
NARR = os.environ.get('AD_NARR', 'narration')

script = json.load(open(os.path.join(HERE, os.environ.get('AD_SCRIPT', 'script.json'))))
report = json.load(open(os.path.join(HERE, NARR, 'report.json')))
beats = {s['id']: s for s in script['scenes']}
ids = [s['id'] for s in script['scenes']]
NO_CAPTIONS = {'B1', 'B14'}   # the title and end cards already show the words (they're still in the .srt file)
# caption punctuation that differs from the narration script (no serial comma, as in the on-screen text)
CAPTION_EDITS = [('offline, and', 'offline and'), ('flashcards, and', 'flashcards and'), ('together, and', 'together and'), ('sign in, and', 'sign in and')]


def clip(name):
    return json.load(open(os.path.join(HERE, 'clips', name, 'index.json')))


def key(w):
    return re.sub(r"[^a-z0-9]", '', w.lower().replace('’', "'"))


WORDS = {}
for bid in ids:
    p = os.path.join(HERE, NARR, f'{bid}.words.json')
    WORDS[bid] = json.load(open(p)) if os.path.exists(p) else {'text': '', 'words': []}


def word_time(bid, word, nth=1):
    """Time of a spoken word, relative to the start of the beat's narration."""
    k, n = key(word), 0
    for w in WORDS[bid]['words']:
        if key(w['w']).startswith(k):
            n += 1
            if n == nth:
                return w['s']
    raise KeyError(f'{bid}: word {word!r} not found in {[x["w"] for x in WORDS[bid]["words"]]}')


SHOT = lambda f, kb, cue=None: {'src': f'shots-src/{f}', 'kb': kb, 'cue': cue}
# Screenshot moves: x/y are fractions of the overflow; zoom stays within 3% so no sidebar or edge is cut.
ZOOM_IN = [0.5, 0.2, 1.0, 0.5, 0.5, 1.03]
PAN_R = [0.5, 0.0, 1.03, 0.5, 0.8, 1.03]
PAN_DOWN = [0.5, 0.0, 1.025, 0.5, 1.0, 1.025]
GENTLE = [0.5, 0.6, 1.03, 0.5, 0.2, 1.0]
STILL = [0.5, 0.5, 1.0, 0.5, 0.5, 1.0]

# Time references: ('t', s) scene-local seconds, ('w', word, offset) a spoken word, ('end',) scene end incl. crossfade.
# Clip references: ('c', s) clip seconds, ('m', mark, offset) a mark in the recording.
# map: ('at', T, C) a fixed point; ('cut', T, C) play on at 1x until T, then jump to C; ('run', T) play at 1x to T.
VISUALS = {
    'B1': [{'kind': 'title'}],
    'B2': [{'kind': 'browser', 'layout': 'full', 'clip': 'hero', 'url': 'evosoft.solutions',
            # the hero's typewriter shows "websites" from 0.5 to 3.85 s of the recording: hold it under the spoken word
            'map': [('at', ('t', 0), ('c', 0.1)), ('at', ('w', 'websites', 0.45), ('c', 3.75)), ('at', ('end',), ('c', 10.2))],
            'cam': [(('t', 0), 0.5, 0.0, 1.0), (('end',), 0.62, 0.25, 1.06)]}],
    'B3': [{'kind': 'browser', 'layout': 'split', 'clip': 'services', 'chip': 'Services', 'url': 'evosoft.solutions',
            'map': [('at', ('t', 0), ('c', 4.9)), ('at', ('w', 'Online', -0.15), ('m', 'stores', 0)), ('at', ('w', 'booking', -0.15), ('m', 'booking', 0)),
                    ('at', ('w', 'Microsoft', -0.25), ('m', 'm365', 0)), ('run', ('end',))],
            'cam': [(('t', 0), 0.5, 0.0, 1.0), (('end',), 0.5, 0.3, 1.08)]}],
    'B4': [{'kind': 'browser', 'layout': 'split', 'clip': 'products', 'chip': 'Our own products', 'url': 'evosoft.solutions',
            'map': [('at', ('t', 0), ('m', 'evo', -1.7)), ('at', ('w', 'Evo', -0.1), ('m', 'evo', 0)), ('at', ('w', 'Mailtabs', -0.1), ('m', 'mailtabs', 0)),
                    ('at', ('w', 'StudyCat', -0.1), ('m', 'studycat', 0)), ('at', ('w', 'next', 0), ('m', 'yours', 0)), ('run', ('end',))],
            'cam': [(('t', 0), 0.5, 0.0, 1.08), (('w', 'Evo', -0.1), 0.5, 0.0, 1.16), (('end',), 0.5, 0.0, 1.18)]}],
    'B5': [{'kind': 'browser', 'layout': 'split', 'clip': 'evopage', 'until': ('w', 'Plan', -0.35), 'chip': 'Evo · workforce + POS', 'color': '#4F46E5',
            'url': 'evosoft.solutions/work/evo.html', 'map': [('at', ('t', 0), ('c', 0.5)), ('at', ('end',), ('c', 5.6))]},
           {'kind': 'shots', 'layout': 'split', 'chip': 'Evo · workforce + POS', 'color': '#4F46E5', 'url': 'evo-demo.evosoft.solutions',
            'shots': [SHOT('evo/03-hr-scheduler.jpg', PAN_R), SHOT('evo/05-payroll-period-review.jpg', GENTLE, 'export'),
                      SHOT('evo/09-register-pay-screen.jpg', STILL, 'sell'), SHOT('evo/08-store-reports.jpg', ZOOM_IN, 'reports')]}],
    'B6': [{'kind': 'shots', 'layout': 'split', 'chip': 'Mailtabs · unified email', 'color': '#0F766E', 'url': 'mail-demo.evosoft.solutions',
            'shots': [SHOT('mailtabs/01-unified-inbox.jpg', ZOOM_IN), SHOT('mailtabs/02-receipts-tab.jpg', PAN_R, 'rule'), SHOT('mailtabs/04-composer.jpg', GENTLE, 'Reply')]}],
    'B7': [{'kind': 'shots', 'layout': 'split', 'chip': 'StudyCat · study platform', 'color': '#1A64D6', 'url': 'studycat-demo.evosoft.solutions',
            'shots': [SHOT('studycat/02-class-dashboard.jpg', ZOOM_IN), SHOT('studycat/04-quizzer.jpg', PAN_R, 'quizzer'),
                      SHOT('studycat/05-flashcards.jpg', GENTLE, 'flashcards'), SHOT('studycat/09-faculty-class.jpg', PAN_DOWN, 'instructors')]}],
    'B8': [{'kind': 'browser', 'layout': 'full', 'clip': 'demos', 'until': ('w', 'Hannah', -0.3), 'url': 'evosoft.solutions/demos.html',
            'map': [('at', ('t', 0), ('c', 0.0)), ('at', ('t', 1.8), ('c', 0.0)), ('at', ('w', '15', -0.2), ('m', 'cards', 0.2)), ('at', ('w', 'Copy', -0.55), ('m', 'tour', 0)),
                    ('at', ('w', 'Copy', 0.1), ('m', 'copied', 0)), ('at', ('w', 'sign', 0.15), ('m', 'toast', 0)), ('run', ('end',))],
            'cam': [(('t', 0), 0.5, 0.0, 1.0), (('w', 'Copy', -0.9), 0.5, 0.15, 1.0), (('w', 'Copy', -0.3), 0.24, 0.40, 1.55), (('w', 'sign', 0.25), 0.24, 0.40, 1.58),
                    (('w', 'Hannah', -0.3), 0.5, 0.0, 1.0)]},
           {'kind': 'shots', 'layout': 'full', 'url': 'evo-demo.evosoft.solutions', 'shots': [SHOT('evo/01-owner-home.jpg', [0.5, 0.0, 1.0, 0.5, 0.4, 1.03])]}],
    'B9': [{'kind': 'browser', 'layout': 'split', 'clip': 'process', 'chip': 'Talk · Quote · Build · Launch', 'url': 'evosoft.solutions',
            # the section is fully drawn from the first frame; each step's badge pops on its word. Badge animations start
            # 0.003 / 0.352 / 0.702 / 1.051 s after the 'drawn' mark (first changed pixel) and peak about 0.28 s later
            'map': [('at', ('t', 0), ('m', 'drawn', -0.7)), ('at', ('w', 'talk', -0.12), ('m', 'drawn', -0.02)), ('at', ('w', 'talk', 0.33), ('m', 'drawn', 0.30)),
                    ('at', ('w', 'quote', -0.12), ('m', 'drawn', 0.33)), ('at', ('w', 'quote', 0.33), ('m', 'drawn', 0.65)),
                    ('at', ('w', 'build', -0.12), ('m', 'drawn', 0.68)), ('at', ('w', 'build', 0.33), ('m', 'drawn', 1.00)),
                    ('at', ('w', 'launch', -0.12), ('m', 'drawn', 1.03)), ('at', ('w', 'launch', 0.35), ('m', 'drawn', 1.33)),
                    ('at', ('end',), ('m', 'faq', -0.1))],
            'cam': [(('t', 0), 0.5, 0.40, 1.04), (('t', 1.2), 0.5, 0.40, 1.15), (('end',), 0.5, 0.40, 1.16)]}],
    'B10': [{'kind': 'browser', 'layout': 'full', 'clip': 'languages', 'url': 'evosoft.solutions',
             'map': [('at', ('t', 0), ('c', 0.8)), ('cut', ('w', 'Georgian', -0.05), ('m', 'ka', 2.45)), ('cut', ('w', 'Russian', -0.05), ('m', 'ru', 2.45)),
                     ('cut', ('w', 'Spanish', -0.05), ('m', 'es', 2.45)), ('at', ('w', 'Pick', -0.35), ('m', 'enmenu', 0)), ('at', ('w', 'page', 0.0), ('m', 'en', 0.05)), ('cut', ('w', 'page', 0.0), ('m', 'en', 0.9)),
                     ('run', ('end',))],
             'langs': [('English', 'evosoft.solutions', None), ('ქართული', 'evosoft.solutions/ka/', ('w', 'Georgian', -0.05)),
                       ('Русский', 'evosoft.solutions/ru/', ('w', 'Russian', -0.05)), ('Español', 'evosoft.solutions/es/', ('w', 'Spanish', -0.05)),
                       ('English', 'evosoft.solutions', ('w', 'page', 0.0))],
             'cam': [(('t', 0), 0.5, 0.0, 1.0), (('end',), 0.5, 0.0, 1.0)]}],
    'B11': [{'kind': 'browser', 'layout': 'full', 'clip': 'assistant', 'url': 'evosoft.solutions',
             'map': [('at', ('t', 0), ('c', 0.3)), ('at', ('w', 'Ask', 0), ('m', 'open', 0.1)), ('at', ('w', 'best', 0.0), ('m', 'pick', 0)),
                     ('at', ('w', 'best', 0.45), ('m', 'sent', 0)), ('run', ('end',))],
             'cam': [(('t', 0), 0.5, 0.0, 1.0), (('w', 'Ask', 0.2), 0.5, 0.0, 1.0), (('w', 'Ask', 1.0), 1.0, 0.61, 1.6)],
             'mask': (('w', 'Ask', 0.2), ('w', 'Ask', 1.0), 262, 290)}],
    'B12': [{'kind': 'browser', 'layout': 'split', 'clip': 'quote', 'chip': 'Get a free quote', 'url': 'evosoft.solutions/contact.html',
             'map': [('at', ('t', 0), ('m', 'chip', -0.8)), ('at', ('w', 'Pick', 0.0), ('m', 'chip', 0.05)), ('at', ('w', 'write', -0.1), ('m', 'chip', 1.2)),
                     ('at', ('w', 'Send', 0.05), ('m', 'sent', 0.12)), ('at', ('end',), ('m', 'sent', 4.6))],
             'cam': [(('t', 0), 0.3, 0.60, 1.62), (('w', 'write', 0), 0.3, 0.60, 1.62), (('w', 'write', 0.25), 0.31, 0.53, 1.62), (('w', 'Send', 0.38), 0.31, 0.53, 1.62),
                     (('w', 'Send', 1.03), 0.31, 0.69, 1.62)]}],
    'B13': [{'kind': 'phone', 'clip': 'mobile', 'chip': 'Mobile-friendly',
             'map': [('at', ('t', 0), ('c', 0.3)), ('at', ('w', 'Dark', -0.2), ('m', 'dark', 0.0)), ('run', ('end',))]}],
    'B14': [{'kind': 'end'}],
}

# ---------- timing ----------
t = 0.0
beat_times = {}
for bid in ids:
    narr = report.get(bid, {}).get('dur', 0.0)
    if bid == 'B1':
        dur, lead = max(4.6, 1.2 + narr + TAIL), 1.2
    elif bid == 'B14':
        dur, lead = max(7.0, LEAD + narr + 3.2), 0.9
    else:
        dur, lead = LEAD + narr + TAIL, LEAD
    beat_times[bid] = {'start': round(t, 3), 'dur': round(dur, 3), 'narr_at': round(t + lead, 3), 'narr': narr}
    t += dur
total = round(t, 3)

# ---------- scenes ----------
scenes = []
for bid in ids:
    bt = beat_times[bid]
    beat = beats[bid]
    vis = VISUALS[bid]
    s0 = bt['start']
    for j, v in enumerate(vis):
        # a scene ends at its `until` word, or at the end of the beat
        if 'until' in v:
            _, w, off = v['until']
            end = bt['narr_at'] + word_time(bid, w) + off
        else:
            end = bt['start'] + bt['dur']
        dur = end - s0
        last_in_video = bid == ids[-1] and j == len(vis) - 1

        def T(ref):
            if ref[0] == 't':
                return ref[1]
            if ref[0] == 'end':
                return dur + (0 if last_in_video else XF)
            return bt['narr_at'] + word_time(bid, ref[1]) + ref[2] - s0

        sc = {k: val for k, val in v.items() if k not in ('cam', 'clip', 'map', 'langs', 'until', 'shots', 'mask')}
        sc.update({'id': f'{bid}{"abcdef"[j] if len(vis) > 1 else ""}', 'beat': bid, 'start': round(s0, 3), 'dur': round(dur, 3),
                   'onscreen': beat.get('onscreen', ''), 'sub': beat.get('sub', '')})
        if 'clip' in v:
            idx = clip(v['clip'])
            marks = idx.get('marks', {})

            def C(ref):
                return ref[1] if ref[0] == 'c' else marks[ref[1]] + ref[2]

            pts = []
            for step in v['map']:
                if step[0] == 'at':
                    pts.append([T(step[1]), C(step[2])])
                elif step[0] == 'cut':
                    lt = T(step[1])
                    pl, pc = pts[-1]
                    pts.append([lt, pc + (lt - pl)])
                    pts.append([lt, C(step[2])])
                elif step[0] == 'cutc':
                    pl, pc = pts[-1]
                    c1, c2 = C(step[1]), C(step[2])
                    lt = pl + (c1 - pc)
                    pts.append([lt, c1])
                    pts.append([lt, c2])
                elif step[0] == 'run':
                    lt = T(step[1])
                    pl, pc = pts[-1]
                    pts.append([lt, pc + (lt - pl)])
            # past the last frame the page was still (the screencast only sends a frame when something changes), so
            # the compositor simply holds that frame; the map is not squeezed to fit
            sc['clip'] = {'name': v['clip'], 'map': [[round(a, 3), round(b, 3)] for a, b in pts]}
            cam = [{'t': round(max(0, T(r)), 3), 'x': x, 'y': y, 's': s} for r, x, y, s in v.get('cam', [])]
            if cam:
                sc['cam'] = sorted(cam, key=lambda c: c['t'])
            def TL_(r):
                if not r:
                    return 0
                if r[0] != 'clip':
                    return T(r)
                ct = marks[r[1]] + r[2]
                for (l0, c0), (l1, c1) in reversed(list(zip(pts, pts[1:]))):
                    if l1 > l0 and min(c0, c1) <= ct <= max(c0, c1):
                        return l0 + (ct - c0) / (c1 - c0) * (l1 - l0)
                return T(('end',))
            if 'mask' in v:
                a_, b_, solid, fade = v['mask']
                sc['mask'] = {'t0': round(T(a_), 3), 't1': round(T(b_), 3), 'solid': solid, 'fade': fade}
            if 'langs' in v:
                sc['pills'] = [{'label': lab, 't': round(TL_(r), 3)} for lab, url, r in v['langs']]
                sc['urls'] = [{'t': round(TL_(r), 3), 'url': url} for lab, url, r in v['langs']]
        if v['kind'] == 'shots':
            shots = [dict(s) for s in v['shots']]
            starts = [0.0] + [max(0.0, T(('w', s['cue'], -0.35))) for s in shots[1:]]
            for k, sh in enumerate(shots):
                sh['from'] = round(starts[k], 3)
                sh['to'] = round((starts[k + 1] if k + 1 < len(shots) else T(('end',))) + 0.6, 3)
                del sh['cue']
            sc['shots'] = shots
        if sc['kind'] == 'title':
            sents = re.findall(r'[^.!?]+[.!?]', beat.get('narration', ''))
            sc['onscreen'] = beat.get('onscreen') or (sents[0].strip() if sents else 'Any kind of project, including tech')
            sc['sub'] = beat.get('sub') if beat.get('onscreen') else (sents[1].strip() if len(sents) > 1 else beat.get('sub', ''))
            if len(sents) > 1:
                sc['subAt'] = round(bt['narr_at'] + word_time(bid, sents[1].split()[0]) - s0 - 0.2, 3)
        if sc['kind'] in ('browser', 'shots', 'phone') and sc.get('layout', 'split') == 'split' and not sc.get('onscreen'):
            sc['onscreen'] = {'B13': 'Made for phones, too'}.get(bid, sc.get('chip', ''))
            sc['sub'] = sc.get('sub') or {'B13': 'Light or dark, the same site everywhere'}.get(bid, '')
        if sc['kind'] == 'end':
            sc.update({'cta': 'Get a free quote', 'contacts': '+995 555 352 218  ·  +995 599 574 416  ·  contact@evosoft.solutions',
                       'langs': 'English · ქართული · Русский · Español', 'copyright': '© 2026 EvoSoft Solutions. All rights reserved.'})
        for k in ('onscreen', 'sub'):
            if sc.get(k):
                sc[k] = sc[k].replace("'", '’')
        scenes.append(sc)
        s0 = end
for i, sc in enumerate(scenes):
    sc['index'] = i
    sc['first'] = i == 0
    sc['last'] = i == len(scenes) - 1

# ---------- narration track ----------
track = np.zeros(int((total + 1) * SR), dtype=np.float32)
for bid in ids:
    p = os.path.join(HERE, NARR, f'{bid}.wav')
    if not os.path.exists(p):
        continue
    with wave.open(p) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1
        a = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float32) / 32768
    i = int(beat_times[bid]['narr_at'] * SR)
    track[i:i + len(a)] += a[: len(track) - i]
track = track[: int(total * SR)]
with wave.open(os.path.join(HERE, 'narration.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(track, -1, 1) * 32767).astype('<i2').tobytes())

# ---------- captions: the script's words, timed by the transcription ----------
MIN_CUE, MAX_CHARS = 1.0, 52
captions = []
for bid in ids:
    if not WORDS[bid]['words']:
        continue
    # the transcription sometimes stretches a short word back into the pause before it; start it near its end
    heard = [dict(w, s=max(w['s'], w['e'] - 0.2) if len(key(w['w'])) <= 4 and w['e'] - w['s'] > 0.4 else w['s']) for w in WORDS[bid]['words']]
    text = WORDS[bid]['text']
    for a_, b_ in CAPTION_EDITS:
        text = text.replace(a_, b_)
    shown = text.split()
    a = [key(w) for w in shown]
    b = [key(w['w']) for w in heard]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    times = [None] * len(shown)
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            times[blk.a + k] = (heard[blk.b + k]['s'], heard[blk.b + k]['e'])
    last_end = 0.0
    for k in range(len(times) - 1, -1, -1):
        if times[k] is not None:
            break
        times[k] = (heard[-1]['s'], heard[-1]['e'])   # unmatched words at the very end: they are the last spoken
    for k in range(len(times)):
        if times[k] is None:
            nxt = next((times[m][0] for m in range(k + 1, len(times)) if times[m]), last_end + 0.3)
            times[k] = (last_end, max(last_end + 0.05, nxt))
        last_end = times[k][1]
    base = beat_times[bid]['narr_at']
    # sentences first; very short ones join the one before ("And the next one? Yours."); long ones split in balance
    sents, cur = [], []
    for k, w in enumerate(shown):
        cur.append(k)
        if re.search(r'[.!?]$', w) or k == len(shown) - 1:
            sents.append(cur); cur = []
    merged = []
    for s in sents:
        text = ' '.join(shown[i] for i in s)
        if merged and len(text) <= 12 and len(' '.join(shown[i] for i in merged[-1] + s)) <= MAX_CHARS:
            merged[-1] = merged[-1] + s
        else:
            merged.append(s)

    def split(ix):
        if len(' '.join(shown[i] for i in ix)) <= MAX_CHARS or len(ix) < 4:
            return [ix]
        best, score = None, 1e9
        for c in range(2, len(ix) - 1):
            left = ' '.join(shown[i] for i in ix[:c])
            right = ' '.join(shown[i] for i in ix[c:])
            last = left.split()[-1].lower().strip(',:;')
            sc_ = abs(len(left) - len(right)) - (60 if left.endswith(':') else 22 if left.endswith(',') else 0) \
                + (40 if last in ('and', 'or', 'a', 'an', 'the', 'of', 'to', 'in', 'at', 'for', 'with', 'your', 'our') else 0) \
                + (0 if left.endswith((',', ':', ';')) else 12) + (30 if len(left) > MAX_CHARS + 8 else 0)
            if sc_ < score:
                best, score = c, sc_
        return split(ix[:best]) + split(ix[best:])

    for s in merged:
        for part in split(s):
            st, en = times[part[0]][0], times[part[-1]][1]
            captions.append({'start': round(base + st - 0.08, 3), 'end': round(base + en + 0.3, 3),
                             'text': ' '.join(shown[i] for i in part).replace("'", '’'), 'beat': bid, **({'srtOnly': True} if bid in NO_CAPTIONS else {})})
captions.sort(key=lambda c: c['start'])
for i, c in enumerate(captions):
    nxt = captions[i + 1]['start'] - 0.05 if i + 1 < len(captions) else total
    beat_end = beat_times[c['beat']]['start'] + beat_times[c['beat']]['dur'] + 0.05
    c['end'] = round(min(max(c['end'], c['start'] + MIN_CUE), nxt, beat_end), 3)
    if i + 1 < len(captions) and captions[i + 1]['start'] - c['end'] < 0.8 and captions[i + 1].get('beat') == c.get('beat'):
        c['end'] = captions[i + 1]['start']
        c['joinNext'] = True
        captions[i + 1]['joinPrev'] = True

tl = {'fps': 30, 'duration': total, 'scenes': scenes, 'captions': captions, 'beats': beat_times}
json.dump(tl, open(os.path.join(HERE, 'comp/timeline.json'), 'w'), ensure_ascii=False, indent=1)


def srt_time(x):
    h, r = divmod(x, 3600); m, s = divmod(r, 60)
    return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)):03}"


with open(os.path.join(HERE, 'evosoft-ad.srt'), 'w') as f:
    for i, c in enumerate(captions, 1):
        f.write(f"{i}\n{srt_time(c['start'])} --> {srt_time(c['end'])}\n{c['text']}\n\n")

print(f"duration {total:.2f}s, {len(scenes)} scenes, {len(captions)} captions")
for sc in scenes:
    if 'clip' in sc:
        m = sc['clip']['map']
        sp = [(m[i + 1][1] - m[i][1]) / max(1e-6, m[i + 1][0] - m[i][0]) for i in range(len(m) - 1) if m[i + 1][0] > m[i][0]]
        print(f"  {sc['id']}: {sc['clip']['name']} {sc['start']:.2f}+{sc['dur']:.2f} speeds {[round(x, 2) for x in sp]}")
    if sc['kind'] == 'shots':
        print(f"  {sc['id']}: shots {sc['start']:.2f}+{sc['dur']:.2f} from {[s['from'] for s in sc['shots']]}")
