#!/bin/bash
# frames6 (the one-take story, 969 frames) + the client's reveal (from black) with a 1 s hold and fade, then the mix
set -e
cd "$(dirname "$0")"
A=../../artad
ffmpeg -v error -y -framerate 30 -i $A/frames6/%05d.jpg -c:v libx264 -preset medium -crf 16 -pix_fmt yuv420p -r 30 story6.mp4
printf "file 'story6.mp4'\nfile 'outro_tag.mp4'\n" > list6.txt
ffmpeg -v error -y -f concat -safe 0 -i list6.txt -c copy video6.mp4
ffmpeg -v error -y -i video6.mp4 -i mix6.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 17 -pix_fmt yuv420p -profile:v high -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest $A/evosoft-ad-oner.mp4
ffprobe -v error -show_entries format=duration:stream=codec_name,nb_frames -of compact $A/evosoft-ad-oner.mp4
