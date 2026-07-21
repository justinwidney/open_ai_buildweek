# App tour recording

Fullscreen narrated walkthrough of 7 screens (home → onboarding → decision
journey, plus 4 Storybook design-system screens), built entirely with local
tooling — no paid services. Output: `tools/app-recording/app-tour.mp4`.

Screens covered, in order: Home, Onboarding, Decision Journey, Foundations /
Design tokens, Year planner, Decision cards, Charter cards.

## Prerequisites (one-time)

```sh
# Neural TTS narration (Microsoft Edge voices, free, no API key)
pip install edge-tts

# Video capture (Playwright + Chromium)
cd tools/app-recording
npm install
npx playwright install chromium
```

You also need `ffmpeg` on your PATH (this machine already has it via the
ImageMagick install).

## Files

- `narration.txt` — the script. One `### Heading` per screen, followed by
  the paragraph to narrate. Edit this to change what's said.
- `generate-audio.sh` — turns `narration.txt` into `audio/<screen>.mp3` via
  edge-tts.
- `capture.mjs` — launches Chromium, visits each screen at 1920x1080, and
  records a `.webm` for exactly as long as that screen's narration audio
  (+2s buffer), into `video/`.
- `mux.sh` — pairs each `video/*.webm` with its `audio/*.mp3` (trimming the
  video's leading page-load time so the *settled* screen lines up with the
  narration), then concatenates everything into `app-tour.mp4`.

## Rerun everything

```sh
cd tools/app-recording

# 1. Regenerate narration audio (only needed if narration.txt changed)
./generate-audio.sh                       # default voice: en-US-JennyNeural
./generate-audio.sh en-US-GuyNeural       # or pick another edge-tts voice

# 2. Start the app + storybook dev servers (separate terminals, from repo root)
pnpm --filter @control-ai/web dev          # http://localhost:5173
pnpm --filter @control-ai/web storybook    # http://localhost:6006

# 3. Record video (dev servers must be running first)
node capture.mjs
# If your dev server picked a different port (5173 was busy), override:
#   VITE_URL=http://localhost:5175 node capture.mjs

# 4. Mux audio + video into the final MP4
./mux.sh
```

Final video: `tools/app-recording/app-tour.mp4`.

## Changing which screens are captured

Edit the `screens` array in `capture.mjs` (name, URL) and the matching
`names` array in `mux.sh` — they must stay in the same order as the
`### Heading` sections in `narration.txt`. Storybook story URLs follow the
pattern `http://localhost:6006/iframe.html?id=<story-id>&viewMode=story`;
list all available story ids with:

```sh
curl -s http://localhost:6006/index.json | python -c "
import json,sys
for k,v in json.load(sys.stdin)['entries'].items():
    if v.get('type')=='story': print(k)"
```

## Notes

- `audio/`, `video/`, `clips/`, `*.mp4`, and `node_modules/` under
  `tools/app-recording/` are gitignored — they're regenerated output, not
  source. The generated `app-tour.mp4` and narration `.mp3`s from this run
  are still on disk locally even though git won't track them.
- The live-app screens use dev-only query flags (`?editStart=1` to jump to
  onboarding, `?skipHome=1` to jump straight to the decision journey) — they
  only work against the Vite **dev** server, not a production build.
