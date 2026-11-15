import base64, json, sys, urllib.request
def listen(paths, question, model='gpt-audio'):
    content = [{"type": "text", "text": question}]
    for p in paths:
        content.append({"type": "text", "text": f"Clip: {p.split('/')[-1]}"})
        content.append({"type": "input_audio", "input_audio": {"data": base64.b64encode(open(p, 'rb').read()).decode(), "format": "wav" if p.endswith('.wav') else "mp3"}})
    body = {"model": model, "modalities": ["text"], "messages": [{"role": "user", "content": content}]}
    req = urllib.request.Request('https://api.openai.com/v1/chat/completions', data=json.dumps(body).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + __import__('os').environ.get('OPENAI_API_KEY', 'sk-set-OPENAI_API_KEY')})
    with urllib.request.urlopen(req, timeout=300) as r:
        return json.load(r)['choices'][0]['message']['content']
if __name__ == '__main__':
    q = sys.argv[1]
    print(listen(sys.argv[2:], q))
