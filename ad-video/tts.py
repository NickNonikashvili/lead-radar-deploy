#!/usr/bin/env python3
"""Narration for the ad: one TTS file per scene (gpt-4o-mini-tts), then whisper-1 word timings for captions and a
check that every word was spoken.
    python3 tts.py script.json [--voice cedar] [--only B3,B5]
Writes narration/<id>.wav, narration/<id>.words.json and narration/report.json.
"""
import argparse, json, os, re, subprocess, urllib.request, uuid

API = 'https://api.openai.com/v1'
HDR = {'Authorization': 'Bearer ' + __import__('os').environ.get('OPENAI_API_KEY', 'sk-set-OPENAI_API_KEY')}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'narration')


def post_json(path, body, timeout=180):
    req = urllib.request.Request(API + path, data=json.dumps(body).encode(), headers={**HDR, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def transcribe(path):
    boundary = uuid.uuid4().hex
    parts = []
    def field(name, value):
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode())
    field('model', 'whisper-1')
    field('response_format', 'verbose_json')
    field('timestamp_granularities[]', 'word')
    field('language', 'en')
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="a.wav"\r\nContent-Type: audio/wav\r\n\r\n'.encode() + open(path, 'rb').read() + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    req = urllib.request.Request(API + '/audio/transcriptions', data=b''.join(parts), headers={**HDR, 'Content-Type': f'multipart/form-data; boundary={boundary}'})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)


def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())


def norm(s):
    s = s.lower().replace('’', "'").replace('evosoft.solutions', 'evosoft solutions').replace('.solutions', ' solutions')
    return re.findall(r"[a-z0-9']+", s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('script')
    ap.add_argument('--voice', default='cedar')
    ap.add_argument('--only', default='')
    a = ap.parse_args()
    data = json.load(open(a.script))
    os.makedirs(OUT, exist_ok=True)
    only = set(x for x in a.only.split(',') if x)
    report = json.load(open(os.path.join(OUT, 'report.json'))) if os.path.exists(os.path.join(OUT, 'report.json')) else {}
    for sc in data['scenes']:
        sid, text = sc['id'], sc['narration'].strip()
        if not text or (only and sid not in only):
            continue
        # spoken form: say the address the way people read it
        spoken = (text.replace('evosoft.solutions', 'evosoft dot solutions').replace('Microsoft 365', 'Microsoft three sixty-five')
                  .replace('Mailtabs', 'Mail-tabs').replace('StudyCat', 'Study Cat'))
        raw = os.path.join(OUT, f'{sid}.raw.wav')
        wav = os.path.join(OUT, f'{sid}.wav')
        audio = post_json('/audio/speech', {'model': 'gpt-4o-mini-tts', 'voice': a.voice, 'input': spoken, 'instructions': data.get('voice_direction', ''), 'response_format': 'wav'})
        open(raw, 'wb').write(audio)
        # trim leading/trailing silence, 48 kHz mono
        subprocess.check_call(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-af',
                               'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.12,areverse',
                               '-ar', '48000', '-ac', '1', wav])
        os.remove(raw)
        tr = transcribe(wav)
        words = [{'w': w['word'], 's': round(w['start'], 3), 'e': round(w['end'], 3)} for w in tr.get('words', [])]
        json.dump({'text': text, 'heard': tr.get('text', ''), 'words': words}, open(os.path.join(OUT, f'{sid}.words.json'), 'w'), indent=1)
        want, got = norm(spoken), norm(tr.get('text', ''))
        missing = [w for w in want if w not in got]
        dur = duration(wav)
        report[sid] = {'dur': round(dur, 3), 'words': len(want), 'wps': round(len(want) / dur, 2), 'missing': missing}
        print(f"{sid}: {dur:.2f}s, {len(want)} words ({len(want) / dur:.2f}/s){' MISSING ' + str(missing) if missing else ''}")
    json.dump(report, open(os.path.join(OUT, 'report.json'), 'w'), indent=1)


if __name__ == '__main__':
    main()
