import { useCallback, useEffect, useMemo, useState } from "react";
import { UiShell, type SkillPanelData } from "./components";
import { WorldEffectsLab, type WorldEffect } from "./components/WorldEffectsLab";
import {
  WorldExperience,
  type WorldCommand,
  type WorldCommandInput,
  type WorldPlatform,
  type WorldTuning,
} from "./world";

const DEFAULT_SKILL: SkillPanelData = {
  title: "Leadership",
  subtitle: "Core Enabler",
  level: 1,
  experience: 34,
  nextLevel: 74,
  concepts: [
    "Lead with vision & clarity",
    "Communicate with impact",
    "Empower and develop others",
    "Make thoughtful decisions",
    "Adapt and grow together",
  ],
};

const DEFAULT_TUNING: WorldTuning = {
  parallaxDepth: 1,
  travelDuration: 1,
  motionBlur: 1,
  turnDuration: 1,
  rockProfile: "storybook",
  backdropEnabled: true,
};

const WORLD_EFFECTS: readonly WorldEffect[] = ["backdrop", "travel", "turn", "rocks"];

function effectFromHash(): WorldEffect {
  const candidate = window.location.hash.split("/")[1] as WorldEffect | undefined;
  return candidate && WORLD_EFFECTS.includes(candidate) ? candidate : "backdrop";
}

export function App() {
  const [selected, setSelected] = useState<WorldPlatform | undefined>();
  const [labOpen, setLabOpen] = useState(() => window.location.hash.startsWith("#lab"));
  const [activeEffect, setActiveEffect] = useState<WorldEffect>(effectFromHash);
  const [tuning, setTuning] = useState(DEFAULT_TUNING);
  const [command, setCommand] = useState<WorldCommand>();
  const [worldRevision, setWorldRevision] = useState(0);

  const activeSkill = useMemo<SkillPanelData>(() => selected ? {
    ...DEFAULT_SKILL,
    title: selected.title,
    subtitle: selected.subtitle,
    experience: Math.min(92, 18 + selected.radius * 12),
    concepts: ["Select a direction", "Complete an activity", "Return to this platform"],
  } : DEFAULT_SKILL, [selected]);

  const handlePrompt = useCallback((prompt: string) => {
    // MVP contract: replace this with an engine/query package later.
    const normalized = prompt.toLowerCase();
    if (normalized.includes("lead")) setSelected({ id: "leadership", title: "Leadership", subtitle: "Bring others along", position: [0, 3.5, -34], radius: 1.3, kind: "front" });
  }, []);

  const issueCommand = useCallback((next: WorldCommandInput) => {
    if (next.type === "reset") {
      setCommand(undefined);
      setWorldRevision((revision) => revision + 1);
      setSelected(undefined);
      return;
    }
    setCommand({ ...next, id: performance.now() });
  }, []);

  const updateTuning = useCallback((next: WorldTuning) => {
    const rebuildWorld = tuning.rockProfile !== next.rockProfile
      || tuning.travelDuration !== next.travelDuration
      || tuning.turnDuration !== next.turnDuration;
    setTuning(next);
    if (rebuildWorld) {
      setCommand(undefined);
      setWorldRevision((revision) => revision + 1);
    }
  }, [tuning]);

  useEffect(() => {
    const onHashChange = () => {
      setLabOpen(window.location.hash.startsWith("#lab"));
      setActiveEffect(effectFromHash());
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.key.toLowerCase() !== "l") return;
      setLabOpen((open) => {
        const next = !open;
        window.history.replaceState(null, "", next ? `#lab/${activeEffect}` : `${window.location.pathname}${window.location.search}`);
        return next;
      });
    };
    window.addEventListener("hashchange", onHashChange);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("hashchange", onHashChange);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [activeEffect]);

  const toggleLab = useCallback(() => {
    setLabOpen((open) => {
      const next = !open;
      window.history.replaceState(null, "", next ? `#lab/${activeEffect}` : `${window.location.pathname}${window.location.search}`);
      return next;
    });
  }, [activeEffect]);

  const selectEffect = useCallback((effect: WorldEffect) => {
    setActiveEffect(effect);
    window.history.replaceState(null, "", `#lab/${effect}`);
  }, []);

  return (
    <>
      <UiShell
        activeSkill={activeSkill}
        onPromptSubmit={handlePrompt}
        onToolClick={(tool) => { if (tool === "ideas") toggleLab(); }}
      >
        <WorldExperience
          key={worldRevision}
          command={command}
          tuning={tuning}
          onPlatformSelect={setSelected}
        />
      </UiShell>
      {labOpen && (
        <WorldEffectsLab
          activeEffect={activeEffect}
          tuning={tuning}
          onActiveEffectChange={selectEffect}
          onClose={toggleLab}
          onCommand={issueCommand}
          onTuningChange={updateTuning}
        />
      )}
    </>
  );
}
