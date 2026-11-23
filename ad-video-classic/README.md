# EvoSoft — classical-art ad (16:9, about 39 s)

A short film in the style of a painted lyric video: famous public-domain paintings that the camera moves *into*
(each painting gets a depth map, so it becomes a 3D surface with real parallax), zoom-through cuts, 3D letters
standing in the paintings, calligraphy writing itself onto parchment, an original score and a soft narrator.
© 2026 EvoSoft Solutions. All rights reserved.

Script:

> Every masterpiece begins with a single line. / Yours might be a website, / a store that never sleeps, / or the
> software your business runs on. / We build it to order, by hand, in Georgia, / and hang it where the whole world
> can see. / EvoSoft. Your idea, made into a masterpiece.

## Make it

| Step | Command | What it does |
|---|---|---|
| 1. Tools | `pip install onnxruntime kokoro-onnx soundfile scipy faster-whisper`; fonts from npm `@fontsource/{anton,pinyon-script,im-fell-english,cinzel,cormorant-garamond}` into `fonts/` | Everything runs locally; no API keys |
| 2. Models | Kokoro voice (`kokoro-v1.0.onnx`, `voices-v1.0.bin` from github.com/thewh1teagle/kokoro-onnx releases) and Depth Anything V2 base (`onnx-community/depth-anything-v2-base`, `onnx/model.onnx`) into `models/` | Voice and depth maps |
| 3. Art | `python3 -I direct.py` (Wikimedia Commons) and `wikiart/extract.py` (WikiArt shards from Hugging Face), then `python3 -I prep.py` | Paintings, textures, the pencil line-art of the hands |
| 4. Depth | `python3 -I depth.py art/<painting>.jpg ...` | A depth map per painting |
| 5. Voice | `python3 -I vo.py af_heart 0.9`, then word timings with faster-whisper into `vo/words.json` | The narration and when each word is spoken |
| 6. Score | `python3 -I music.py` | Original music and sound design, cut to `timeline.json` |
| 7. Frames | `python3 -m http.server 8600` (from this folder), then `node render.js frames 30 3` | WebGL compositor (`comp/`) in headless Chromium |
| 8. Assemble | `./assemble.sh frames evosoft-classic-ad.mp4` | Voice over music, -14 LUFS, H.264 1080p30 |

`timeline.json` holds the shot times and where each voice line starts; `comp/scenes.js` holds the shots;
`comp/engine.js` is the small WebGL engine (depth-displaced paintings, extruded 3D text, write-on calligraphy,
scenes inside frames, film finish).

## Artworks (all public-domain old masters)

From Wikimedia Commons: Michelangelo, *The Creation of Adam* · Johannes Vermeer, *Girl with a Pearl Earring* ·
Caspar David Friedrich, *Wanderer above the Sea of Fog* · Niko Pirosmani, Georgian landscape with a procession ·
Giovanni Paolo Panini, *Picture Gallery with Views of Modern Rome* · Arnold Böcklin, *Isle of the Dead*.
From WikiArt (Hugging Face dataset `huggan/wikiart`, picked by eye with `wikiart/sheets.py` and copied with
`wikiart/extract.py`): a Baroque flower still life · John Atkinson Grimshaw, a moonlit lane · Caravaggio,
*The Cardsharps* · Ivan Aivazovsky, a sunset over the sea · Vincent van Gogh, a wheat field.
Records for each file are in `art-licences/`. The parchment, gilt frame, wood and the pencil line-art are generated
(`prep.py`). Wikimedia rate-limits shared IPs at times; `direct.py` fetches standard-size thumbnails slowly.

## Music version (no voice)

`comp/scenes2.js` + `timeline2.json`: the same paintings cut to a song instead of the narration — every cut on the
song's beat grid (first strong beat 2.36 s, 0.4731 s per beat), with bloom, warm light leaks, drifting dust and
flashes on the music's hits. The song itself is not in the repo (it is a third-party track and needs a licence for
commercial use); put it at `../artad2/song.wav` (or edit the path) and render with
`PAGE=index2.html node render.js frames2 30 3`, then mux the song with ffmpeg (loudnorm to -14 LUFS).
