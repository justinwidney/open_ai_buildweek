# Conquer Your Path — demo video script

Target runtime: **2:40–2:50** at a relaxed 135–145 words per minute.  
Hard limit: **3:00**.

## Voiceover

Most financial planning tools begin with a spreadsheet. I wanted to make the same kind of long-term thinking feel more like exploring a world. So I built **Conquer Your Path**, a branching life and financial simulator where each choice changes the road ahead.

You begin with one simple onboarding screen: your current age and net worth. That establishes the simulation at month zero, before any decisions are applied.

From there, the experience presents major life choices as paths through illustrated environments. You can choose education, a college major, work, housing, pets, family commitments, and other yearly priorities. Choices are not just visual. The simulation engine tracks income, taxes, spending, debt, cash, investments, and net worth over time. The dashboard then shows how those decisions affect your financial trajectory.

For detailed choices, such as selecting a major or career, I built searchable card collections. Opening a card reveals an interactive 3D commitment view with its estimated cost, time requirements, and financial impact. Three.js is loaded only for these cards. The rest of the journey uses React, CSS, and optimized illustrated backgrounds, keeping the normal path lightweight.

I used **Codex** as my agentic development workspace. It helped me inspect the repository, build isolated prototypes, edit the React and TypeScript code, run type checks and production builds, and diagnose issues across the UI and simulation engine. I also used it to compare bundle output, convert oversized route SVGs into much smaller WebP backgrounds, preload upcoming scenes, and make scene transitions atomic so the artwork and its choices appear together.

I used **GPT-5.6** as the reasoning and coding model inside that workflow. It helped turn broad product ideas into concrete architecture, model life events as deterministic decision branches, connect those branches to financial consequences, and reason through performance and user-experience problems. I used faster passes for initial scaffolding, then higher-reasoning passes for debugging, simulation rules, and final polish.

The result is a financial simulator that does more than project a number. It lets you see how a life is shaped one decision at a time—and makes comparing possible futures feel like choosing a path worth taking.

## Recording plan

| Time | On-screen action | Voiceover section |
|---|---|---|
| 0:00–0:16 | Open on the watercolor home reveal and **Conquer Your Path** title. Click **Start Journey**. | “Most financial planning tools…” |
| 0:16–0:31 | Show the single onboarding screen. Enter an age and net worth, then begin. | “You begin with one simple…” |
| 0:31–1:05 | Show the illustrated crossroads. Hover over signs and choose an education route. Let the next scene transition finish. | “From there, the experience…” |
| 1:05–1:27 | Open a major or career collection, search or shuffle, select a card, and rotate the 3D commitment card. | “For detailed choices…” |
| 1:27–1:43 | Return to the journey. Open and close the Life Dashboard; briefly show Overview, Budget, or Accounts. | End of “For detailed choices…” |
| 1:43–2:15 | Cut to Codex/repository footage: show `apps/web/src`, a diff, typecheck/build output, and the optimized route assets. | “I used Codex…” |
| 2:15–2:37 | Continue repository footage: briefly show the decision model or simulation engine, then return to the running app. | “I used GPT-5.6…” |
| 2:37–2:50 | End on a clean crossroads or 3D card shot, then return to the title. | “The result is…” |

## Capture notes

- Record at 1080p with the browser zoom at 100%.
- Use a prepared age/net-worth pair so typing takes only a few seconds.
- Open a major or career card that has visually clear artwork and cost details.
- Keep repository shots short and readable; do not scroll rapidly through code.
- Leave roughly half a second after clicks so transitions can be seen.
- Record the voiceover separately, then use the timestamps above to guide the app recording.
