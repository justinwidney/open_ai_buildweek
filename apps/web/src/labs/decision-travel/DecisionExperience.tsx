import { lazy, Suspense, useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  branchEligibility,
  type DecisionBranch,
  type DecisionNode,
  type LifeContext,
} from "@control-ai/engine";
import { detailsForDecision, type DecisionChoiceDetails } from "./decisionCatalog";
import {
  filterAndSortDecisionDeck,
  getDecisionDeckPage,
  mapDecisionBranchesToDeck,
  shuffleDecisionDeck,
  type DecisionDeckItem,
} from "./decisionDeckModel";
import { ROUTE_DIRECTION_LABELS, type DecisionMap, type DecisionPathAnchor } from "./decisionMaps";
import { isInertBranch, nodeEmoji } from "./journeyGraph";
import { isLifestyleDecisionNode } from "./lifestyleDecisions";
import { LifestyleYearPlanner, plannerStepsForAge } from "./planner/LifestyleYearPlanner";
import { PLANNER_STEP_BLURBS, PLANNER_STEP_TITLES, type PlannerStepId } from "./planner/plannerModel";
import "./DecisionExperience.css";

// Three.js, React Three Fiber, and Drei are only needed after a player opens
// an interactive commitment card. Keep them out of the SVG journey path.
const RoleThreeCard = lazy(() =>
  import("./RoleThreeCard").then((module) => ({ default: module.RoleThreeCard })),
);

interface DecisionExperienceProps {
  node: DecisionNode;
  ctx: LifeContext;
  age: number;
  map: DecisionMap;
  onChoose: (branch: DecisionBranch) => void;
  onDismiss?: () => void;
  onBackToMap?: () => void;
  /** Which year instrument is open. Null means the map is offering them all. */
  plannerStep?: PlannerStepId | null;
  /** Supplying this switches a life-design year to the pick-one-from-the-map flow. */
  onPickStep?: (step: PlannerStepId) => void;
}

