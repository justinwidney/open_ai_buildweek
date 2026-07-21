import { useMemo, useState, type CSSProperties } from "react";
import {
  branchEligibility,
  type DecisionBranch,
  type DecisionNode,
  type LifeContext,
} from "@control-ai/engine";
import { detailsForDecision, type DecisionChoiceDetails } from "./decisionCatalog";
import { directionsForOptions, ROUTE_DIRECTION_LABELS, type RouteDirection } from "./decisionMaps";
import { isInertBranch, nodeEmoji, routeKindForNode } from "./journeyGraph";
import "./DecisionExperience.css";

interface DecisionExperienceProps {
  node: DecisionNode;
  ctx: LifeContext;
  age: number;
  onChoose: (branch: DecisionBranch) => void;
  onDismiss?: () => void;
}

type SignPosition = { x: number; y: number; rotate: number };

const SIGN_POSITIONS: Record<number, readonly SignPosition[]> = {
  1: [{ x: 50, y: 54, rotate: 0 }],
  2: [{ x: 32, y: 49, rotate: -7 }, { x: 68, y: 49, rotate: 7 }],
  3: [{ x: 25, y: 42, rotate: -8 }, { x: 50, y: 55, rotate: 0 }, { x: 75, y: 42, rotate: 8 }],
  4: [{ x: 18, y: 38, rotate: -9 }, { x: 39, y: 51, rotate: -3 }, { x: 61, y: 51, rotate: 3 }, { x: 82, y: 38, rotate: 9 }],
  5: [{ x: 14, y: 35, rotate: -10 }, { x: 32, y: 47, rotate: -5 }, { x: 50, y: 57, rotate: 0 }, { x: 68, y: 47, rotate: 5 }, { x: 86, y: 35, rotate: 10 }],
};

function signPosition(index: number, count: number): SignPosition {
  const positions = SIGN_POSITIONS[Math.min(5, Math.max(1, count))] ?? SIGN_POSITIONS[1]!;
  return positions[index] ?? { x: 50, y: 55, rotate: 0 };
}

