# EvoSoft ad video (2 minutes)

The source of the narrated ad for evosoft.solutions: the real site recorded in a browser, a narrator, captions and an
original music bed, put together frame by frame. © 2026 EvoSoft Solutions. All rights reserved.

The finished video isn't stored here (it's large). This folder holds what is needed to make it again, for example after
the site changes. Everything runs locally; the narration uses the OpenAI speech API.

| Step | Command | What it does |
|---|---|---|
| 1. Serve the site | `php -S 127.0.0.1:8400 -t ../evosoft-site` (keep running) | The recorder visits it |
| 2. Record | `node record.js all` then `python3 prune.py hero services products evopage demos process languages assistant quote mobile` | Each scene in slow motion (page animations at a quarter speed), so the footage is smooth; blank frames between page loads are dropped |
| 3. Narrate | `python3 tts.py script.json --voice cedar` | One audio file per scene, plus word timings from a transcription |
| 4. Timeline | `python3 build_timeline.py` | Scene lengths from the narration; footage, screenshot changes and camera moves tied to spoken words; captions and `evosoft-ad.srt` |
| 5. Music | `python3 music.py --duration <length> --groove 5.32 --outro 118.3 --brk 70.24 --phase 70.24` | Original synthesized music (no samples, no licences); length and cue times come from step 4 |
| 6. Render | `python3 -m http.server 8500` (from this folder), then `node render.js frames 30 3` | Draws all 3,600+ frames with `comp/` in headless Chromium |
| 7. Assemble | `./assemble.sh frames evosoft-ad.mp4 music.wav` | Voice over music (the music dips under the voice), loudness for online video (about -14 LUFS, peaks below -1.5 dB), H.264 1080p30 |

Requirements: Node 18+, Playwright with Chromium, Python 3 with numpy, ffmpeg, ImageMagick (contact sheets) and an
OpenAI API key for step 3. The quote-form scene needs the form in test mode while recording: an `api/config.php`
with `'mail_mode' => 'log'` in the site (delete it afterwards).

- `script.json`: the narration, on-screen headlines and the voice direction.
- `build_timeline.py`, `VISUALS`: which footage each scene uses and which spoken word each action lands on.
- `sheet.py` / `qa_sheets.py`: contact sheets for checking a recording or the finished video frame by frame.
- `listen.py`: asks an audio-capable model about the sound (mix, clarity, glitches).