function SignArtwork() {
  return (
    <svg className="road-sign__art" viewBox="0 0 522 414" aria-hidden="true" focusable="false">
      <image href="/decision-signs/ornate-plaque-glow.png" width="522" height="414" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}

function RoadDecisionSigns({ node, ctx, age, map, onChoose, onDismiss }: DecisionExperienceProps) {
  const pathChoices = useMemo(() => {
    const used = new Set<string>();
    return (map.paths ?? []).flatMap((path) => {
      const bound = path.branchId ? node.branches.find((branch) => branch.id === path.branchId) : undefined;
      const branch = bound ?? node.branches.find((candidate) => !used.has(candidate.id));
      if (!branch) return [];
      used.add(branch.id);
      return [{ branch, path }];
    });
  }, [map.paths, node.branches]);

  return (
    <section className="road-decision" aria-labelledby="road-decision-title">
      <header className="road-decision__prompt">
        <h2 id="road-decision-title">{nodeEmoji(node)} {node.title}</h2>
        {onDismiss && <button type="button" onClick={onDismiss}>Maybe later</button>}
      </header>
      <div className="road-decision__sign-field">
        {pathChoices.map(({ branch, path }, index) => {
          const direction = path.direction;
          const eligibility = branchEligibility(branch, ctx);
          const style = {
            "--sign-x": `${path.x}%`,
            "--sign-y": `${Math.max(20, path.y - 7)}%`,
            "--sign-rotate": `${direction === "left" ? -3 : direction === "right" ? 3 : 0}deg`,
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
              <SignArtwork />
              <span className="road-sign__copy">
                <small>{ROUTE_DIRECTION_LABELS[direction]}</small>
                <strong>{branch.label}</strong>
              </span>
            </button>
          );
        })}
      </div>
      <p className="road-decision__hint">{pathChoices.length} path{pathChoices.length === 1 ? "" : "s"} ahead · choose a floating sign</p>
    </section>
  );
}

/** Even fallback anchors, for the case a map carries fewer paths than there are signs. */
function anchorAt(anchors: readonly DecisionPathAnchor[], index: number, count: number, id: string): DecisionPathAnchor {
  return anchors[index] ?? { id, x: 50 + (index - (count - 1) / 2) * 24, y: 51, direction: "straight" };
}

interface SignFieldItem {
  id: string;
  eyebrow: string;
  icon?: string;
  label: string;
  detail?: string;
  onSelect: () => void;
}

/**
 * A screen of choices standing on the map's own roads. Every non-branch screen
 * in the journey is one of these, so travelling on always means taking a sign.
 */
function SignField({ title, items, map, hint }: {
  title: string;
  items: readonly SignFieldItem[];
  map: DecisionMap;
  hint: string;
}) {
  const anchors = map.paths ?? [];

  return (
    <section className="road-decision" aria-labelledby="road-decision-title">
      <header className="road-decision__prompt">
        <h2 id="road-decision-title">{title}</h2>
      </header>
      <div className="road-decision__sign-field">
        {items.map((item, index) => {
          const anchor = anchorAt(anchors, index, items.length, item.id);
          const direction = anchor.direction;
          const style = {
            "--sign-x": `${anchor.x}%`,
            "--sign-y": `${Math.max(20, anchor.y - 7)}%`,
            "--sign-rotate": `${direction === "left" ? -3 : direction === "right" ? 3 : 0}deg`,
            "--sign-delay": `${index * 70}ms`,
          } as CSSProperties;

          return (
            <button
              type="button"
              className={`road-decision__sign is-${direction}`}
              key={item.id}
              onClick={item.onSelect}
              style={style}
              title={item.detail ?? item.label}
            >
              <SignArtwork />
              <span className="road-sign__copy">
                <small>{item.eyebrow}</small>
                <strong>{item.icon && <span className="road-sign__icon" aria-hidden="true">{item.icon}</span>}{item.label}</strong>
              </span>
            </button>
          );
        })}
      </div>
      <p className="road-decision__hint">{hint}</p>
    </section>
  );
}

/**
 * A life-design year as signs on the road: one per instrument the year asks
 * for. Opening one runs it alone and settles the year, so the sign you take is
 * the choice.
 */
function YearInstrumentSigns({ node, age, map, steps, onPick }: {
  node: DecisionNode;
  age: number;
  map: DecisionMap;
  steps: readonly PlannerStepId[];
  onPick: (step: PlannerStepId) => void;
}) {
  return (
    <SignField
      title={`${nodeEmoji(node)} ${node.title}`}
      map={map}
      hint={`${steps.length} way${steps.length === 1 ? "" : "s"} to plan age ${age} · the sign you take settles the year`}
      items={steps.map((step) => ({
        id: step,
        eyebrow: PLANNER_STEP_BLURBS[step],
        label: PLANNER_STEP_TITLES[step],
        detail: `${PLANNER_STEP_TITLES[step]} — ${PLANNER_STEP_BLURBS[step]}`,
        onSelect: () => onPick(step),
      }))}
    />
  );
}

/**
 * The road between decisions. What used to be a "open to you now" list in the
 * HUD stands here as signs, alongside the sign that travels on, so every screen
 * is reached by taking a road rather than by reading a panel.
 */
export function JourneyCrossroads({ age, map, opportunities, onOpen, onTravel, travelLabel }: {
  age: number;
  map: DecisionMap;
  opportunities: readonly DecisionNode[];
  onOpen: (node: DecisionNode) => void;
  onTravel?: () => void;
  travelLabel: string;
}) {
  const items: SignFieldItem[] = opportunities.map((node) => ({
    id: node.id,
    eyebrow: "Open to you now",
    icon: nodeEmoji(node),
    label: node.title,
    detail: node.prompt,
    onSelect: () => onOpen(node),
  }));

  if (onTravel) {
    items.push({ id: "travel-on", eyebrow: "The year ahead", label: travelLabel, detail: "Leave these and travel on", onSelect: onTravel });
  }

  return (
    <SignField
      title={`The road at age ${age}`}
      map={map}
      items={items}
      hint={opportunities.length > 0 ? "Take a chance that is open, or travel on" : "Choose a floating sign"}
    />
  );
}

type ExplorerItem = DecisionDeckItem<DecisionBranch, DecisionChoiceDetails>;

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function difficultyDots(level: number) {
  return Array.from({ length: 5 }, (_, index) => <i className={index < level ? "is-filled" : ""} key={index} />);
}

function useDeckPageSize() {
  const [isWide, setIsWide] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 1000px)").matches);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1000px)");
    const update = () => setIsWide(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isWide ? 5 : 3;
}

