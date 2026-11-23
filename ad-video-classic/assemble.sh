#!/bin/sh
# Mixes the voice over the score and encodes the frames: voice EQ + gentle compression, loudness -14 LUFS with a
# true-peak ceiling, H.264 1080p30.
#   ./assemble.sh <framesDir|""> <out.mp4>      (an empty framesDir only makes mix.wav)
set -e
cd "$(dirname "$0")"
FR="$1"; OUT="$2"
python3 -I mix.py
PRE="[0:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=80,equalizer=f=250:width_type=o:width=1.5:g=-2,equalizer=f=3500:width_type=o:width=1.2:g=2,acompressor=threshold=-20dB:ratio=2.5:attack=6:release=120:makeup=2,volume=${VOICE_DB:-0}dB[v];
  [1:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${MUSIC_DB:--6}dB[m];
  [v][m]amix=inputs=2:normalize=0:duration=longest"
M=$(ffmpeg -hide_banner -i vo.wav -i music-ducked.wav -filter_complex "$PRE,loudnorm=I=-14:TP=-2:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
j() { echo "$M" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -y -i vo.wav -i music-ducked.wav -filter_complex "$PRE,loudnorm=I=-14:TP=-2:LRA=11:measured_I=$(j input_i):measured_TP=$(j input_tp):measured_LRA=$(j input_lra):measured_thresh=$(j input_thresh):linear=true,alimiter=limit=0.8:attack=5:release=150:level=disabled[out]" \
  -map "[out]" -ar 48000 mix.wav
[ -n "$FR" ] || exit 0
ffmpeg -v error -y -framerate 30 -i "$FR/%05d.jpg" -i mix.wav -map 0:v -map 1:a \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high -level 4.1 -g 60 \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height -of compact "$OUT"