function SignArtwork({ direction }: { direction: RouteDirection }) {
  const points = direction === "left"
    ? "22,21 244,21 244,96 22,96 2,58"
    : direction === "right"
      ? "16,21 236,21 258,58 236,96 16,96"
      : "14,21 246,21 246,96 14,96";

  return (
    <svg className="road-sign__art" viewBox="0 0 260 158" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`wood-${direction}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f4dfac" />
          <stop offset="1" stopColor="#c79656" />
        </linearGradient>
      </defs>
      <path d="M122 89h17l8 69h-34z" fill="#6e4629" stroke="#3d291c" strokeWidth="4" />
      <polygon points={points} fill={`url(#wood-${direction})`} stroke="#4d321f" strokeWidth="5" strokeLinejoin="round" />
      <path d="M28 34h200M30 82h196" stroke="#fff3cd" strokeOpacity=".34" strokeWidth="3" strokeLinecap="round" />
      <circle cx="31" cy="59" r="4" fill="#70472a" />
      <circle cx="229" cy="59" r="4" fill="#70472a" />
    </svg>
  );
}

function RoadDecisionSigns({ node, ctx, age, onChoose, onDismiss }: DecisionExperienceProps) {
  const routeKind = routeKindForNode(node);
  const directions = directionsForOptions(node.branches.length, routeKind);

  return (
    <section className="road-decision" aria-labelledby="road-decision-title">
      <header className="road-decision__prompt">
        <span>A crossroads · age {age}</span>
        <h2 id="road-decision-title">{nodeEmoji(node)} {node.title}</h2>
        <p>{node.prompt}</p>
        {onDismiss && <button type="button" onClick={onDismiss}>Maybe later</button>}
      </header>
      <div className="road-decision__sign-field">
        {node.branches.map((branch, index) => {
          const position = signPosition(index, node.branches.length);
          const direction = directions[index] ?? "winding";
          const eligibility = branchEligibility(branch, ctx);
          const style = {
            "--sign-x": `${position.x}%`,
            "--sign-y": `${position.y}%`,
            "--sign-rotate": `${position.rotate}deg`,
            "--sign-delay": `${index * 70}ms`,
          } as CSSProperties;

          return (
            <button
              type="button"
              className={`road-decision__sign is-${direction}${isInertBranch(branch) ? " is-decline" : ""}`}
              disabled={!eligibility.eligible}
              key={branch.id}
              onClick={() => onChoose(branch)}
              style={style}
              title={eligibility.eligible ? branch.description : eligibility.reasons.join(" ")}
            >
              <SignArtwork direction={direction} />
              <span className="road-sign__copy">
                <small>{ROUTE_DIRECTION_LABELS[direction]}</small>
                <strong>{branch.label}</strong>
              </span>
            </button>
          );
        })}
      </div>
      <p className="road-decision__hint">Choose a sign to take that road</p>
    </section>
  );
}

type ExplorerSort = "featured" | "salary" | "cost" | "difficulty" | "title";

interface ExplorerItem {
  branch: DecisionBranch;
  details: DecisionChoiceDetails;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function difficultyDots(level: number) {
  return Array.from({ length: 5 }, (_, index) => <i className={index < level ? "is-filled" : ""} key={index} />);
}

function DecisionExplorer({ node, ctx, age, onChoose, onDismiss }: DecisionExperienceProps) {
  const catalog = detailsForDecision(node.id) ?? [];
  const isMajor = catalog[0]?.kind === "major";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState<ExplorerSort>("featured");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const items = useMemo<ExplorerItem[]>(() => node.branches.flatMap((branch) => {
    const catalogId = branch.id.replace(/^switch-/, "");
    const details = catalog.find((item) => item.id === catalogId);
    return details ? [{ branch, details }] : [];
  }), [catalog, node.branches]);

  const categories = useMemo(() => ["All", ...new Set(items.map(({ details }) => details.category))], [items]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const next = items.filter(({ branch, details }) => {
      const matchesCategory = category === "All" || details.category === category;
      const haystack = [branch.label, branch.description, details.category, details.note, ...details.tags].join(" ").toLowerCase();
      return matchesCategory && (!normalized || haystack.includes(normalized));
    });
    return [...next].sort((a, b) => {
      if (sort === "salary") return b.details.startingSalary - a.details.startingSalary;
      if (sort === "cost") return a.details.cost - b.details.cost;
      if (sort === "difficulty") return a.details.difficulty - b.details.difficulty;
      if (sort === "title") return a.branch.label.localeCompare(b.branch.label);
      return 0;
    });
  }, [category, items, query, sort]);

  const selected = filtered.find(({ branch }) => branch.id === selectedId) ?? filtered[0] ?? null;
  const inactiveBranch = node.branches.find((branch) => isInertBranch(branch));
  const selectedEligibility = selected ? branchEligibility(selected.branch, ctx) : null;

  return (
    <div className="decision-window-layer">
      <section className="decision-window" role="dialog" aria-modal="true" aria-labelledby="decision-window-title">
        <header className="decision-window__header">
          <div className="decision-window__mark" aria-hidden="true">{isMajor ? "A" : "W"}</div>
          <div>
            <span>{isMajor ? "College route" : "Work route"} · age {age}</span>
            <h2 id="decision-window-title">{node.title}</h2>
            <p>{isMajor ? "Compare programs, costs, workload, and first-career estimates." : "Explore starter roles by pay, preparation, pace, and growth potential."}</p>
          </div>
          {onDismiss && <button className="decision-window__close" type="button" aria-label="Close chooser" onClick={onDismiss}>×</button>}
        </header>

        <div className="decision-window__notice">
          <b>Planning estimates</b>
          <span>Figures are illustrative simulation inputs, not school quotes or job offers.</span>
        </div>

        <div className="decision-window__toolbar">
          <label className="decision-search">
            <span aria-hidden="true">⌕</span>
            <span className="sr-only">Search {isMajor ? "majors" : "jobs"}</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${isMajor ? "majors, skills, or fields" : "jobs, skills, or industries"}…`} autoFocus />
          </label>
          <label>
            <span className="sr-only">Sort results</span>
            <select value={sort} onChange={(event) => setSort(event.target.value as ExplorerSort)}>
              <option value="featured">Recommended order</option>
              <option value="salary">Highest starting pay</option>
              <option value="cost">Lowest cost</option>
              <option value="difficulty">Easiest first</option>
              <option value="title">A–Z</option>
            </select>
          </label>
        </div>

        <div className="decision-window__categories" aria-label="Filter by field">
          {categories.map((name) => <button type="button" className={category === name ? "is-active" : ""} onClick={() => setCategory(name)} key={name}>{name}</button>)}
        </div>

        <div className="decision-window__body">
          <div className="decision-results">
            <div className="decision-results__count"><b>{filtered.length}</b> {isMajor ? "programs" : "starter jobs"}</div>
            <div className="decision-results__grid">
              {filtered.map(({ branch, details }) => {
                const eligibility = branchEligibility(branch, ctx);
                return (
                  <button
                    type="button"
                    className={`decision-result${selected?.branch.id === branch.id ? " is-selected" : ""}`}
                    disabled={!eligibility.eligible}
                    key={branch.id}
                    onClick={() => setSelectedId(branch.id)}
                  >
                    <span className="decision-result__top"><em>{details.category}</em><b>{details.outlook}</b></span>
                    <strong>{branch.label}</strong>
                    <span className="decision-result__metrics">
                      <span><small>Starting pay</small>{money(details.startingSalary)}/yr</span>
                      <span><small>{isMajor ? "Est. total" : "Start-up"}</small>{money(details.cost)}</span>
                    </span>
                    <span className="decision-result__difficulty"><small>Challenge</small>{difficultyDots(details.difficulty)}</span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="decision-results__empty"><b>No exact matches</b><span>Try another phrase or choose “All.”</span></div>}
            </div>
          </div>

          <aside className="decision-detail" aria-live="polite">
            {selected ? <>
              <span className="decision-detail__eyebrow">{selected.details.category} · {selected.details.outlook}</span>
              <h3>{selected.branch.label}</h3>
              <p>{selected.details.note}</p>
              <div className="decision-detail__stats">
                <div><small>Expected starting pay</small><strong>{money(selected.details.startingSalary)}<em>/year</em></strong></div>
                <div><small>{selected.details.costLabel}</small><strong>{money(selected.details.cost)}</strong></div>
                <div><small>Time to begin</small><strong>{selected.details.timeLabel}</strong></div>
                <div><small>Difficulty</small><strong className="decision-detail__dots">{difficultyDots(selected.details.difficulty)}</strong></div>
              </div>
              <div className="decision-detail__tags">{selected.details.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
              <p className="decision-detail__description">{selected.branch.description}</p>
              <button
                type="button"
                className="decision-detail__choose"
                disabled={!selectedEligibility?.eligible}
                onClick={() => onChoose(selected.branch)}
              >
                Choose {selected.branch.label} <span>→</span>
              </button>
              {!selectedEligibility?.eligible && <small className="decision-detail__blocked">{selectedEligibility?.reasons.join(" ")}</small>}
            </> : <div className="decision-detail__empty">Select an option to see the full picture.</div>}
            {inactiveBranch && <button type="button" className="decision-detail__later" onClick={() => onChoose(inactiveBranch)}>{inactiveBranch.label}</button>}
          </aside>
        </div>
      </section>
    </div>
  );
}

export function DecisionExperience(props: DecisionExperienceProps) {
  return detailsForDecision(props.node.id)
    ? <DecisionExplorer {...props} />
    : <RoadDecisionSigns {...props} />;
}