function PathCommitmentCard({ item, age, onBack, onConfirm }: { item: ExplorerItem; age: number; onBack: () => void; onConfirm: () => void }) {
  const { details, branch } = item;
  const isMajor = details.kind === "major";
  const isPet = details.kind === "pet";

  return (
    <main className="decision-window-layer decision-window-layer--page role-startup-layer">
      <section className="role-startup" aria-label={`${branch.label} ${isMajor ? "college plan" : isPet ? "adoption plan" : "startup charter"} at age ${age}`}>
        <button className="role-startup__back" type="button" onClick={onBack}><span>←</span> Back to {isMajor ? "programs" : isPet ? "pets" : "roles"}</button>

        <div className="role-startup__stage">
          <Suspense fallback={<div className="role-three-card role-three-card--loading" role="status"><span>Preparing interactive card…</span></div>}>
            <RoleThreeCard
              artworkSrc={details.artwork?.src ?? (isMajor ? "/role-cards/majors/liberal-arts.svg" : isPet ? "/role-cards/pets/adult-dog.svg" : "/role-cards/roles/retail.svg")}
              title={branch.label}
              category={details.category}
              outlook={details.outlook}
              note={details.note}
              startupSummary={details.startupSummary ?? (isMajor
                ? "Plan for the tuition, materials, and practical requirements across this degree."
                : "Prepare the equipment and credentials needed to begin this role.")}
              startupItems={details.startupItems ?? []}
              cost={details.cost}
              timeLabel={details.timeLabel}
              startingSalary={details.startingSalary}
              provisionsLabel={isPet ? "ADOPTION PROVISIONS" : undefined}
              costQuestion={isPet ? `Why this homecoming starts at ${money(details.cost)}` : undefined}
              leftFooterLabel={isPet ? "WEEKLY CARE" : undefined}
              leftFooterValue={isPet ? `${details.weeklyHours ?? 0} hours` : undefined}
              rightFooterLabel={isPet ? "ONGOING COST" : undefined}
              rightFooterValue={isPet ? `${money(details.monthlyCost ?? 0)}/mo` : undefined}
            />
          </Suspense>

          <div className="role-startup__actions">
            <button type="button" className="role-startup__confirm" onClick={onConfirm}>
              {isMajor ? `Choose ${branch.label} · plan for ${money(details.cost)}` : isPet ? `Welcome ${branch.label} · ${money(details.cost)} setup` : `Accept ${money(details.cost)} setup & start`} <span>→</span>
            </button>
            <small>{isMajor
              ? "The estimate is spread across the program; costs not covered by cash may become student debt."
              : isPet
                ? `${money(details.monthlyCost ?? 0)}/month and about ${details.weeklyHours ?? 0} hours/week continue after adoption. ${details.housingLabel}.`
              : "The setup cost is deducted from cash when this path begins."}</small>
          </div>
        </div>
      </section>
    </main>
  );
}

