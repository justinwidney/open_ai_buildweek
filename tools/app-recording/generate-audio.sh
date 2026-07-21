#!/bin/bash
# Generates one narration mp3 per screen from narration.txt using edge-tts.
# Requires: pip install edge-tts
# Usage: ./generate-audio.sh [voice]   (default voice: en-US-JennyNeural)
set -e
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VOICE="${1:-en-US-JennyNeural}"
AUD="$HERE/audio"
mkdir -p "$AUD"

names=(01-home 02-onboarding 03-journey 04-cards 05-codex 06-gpt 07-closing)

# Split narration.txt on "### " headers, in the same order as `names`.
i=0
text=""
in_section=0
while IFS= read -r line; do
  if [[ "$line" == "### "* ]]; then
    if [[ $in_section -eq 1 && -n "$text" ]]; then
      echo "Generating ${names[$i]}..."
      edge-tts --voice "$VOICE" --text "$text" --write-media "$AUD/${names[$i]}.mp3"
      i=$((i + 1))
    fi
    text=""
    in_section=1
  elif [[ $in_section -eq 1 && -n "$line" ]]; then
    text="$line"
  fi
done < "$HERE/narration.txt"

if [[ $in_section -eq 1 && -n "$text" ]]; then
  echo "Generating ${names[$i]}..."
  edge-tts --voice "$VOICE" --text "$text" --write-media "$AUD/${names[$i]}.mp3"
fi

echo "Done. Audio in $AUD"
