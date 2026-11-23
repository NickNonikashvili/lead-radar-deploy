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

## Story version (no voice, no captions)

`comp/scenes3.js` + `timeline3.json` + `comp/index3.html`: the same song, but the pictures tell what EvoSoft does.
A pencil sketches the real homepage on parchment, it fills in and hangs in Panini's gallery; EVOSOFT; a phone rises
between Michelangelo's hands and the touch wakes it; code written in ink becomes the Evo app; SOFTWARE with
Caravaggio's players; the store dashboard glowing in Grimshaw's night lane while orders stack up through the night;
gold bars rise out of the fog in front of Friedrich's wanderer; the apps hang in gilt frames and one opens onto Van
Gogh's wheat field; Adam reaches for Aivazovsky's sun; the Georgian site on a phone over Pirosmani; "EvoSoft" signed
and sealed in red wax; an end card with services, Tbilisi, the address and "Get a free quote".

It uses real screenshots of the site and apps: run the site locally (`php -S 127.0.0.1:8400` in the site root) and
`node capture.js` for `shots/home|home_ka|mobile|mobile_ka|services.png` (convert to jpg); the app screens
(`evo`, `mailtabs`, `studycat`, `register`, `reports`, `store`) come from the demo screenshots. `python3 -I prep.py
ui_sketch` makes the pencil version of the homepage and its reveal map. Then
`PAGE=index3.html node render.js frames3 30 3` and mux with the song as above.

## Version with the logo-reveal outro

`comp/scenes4.js` + `timeline4.json` + `comp/index4.html`: the story version up to the signature, now stamped with a
red wax seal carrying the new X mark on the song's beat (32.17 s); the camera then dives into the seal and fades to
black at 34.0 s, where the client's 7.5 s 3D logo reveal takes over (not in the repo), held for a second on the final
lockup and faded out. The site screenshots were captured again so they show the new logo.

Music: the song continues under the outro through a beat-aligned jump (`outro-music.py`): at 25.59 s it jumps back
32 beats (15.153 s, refined by lining up the drum pattern), so the song's stop-and-drop at 23.18 s lands 5 ms after
the X locks (outro frame 130). `outro-splice.py` scores the possible jump points by spectral similarity. Then:

```bash
PAGE=index4.html node render.js frames4 30 3
python3 -I outro-music.py 34.0          # reads the reel's audio (rec.wav), writes music_raw.wav
ffmpeg -i music_raw.wav -af loudnorm=I=-14:TP=-1.5:LRA=11 music_mix.wav
ffmpeg -framerate 30 -i frames4/%05d.jpg -i logo-reveal.mp4 -i music_mix.wav -filter_complex \
  "[0:v]format=yuv420p,setsar=1[a];[1:v]fps=30,scale=1920:1080,setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration=1,fade=t=out:st=7.7:d=0.8[b];[a][b]concat=n=2:v=1:a=0[v]" \
  -map "[v]" -map 2:a -c:v libx264 -crf 21 -c:a aac -b:a 192k -shortest evosoft-ad-logo-outro.mp4
```

## Studio version with sound design (about 43 s)

`evosoft-ad-studio.mp4`. It is set in a dark studio matching the 3D logo reveal: a glossy floor, blue and white spheres, and the
real EvoSoft site and apps on floating screens. It has no voice and no captions. It ends with the client's logo reveal,
which now has sound effects, and a startup chime as the X locks into place.

| File | What it does |
|---|---|
| `comp/scenes5.js`, `comp/index5.html`, `timeline5.json` | the eight shots, timed to the song's beats |
| `studio-sound/chime.py` | the startup chime: a D-major chord spread over three octaves, with a slow bloom and a hall tail. It is an original sound, not Apple's (theirs is a registered trademark). |
| `studio-sound/bounces.py` | finds every sphere bounce in the logo reveal, from its frames |
| `studio-sound/outro_sfx.py`, `sfx_choice.json` | the logo-reveal sound effects, placed on the detected frames: bounces, a shimmer when the spheres become shards, whooshes, the lock and the chime, and ticks as the letters land |
| `studio-sound/mix5.py` | the song (from 28.2 s), faded under the reveal, plus the effects |

```bash
PAGE=index5.html node render.js frames5 30 4      # with an http server on :8600 in this folder
python3 -I studio-sound/chime.py                  # writes studio-sound/chime.wav
# bounces: in a folder of the reveal's frames (ffmpeg -i reveal.mp4 -vf scale=480:270 f%03d.png), run bounces.py,
# then copy its bounces.json into studio-sound/. sfx_choice.json lists the effect files (paths to your downloads).
python3 -I studio-sound/outro_sfx.py studio-sound/sfx_choice.json
python3 -I studio-sound/mix5.py song.wav outro_sfx.wav mix5.wav
```

Timing:

- The song's first bass hit (2.0 s) lands as the white sphere hits the floor.
- Its dead stop dims the lights (16.3 s), and its explosion cuts to the store shot (17.15 s).
- The store orders pop one per beat, and the screens burst into spheres on a downbeat (32.27 s).
- The song fades under the falling spheres of the reveal, so the effects and the chime are heard on their own.

### Credits (put these in the video description)

Music: "Furious Freak" by Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License,
http://creativecommons.org/licenses/by/3.0/

Sound effects (freesound.org, CC BY 3.0, http://creativecommons.org/licenses/by/3.0/):
- "md02.aif", "md06.aif", "md08.aif", "md09.aif" and "losnb01.aif" by lsprice
- "Bounce-SeaglassOnWood.WAV" by francisjanderson
- "Bamboo Swing, C5.wav" by InspectorJ
- "Ropeswoosh 1.wav" by Benboncan

These are also used, under CC0, so no credit is needed:
- "glass_shard_bounce.ogg" by C_Rogers
- "windy movement 29" by qubodup
- "Windchimes" by Samulis
- "Boom_01.wav" by Faulkin
- "glass clicks" by arseniiv

The song and the effects are not in this repository. Download them from their pages.
