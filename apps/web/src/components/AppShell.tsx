import { useState, type ReactNode } from "react";
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
  /** Tools that open their own surface instead of a panel page. Defaults to true. */
  opensPanel?: boolean;
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
  onToolClick?: (tool: string) => void;
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
  onClick: (tool: ShellTool) => void;
}) {
  return (
    <button
      type="button"
      className={`shell-icon-button shell-tool--${tool.id}${active ? " is-active" : ""}`}
      onClick={() => onClick(tool)}
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
  onToolClick,
  onActivitiesClick,
}: AppShellProps) {
  const [isPanelOpen, setPanelOpen] = useState(defaultPanelOpen);

  const handleToolClick = (tool: ShellTool) => {
    if (tool.opensPanel !== false) {
      setPanelOpen((open) => tool.id === activeTool ? !open : true);
    }
    onToolClick?.(tool.id);
  };

  return (
    <main className="app-shell">
      <div className="app-shell__world">{children}</div>
      <div className="app-shell__scrim" aria-hidden="true" />

      <header className="app-shell__brand">
        <div className="app-shell__wordmark"><strong>Conquer Your Path</strong></div>
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

    </main>
  );
}
