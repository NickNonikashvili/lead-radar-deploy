#!/bin/sh
# Mixes narration over the music (the music dips under the voice), normalises loudness for online video
# (-14 LUFS, true peak -1.5 dB), and encodes the frames to H.264 1080p30.
#   ./assemble.sh <framesDir> <out.mp4> [music.wav]     (an empty framesDir only makes mix.wav)
set -e
cd "$(dirname "$0")"
FR="$1"; OUT="$2"; MUSIC="${3:-music.wav}"
# the music dips under the voice on a curve built from the narration's word timings (see duck.py)
python3 duck.py "$MUSIC" music-ducked.wav
PRE="[0:a]aformat=sample_rates=48000:channel_layouts=stereo,adeclick,highpass=f=90,equalizer=f=3200:width_type=o:width=1.2:g=1.5,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120:makeup=2[voice];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,equalizer=f=4000:width_type=o:width=1:g=-3,bass=g=-2:f=110,volume=${MUSIC_DB:--11}dB[m];
  [voice][m]amix=inputs=2:normalize=0:duration=longest"
M=$(ffmpeg -hide_banner -i narration.wav -i music-ducked.wav -filter_complex "$PRE,loudnorm=I=-14:TP=-2:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
mi=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_i'])"); mtp=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_tp'])")
mlra=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_lra'])"); mth=$(echo "$M" | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['input_thresh'])")
ffmpeg -v error -y -i narration.wav -i music-ducked.wav -filter_complex "$PRE,loudnorm=I=-14:TP=-2:LRA=11:measured_I=$mi:measured_TP=$mtp:measured_LRA=$mlra:measured_thresh=$mth:linear=true,alimiter=limit=0.78:attack=5:release=200:level=disabled,volume=0.6dB[out]" \
  -map "[out]" -ar 48000 mix.wav
[ -n "$FR" ] || exit 0
ffmpeg -v error -y -framerate 30 -i "$FR/%05d.jpg" -i mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -level 4.1 -tune animation -g 60 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of compact "$OUT"