function DecisionExplorer({ node, ctx, age, onChoose, onDismiss, onBackToMap }: DecisionExperienceProps) {
  const catalog = detailsForDecision(node.id) ?? [];
  const isMajor = catalog[0]?.kind === "major";
  const isPet = catalog[0]?.kind === "pet";
  const [query, setQuery] = useState("");
  const [preparing, setPreparing] = useState<ExplorerItem | null>(null);
  const [page, setPage] = useState(0);
  const [shuffleOrder, setShuffleOrder] = useState<readonly string[]>([]);
  const [deckMotion, setDeckMotion] = useState({ key: 0, direction: "forward" as "forward" | "back" | "shuffle" });
  const pageSize = useDeckPageSize();

  const items = useMemo<readonly ExplorerItem[]>(() => mapDecisionBranchesToDeck(node.branches, catalog), [catalog, node.branches]);
  const orderedItems = useMemo(() => {
    if (!shuffleOrder.length) return items;
    const rank = new Map(shuffleOrder.map((id, index) => [id, index] as const));
    return [...items].sort((a, b) => (rank.get(a.branch.id) ?? items.length) - (rank.get(b.branch.id) ?? items.length));
  }, [items, shuffleOrder]);

  const filtered = useMemo(
    () => filterAndSortDecisionDeck(orderedItems, { query, category: "All", sort: "featured" }),
    [orderedItems, query],
  );

  const inactiveBranch = node.branches.find((branch) => isInertBranch(branch));
  const deckPage = getDecisionDeckPage(filtered, page, pageSize);
  const pageCount = deckPage.pageCount;
  const effectivePage = deckPage.pageIndex;
  const visibleItems = deckPage.items;
  const routeName = isMajor ? "College route" : isPet ? "Companion route" : "Work route";
  const returnToMap = onBackToMap ?? onDismiss;

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount - 1));
  }, [pageCount, pageSize]);

  function resetToFirstSet(direction: "forward" | "shuffle" = "forward") {
    setPage(0);
    setDeckMotion((current) => ({ key: current.key + 1, direction }));
  }

  function changePage(nextPage: number) {
    setDeckMotion((current) => ({ key: current.key + 1, direction: nextPage > effectivePage ? "forward" : "back" }));
    setPage(nextPage);
  }

  function shuffleDeck() {
    let nextOrder = shuffleDecisionDeck(items).map(({ branch }) => branch.id);
    if (nextOrder.length > 1 && nextOrder.every((id, index) => id === (shuffleOrder[index] ?? items[index]?.branch.id))) {
      const first = nextOrder[0];
      nextOrder = first ? [...nextOrder.slice(1), first] : nextOrder;
    }
    setShuffleOrder(nextOrder);
    resetToFirstSet("shuffle");
  }

  if (preparing) {
    return <PathCommitmentCard item={preparing} age={age} onBack={() => setPreparing(null)} onConfirm={() => onChoose(preparing.branch)} />;
  }

  return (
    <main className="decision-window-layer decision-window-layer--page decision-window-layer--deck">
      <section className="decision-window decision-window--deck" aria-labelledby="decision-window-title">
        <div className="decision-deck-page__topbar">
          {returnToMap && <button className="decision-deck-page__back" type="button" onClick={returnToMap}><span>←</span> Return to journey map</button>}
          <header className="decision-deck-page__heading">
            <span>{routeName} · age {age}</span>
            <h2 id="decision-window-title">{node.title}</h2>
          </header>
          {returnToMap && <span className="decision-deck-page__balance" aria-hidden="true" />}
        </div>

        <label className="decision-search decision-search--deck">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search {isMajor ? "majors" : isPet ? "pets" : "jobs"}</span>
          <input value={query} onChange={(event) => { setQuery(event.target.value); resetToFirstSet(); }} placeholder={`Search ${isMajor ? "majors, skills, or fields" : isPet ? "pets, care level, or housing needs" : "jobs, skills, or industries"}…`} autoFocus />
        </label>

        <div className="sr-only" aria-live="polite">Set {filtered.length ? effectivePage + 1 : 0} of {filtered.length ? pageCount : 0} · showing {visibleItems.length} cards</div>

        <div className="decision-deck">
          <div className="decision-deck__viewport">
            <button className="decision-deck__arrow is-left" type="button" onClick={() => changePage(effectivePage - 1)} disabled={effectivePage === 0 || !filtered.length} aria-label="Show previous set of cards">←</button>
            <div className={`decision-deck__cards is-${deckMotion.direction}`} key={`${deckMotion.key}-${effectivePage}-${pageSize}`}>
              {visibleItems.map(({ branch, details }) => {
                const eligibility = branchEligibility(branch, ctx);
                const artwork = details.artwork?.src ?? (isMajor ? "/role-cards/majors/liberal-arts.svg" : isPet ? "/role-cards/pets/adult-dog.svg" : "/role-cards/roles/retail.svg");
                return (
                  <button
                    type="button"
                    className="decision-deck-card"
                    disabled={!eligibility.eligible}
                    key={branch.id}
                    onClick={() => setPreparing({ branch, details })}
                    title={eligibility.eligible ? `Open ${branch.label}` : eligibility.reasons.join(" ")}
                    aria-label={`${branch.label}. ${details.category}. ${isPet ? `${money(details.monthlyCost ?? 0)} monthly care` : `${money(details.startingSalary)} expected starting pay`}. Open interactive card.`}
                  >
                    <span className="decision-deck-card__art"><img src={artwork} alt="" draggable={false} /></span>
                    <span className="decision-deck-card__copy">
                      <span className="decision-deck-card__top"><em>{details.category}</em><b>{details.outlook}</b></span>
                      <strong>{branch.label}</strong>
                      <span className="decision-deck-card__metrics">
                        <span><small>{isPet ? "Monthly" : "Starting pay"}</small>{isPet ? `${money(details.monthlyCost ?? 0)}/mo` : `${money(details.startingSalary)}/yr`}</span>
                        <span><small>{isMajor ? "Est. total" : isPet ? "Setup" : "Start-up"}</small>{money(details.cost)}</span>
                      </span>
                      <span className="decision-deck-card__difficulty"><small>{isPet ? "Care" : "Challenge"}</small>{difficultyDots(details.difficulty)}</span>
                      <span className="decision-deck-card__open">Open card <span>↗</span></span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && <div className="decision-deck__empty"><b>No matching cards</b><span>Try another phrase or choose “All.”</span></div>}
            </div>
            <button className="decision-deck__arrow is-right" type="button" onClick={() => changePage(effectivePage + 1)} disabled={effectivePage >= pageCount - 1 || !filtered.length} aria-label="Show next set of cards">→</button>
          </div>

          <div className="decision-deck__controls">
            <button type="button" className="decision-deck__shuffle" onClick={shuffleDeck}><span aria-hidden="true">⤨</span> Shuffle cards</button>
            {inactiveBranch && <button type="button" className="decision-deck__later" onClick={() => onChoose(inactiveBranch)}>{inactiveBranch.label}</button>}
          </div>

        </div>
      </section>
    </main>
  );
}

export function JourneyPromptSign({ label, detail, onClick, placement = "center" }: { label: string; detail: string; onClick: () => void; placement?: "center" | "left" }) {
  return (
    <button type="button" className={`journey-prompt-sign journey-prompt-sign--${placement}`} onClick={onClick}>
      <SignArtwork />
      <span><small>{detail}</small><strong>{label}</strong><em>Open →</em></span>
    </button>
  );
}

export function DecisionExperience(props: DecisionExperienceProps) {
  if (isLifestyleDecisionNode(props.node.id)) {
    // Without onPickStep the year still runs as one guided walk through every
    // instrument (the Storybook + lab path).
    if (!props.onPickStep) {
      return <LifestyleYearPlanner node={props.node} ctx={props.ctx} age={props.age} onChoose={props.onChoose} onBackToMap={props.onBackToMap} />;
    }
    if (!props.plannerStep) {
      return <YearInstrumentSigns node={props.node} age={props.age} map={props.map} steps={plannerStepsForAge(props.age)} onPick={props.onPickStep} />;
    }
    return (
      <LifestyleYearPlanner
        node={props.node}
        ctx={props.ctx}
        age={props.age}
        onChoose={props.onChoose}
        onBackToMap={props.onBackToMap}
        soloStep={props.plannerStep}
      />
    );
  }
  return detailsForDecision(props.node.id) ? <DecisionExplorer {...props} /> : <RoadDecisionSigns {...props} />;
}
