#!/usr/bin/env python3
"""Search Wikimedia Commons and download public-domain files with their licence record.
    python3 -I commons.py search "<query>" [n]
    python3 -I commons.py get <key> "File:<title>" [width]     -> art/<key>.jpg + art/<key>.json
Only Public domain / CC0 files are downloaded."""
import json, os, re, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, 'art')
UA = 'EvoSoftAdBuilder/1.0 (public-domain asset research)'
API = 'https://commons.wikimedia.org/w/api.php?'


def fetch(url, out=None):
    for i in range(9):
        args = ['curl', '-s', '-L', '-A', UA, '-w', '%{http_code}', '--max-time', '120']
        if out:
            args += ['-o', out]
        r = subprocess.run(args + [url], capture_output=True, text=True)
        code = r.stdout[-3:]
        if code == '200':
            if out:
                return True
            body = r.stdout[:-3]
            try:
                json.loads(body)
                return body
            except ValueError:
                pass            # a rate-limit page instead of JSON: back off and retry
        time.sleep(15 * (i + 1))   # Wikimedia rate limits: back off
    raise RuntimeError(f'{code} for {url}')


def strip(s):
    return re.sub('<[^>]+>', '', s or '').strip()


def info(titles, width=None):
    q = {'action': 'query', 'titles': '|'.join(titles), 'prop': 'imageinfo', 'iiprop': 'url|size|extmetadata|mime', 'format': 'json'}
    if width:
        q['iiurlwidth'] = str(width)
    d = json.loads(fetch(API + urllib.parse.urlencode(q)))
    return list(d['query']['pages'].values())


def lic(p):
    m = p['imageinfo'][0]['extmetadata']
    return strip(m.get('LicenseShortName', {}).get('value')), strip(m.get('Artist', {}).get('value'))[:60], strip(m.get('DateTimeOriginal', {}).get('value'))[:30]


def free(l):
    return bool(re.search(r'public domain|^pd|cc0|cc-zero', l, re.I))


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'search':
        n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
        q = {'action': 'query', 'generator': 'search', 'gsrnamespace': '6', 'gsrlimit': str(n), 'gsrsearch': sys.argv[2],
             'prop': 'imageinfo', 'iiprop': 'size|extmetadata|mime', 'format': 'json'}
        d = json.loads(fetch(API + urllib.parse.urlencode(q)))
        rows = sorted(d.get('query', {}).get('pages', {}).values(), key=lambda p: p.get('index', 0))
        for p in rows:
            ii = p['imageinfo'][0]; l, a, dt = lic(p)
            print(f"{'OK ' if free(l) else '-- '}{ii['width']:>6}x{ii['height']:<6} {ii['mime'][6:]:5} {l[:22]:22} | {p["title"]}")
    elif cmd == 'get':
        key, title = sys.argv[2], sys.argv[3]
        width = int(sys.argv[4]) if len(sys.argv) > 4 else 3840
        p = info([title])[0]          # no thumbnail request: Wikimedia rate-limits resized copies; take the original
        ii = p['imageinfo'][0]; l, a, dt = lic(p)
        if not free(l):
            sys.exit(f'REFUSED {title}: licence {l}')
        url = ii['url']
        ext = '.png' if url.lower().endswith('.png') else '.jpg'
        out = os.path.join(ART, key + ext)
        fetch(url, out)
        if ext == '.jpg' and not url.lower().endswith(('.jpg', '.jpeg')):
            subprocess.run(['convert', out, out], check=True)
        # resize locally so the longest side is at most `width`
        subprocess.run(['convert', out, '-resize', f'{width}x{width}>', '-quality', '93', out], check=True)
        dims = subprocess.run(['identify', '-format', '%wx%h', out], capture_output=True, text=True).stdout
        rec = {'key': key, 'title': title, 'artist': a, 'date': dt, 'licence': l, 'commons_page': ii.get('descriptionurl'), 'download_url': url, 'size': dims}
        json.dump(rec, open(os.path.join(ART, key + '.json'), 'w'), indent=1, ensure_ascii=False)
        print(f'{key}: {dims} {l} | {title}')
