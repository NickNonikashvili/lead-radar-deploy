#!/usr/bin/env python3
"""Download Wikimedia Commons originals straight from upload.wikimedia.org (the path is an MD5 of the file name),
without the API, and record their licence (already checked through the API search: public domain or CC0).
    python3 -I direct.py"""
import hashlib, json, os, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, 'art')
UA = 'EvoSoftAdBuilder/1.0 (public-domain asset research)'
# key, Commons file name, licence seen in the API search, longest side to keep
FILES = [
    ('starry_night', 'Vincent van Gogh - Starry Night - Google Art Project.jpg', 'Public domain', 4400),
    ('pearl', 'Meisje met de parel.jpg', 'Public domain', 4100),
    ('flowers', 'Rachel Ruysch - Flowers - M.Ob.2549 MNW - National Museum in Warsaw.jpg', 'Public domain', 4000),
    ('wanderer', 'Caspar David Friedrich - Wanderer above the Sea of Fog.jpeg', 'Public domain', 4000),
    ('isle', 'Arnold Böcklin - Die Toteninsel I (Basel, Kunstmuseum).jpg', 'Public domain', 4000),
    ('syndics', 'Rembrandt - De Staalmeesters- het college van staalmeesters (waardijns) van het Amsterdamse lakenbereidersgilde - Google Art Project.jpg', 'Public domain', 4000),
    ('gallery', 'Giovanni Paolo Pannini - Picture Gallery with Views of Modern Rome - Google Art Project.jpg', 'Public domain', 6100),
    ('pirosmani_feast', 'Pirosmani - A feast on the bank.jpg', 'Public domain', 4000),
    ('pirosmani_margarita', 'Pirosmani - Actress Margarita.jpg', 'Public domain', 3600),
    ('wheatfield', 'Vincent van Gogh - Wheat Field with Cypresses - Google Art Project.jpg', 'Public domain', 3600),
    ('earth', 'The Blue Marble (remastered).jpg', 'Public domain', 3000),
    ('moon', 'Moon nearside LRO.jpg', 'Public domain', 1400),
    ('parchment', 'Pergament.1.jpg', 'CC0', 1024),
    ('parchment2', 'Pergament.2.jpg', 'CC0', 1024),
    ('frame', 'Frame MET 45186.jpg', 'CC0', 2300),
]


# originals wider than this are fetched as Wikimedia's standard 3840 px thumbnail (originals are rate-limited)
BIG = {'starry_night', 'pearl', 'wanderer', 'isle', 'syndics', 'gallery', 'pirosmani_feast'}


def url_for(name, key):
    n = name.replace(' ', '_')
    h = hashlib.md5(n.encode('utf-8')).hexdigest()
    q = urllib.parse.quote(n)
    if key in BIG:
        return f'https://upload.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/3840px-{q}'
    return f'https://upload.wikimedia.org/wikipedia/commons/{h[0]}/{h[:2]}/{q}'


def fetch_one(key, name, lic, side):
    out = os.path.join(ART, key + '.jpg')
    url = url_for(name, key)
    r = subprocess.run(['curl', '-s', '-L', '-A', UA, '-o', out, '-w', '%{http_code}', '--max-time', '300', url], capture_output=True, text=True)
    if r.stdout != '200':
        return r.stdout
    subprocess.run(['convert', out, '-resize', f'{side}x{side}>', '-quality', '93', out], check=True)
    dims = subprocess.run(['identify', '-format', '%wx%h', out], capture_output=True, text=True).stdout
    json.dump({'key': key, 'title': 'File:' + name, 'licence': lic, 'commons_page': 'https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(name.replace(' ', '_')),
               'download_url': url, 'size': dims}, open(os.path.join(ART, key + '.json'), 'w'), indent=1, ensure_ascii=False)
    return 'ok ' + dims


# Wikimedia rate-limits this shared IP at times: go round the missing files slowly until all are in (max ~70 min)
t_end = time.time() + 70 * 60
while time.time() < t_end:
    missing = [f for f in FILES if not os.path.exists(os.path.join(ART, f[0] + '.json'))]
    if not missing:
        break
    for f in missing:
        res = fetch_one(*f)
        print(time.strftime('%H:%M:%S'), f[0], res, flush=True)
        time.sleep(25 if res.startswith('ok') else 50)
print('done', [f[0] for f in FILES if not os.path.exists(os.path.join(ART, f[0] + '.json'))])
