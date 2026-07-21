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

export type ShellTool = {
  id: string;
  label: string;
  icon: ReactNode;
};

export type AppShellProps = {
  /** The full-bleed world scene. */
  children: ReactNode;
  activeSkill?: SkillPanelData;
  tools?: readonly ShellTool[];
  activeTool?: string;
  panel?: ReactNode;
  panelTitle?: string;
  defaultPanelOpen?: boolean;
  worldHud?: ReactNode;
  onMenuClick?: () => void;
  onToolClick?: (tool: string) => void;
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

const DEFAULT_TOOLS: readonly ShellTool[] = [
  { id: "skills", label: "Skills", icon: "\u2733" },
  { id: "path", label: "Path", icon: "\u2301" },
  { id: "add", label: "Add", icon: "+" },
  { id: "ideas", label: "Ideas", icon: "\u2667" },
  { id: "profile", label: "Profile", icon: "\u2659" },
  { id: "share", label: "Share", icon: "\u2197" },
];

function ToolButton({
  tool,
  active,
  onClick,
}: {
  tool: ShellTool;
  active: boolean;
  onClick: (tool: string) => void;
}) {
  return (
    <button
      type="button"
      className={`shell-icon-button shell-tool--${tool.id}${active ? " is-active" : ""}`}
      onClick={() => onClick(tool.id)}
      aria-label={tool.label}
      aria-pressed={active}
      title={tool.label}
    >
      {tool.icon}
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
  tools = DEFAULT_TOOLS,
  activeTool,
  panel,
  panelTitle,
  defaultPanelOpen = false,
  worldHud,
  onMenuClick,
  onToolClick,
  onPromptSubmit,
  onActivitiesClick,
}: AppShellProps) {
  const [isPanelOpen, setPanelOpen] = useState(defaultPanelOpen);

  const handlePrompt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const prompt = String(form.get("prompt") ?? "").trim();
    if (prompt) onPromptSubmit?.(prompt);
    event.currentTarget.reset();
  };

  const handleToolClick = (tool: string) => {
    setPanelOpen(true);
    onToolClick?.(tool);
  };

  const handleMenuClick = () => {
    setPanelOpen((open) => !open);
    onMenuClick?.();
  };

  return (
    <main className="app-shell">
      <div className="app-shell__world">{children}</div>
      <div className="app-shell__scrim" aria-hidden="true" />

      <header className="app-shell__brand">
        <button type="button" className="shell-icon-button shell-menu-button" onClick={handleMenuClick} aria-label="Toggle information panel">
          <span /><span /><span />
        </button>
        <div className="app-shell__wordmark"><strong>Control AI</strong><span>Life Pathfinder</span></div>
      </header>

      <nav className="app-shell__tools" aria-label="Journey pages">
        {tools.map((tool) => (
          <ToolButton
            active={tool.id === activeTool}
            key={tool.id}
            onClick={handleToolClick}
            tool={tool}
          />
        ))}
      </nav>

      {worldHud && <div className="app-shell__hud">{worldHud}</div>}

      <aside className={`skill-panel${isPanelOpen ? " skill-panel--open" : ""}${panel ? " skill-panel--page" : ""}`} aria-label={panelTitle ? `${panelTitle} page` : "Active skill details"}>
        <button className="skill-panel__close" type="button" aria-label="Close information panel" onClick={() => setPanelOpen(false)}>{"\u00d7"}</button>
        {panel ? (
          <>
            <div className="skill-panel__ribbon">{panelTitle ?? "Your journey"}</div>
            <div className="skill-panel__page-content">{panel}</div>
          </>
        ) : (
          <>
            <div className="skill-panel__ribbon">Active Skill</div>
            <div className="skill-panel__identity">
              <div className="skill-panel__crest" aria-hidden="true">{"\u265b"}</div>
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
            <button type="button" className="skill-panel__activities" onClick={onActivitiesClick}>View Activities <span>{"\u203a"}</span></button>
          </>
        )}
      </aside>

      <form className="app-shell__prompt" onSubmit={handlePrompt}>
        <span className="prompt-spark" aria-hidden="true">{"\u2733"}</span>
        <label className="sr-only" htmlFor="world-prompt">Ask a question or jump to a page</label>
        <input id="world-prompt" name="prompt" autoComplete="off" placeholder="Ask a question or jump to a page..." />
        <button type="submit" aria-label="Submit question">?</button>
      </form>
    </main>
  );
}
