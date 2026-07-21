#!/bin/bash
# Pairs each screen's video with its narration audio (trimming the video's
# tail so it lines up with the audio length, since page-load time at the
# start of each clip varies), then concatenates all screens into one MP4.
# Usage: ./mux.sh
set -e
FFMPEG="ffmpeg"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VID="$HERE/video"
AUD="$HERE/audio"
CLIPS="$HERE/clips"
mkdir -p "$CLIPS"

get_dur() {
  "$FFMPEG" -i "$1" 2>&1 | grep "Duration" | sed -E 's/.*Duration: ([0-9]+):([0-9]+):([0-9.]+).*/\1 \2 \3/' | \
    awk '{printf "%.3f", $1*3600 + $2*60 + $3}'
}

if [[ -n "$SEGMENTS" ]]; then
  IFS=',' read -ra names <<< "$SEGMENTS"
else
  names=(01-home 02-onboarding 03-journey 04-cards 05-codex 06-gpt 07-closing)
fi
OUT_NAME="${OUT_NAME:-app-tour.mp4}"

for name in "${names[@]}"; do
  vfile="$VID/$name.webm"
  afile="$AUD/$name.mp3"
  cfile="$CLIPS/$name.mp4"

  vdur=$(get_dur "$vfile")
  adur=$(get_dur "$afile")
  # Trim from the start so the *tail* of the recording (the settled screen,
  # after the page has finished loading) is what lines up with the narration.
  offset=$(awk -v v="$vdur" -v a="$adur" 'BEGIN{o=v-a; if(o<0)o=0; printf "%.3f", o}')

  echo "[$name] video=$vdur audio=$adur offset=$offset"

  "$FFMPEG" -y -ss "$offset" -i "$vfile" -i "$afile" \
    -map 0:v -map 1:a -c:v libx264 -pix_fmt yuv420p -profile:v high -r 30 \
    -c:a aac -b:a 192k -shortest "$cfile" -loglevel error

done

# Reset every segment's timestamps before concatenation. Copying Playwright's
# timestamps directly can leave gaps that inflate the reported final runtime.
inputs=()
filter=""
concat_inputs=""
for i in "${!names[@]}"; do
  inputs+=(-i "$CLIPS/${names[$i]}.mp4")
  filter+="[$i:v]setpts=PTS-STARTPTS[v$i];[$i:a]asetpts=PTS-STARTPTS[a$i];"
  concat_inputs+="[v$i][a$i]"
done
filter+="${concat_inputs}concat=n=${#names[@]}:v=1:a=1[outv][outa]"

"$FFMPEG" -y "${inputs[@]}" -filter_complex "$filter" \
  -map "[outv]" -map "[outa]" -c:v libx264 -pix_fmt yuv420p -profile:v high -r 30 \
  -c:a aac -b:a 192k -movflags +faststart "$HERE/$OUT_NAME" -loglevel error
echo "FINAL: $HERE/$OUT_NAME"
