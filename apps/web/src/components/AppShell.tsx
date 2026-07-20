import { useState, type FormEvent, type ReactNode } from "react";
import "./AppShell.css";

export type SkillPanelData = {
  title: string;
  subtitle: string;
  level: number;
  experience: number;
  nextLevel: number;
  concepts: string[];
};

export type AppShellProps = {
  /** The Three.js canvas or other full-bleed experience. */
  children: ReactNode;
  activeSkill?: SkillPanelData;
  onMenuClick?: () => void;
  onToolClick?: (tool: "skills" | "path" | "add" | "ideas" | "profile" | "share") => void;
  onPromptSubmit?: (prompt: string) => void;
  onActivitiesClick?: () => void;
};

const defaultSkill: SkillPanelData = {
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

const toolIcons = {
  skills: "✳",
  path: "⌁",
  add: "+",
  ideas: "♧",
  profile: "♙",
  share: "↗",
} as const;

function ToolButton({
  tool,
  onClick,
}: {
  tool: keyof typeof toolIcons;
  onClick?: AppShellProps["onToolClick"];
}) {
  return (
    <button
      type="button"
      className={"shell-icon-button shell-tool--" + tool}
      onClick={() => onClick?.(tool)}
      aria-label={tool}
    >
      {toolIcons[tool]}
    </button>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="skill-meter">
      <div className="skill-meter__label"><span>{label}</span><span>{value}%</span></div>
      <div className="skill-meter__track" aria-label={`${label}: ${value}%`}>
        <span style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
      </div>
    </div>
  );
}

export function AppShell({
  children,
  activeSkill = defaultSkill,
  onMenuClick,
  onToolClick,
  onPromptSubmit,
  onActivitiesClick,
}: AppShellProps) {
  const [isSkillPanelOpen, setSkillPanelOpen] = useState(false);

  const handlePrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prompt = String(form.get("prompt") ?? "").trim();
    if (prompt) onPromptSubmit?.(prompt);
    event.currentTarget.reset();
  };

  return (
    <main className="app-shell">
      <div className="app-shell__world">{children}</div>
      <div className="app-shell__scrim" aria-hidden="true" />

      <header className="app-shell__brand">
        <button type="button" className="shell-icon-button shell-menu-button" onClick={onMenuClick} aria-label="Open menu">
          <span /><span /><span />
        </button>
        <div className="app-shell__wordmark"><strong>Control AI</strong><span>Skill Planner</span></div>
      </header>

      <nav className="app-shell__tools" aria-label="World tools">
        <ToolButton tool="skills" onClick={(tool) => {
          setSkillPanelOpen((open) => !open);
          onToolClick?.(tool);
        }} />
        <ToolButton tool="path" onClick={onToolClick} />
        <ToolButton tool="add" onClick={onToolClick} />
        <ToolButton tool="ideas" onClick={onToolClick} />
        <ToolButton tool="profile" onClick={onToolClick} />
        <ToolButton tool="share" onClick={onToolClick} />
      </nav>

      <aside className={`skill-panel${isSkillPanelOpen ? " skill-panel--open" : ""}`} aria-label="Active skill details">
        <button className="skill-panel__close" aria-label="Close skill details" onClick={() => setSkillPanelOpen(false)}>×</button>
        <div className="skill-panel__ribbon">Active Skill</div>
        <div className="skill-panel__identity">
          <div className="skill-panel__crest" aria-hidden="true">♛</div>
          <div><h1>{activeSkill.title}</h1><p>{activeSkill.subtitle}</p></div>
        </div>
        <section className="skill-panel__section">
          <h2>Aim / Intention</h2>
          <p>Grow leadership to inspire, guide, and empower others, while staying true to your own values.</p>
        </section>
        <section className="skill-panel__section skill-panel__progress">
          <h2>Progress</h2>
          <div className="skill-panel__level"><span>Level</span><b>{activeSkill.level}</b></div>
          <Meter label="Experience" value={activeSkill.experience} />
          <Meter label="Next Level" value={activeSkill.nextLevel} />
        </section>
        <section className="skill-panel__section skill-panel__concepts">
          <h2>Key Concepts</h2>
          <ul>{activeSkill.concepts.map((concept) => <li key={concept}>{concept}</li>)}</ul>
        </section>
        <button type="button" className="skill-panel__activities" onClick={onActivitiesClick}>View Activities <span>›</span></button>
      </aside>

      <form className="app-shell__prompt" onSubmit={handlePrompt}>
        <span className="prompt-spark" aria-hidden="true">✳</span>
        <label className="sr-only" htmlFor="world-prompt">Ask a question or jump to a skill</label>
        <input id="world-prompt" name="prompt" autoComplete="off" placeholder="Ask a question or jump to a skill..." />
        <button type="submit" aria-label="Submit question">?</button>
      </form>
    </main>
  );
}
