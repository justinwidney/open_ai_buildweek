import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRandomSource, type DecisionBranch, type DecisionNode, type LifeContext } from "@control-ai/engine";
import { PAYMENTS_PER_NORMAL_YEAR } from "@control-ai/shared/life-sim";
import { UiShell, type ShellTool } from "./components";
import {
  AccountsPanel,
  BudgetPanel,
  GoalsPanel,
  OverviewPanel,
  TaxPanel,
} from "./labs/decision-travel/panels";
import {
  DEFAULT_SETTINGS,
  STOP_MONTHS,
  STOPS,
  applyDecision,
  runBaseline,
  statementAt,
  type JourneyPath,
} from "./labs/decision-travel/pathModel";
import { DecisionExperience, JourneyCrossroads, JourneyPromptSign } from "./labs/decision-travel/DecisionExperience";
import { plannerStepsForAge } from "./labs/decision-travel/planner/LifestyleYearPlanner";
import { type PlannerStepId } from "./labs/decision-travel/planner/plannerModel";
import { detailsForDecision, isDecisionExplorerNode } from "./labs/decision-travel/decisionCatalog";
import { CardInventory, type InventoryCardItem } from "./labs/decision-travel/CardInventory";
import { createLifestyleDecision, isLifestyleDecisionNode } from "./labs/decision-travel/lifestyleDecisions";
import {
  DECISION_MAPS,
  PRE_JOURNEY_MAPS,
  directionsForOptions,
  ROUTE_DIRECTION_LABELS,
  selectDecisionMap,
  selectRouteMap,
  type DecisionMap,
} from "./labs/decision-travel/decisionMaps";
import { contextWithFinances, decisionsAt, evaluateYear, isInertBranch, nodeEmoji, routeKindForNode, stageMeta } from "./labs/decision-travel/journeyGraph";
import { fmtMoney } from "./labs/decision-travel/format";
import { type JourneyOnboardingProfile } from "./labs/onboarding/onboarding.types";
import "./labs/decision-travel/theme.css";
import "./labs/decision-travel/panels.css";
import "./DecisionJourney.css";

const JOURNEY_PAGES = [
  { id: "overview", label: "Overview", icon: "⌂", Panel: OverviewPanel },
  { id: "tax", label: "Taxes", icon: "%", Panel: TaxPanel },
  { id: "budget", label: "Budget", icon: "$", Panel: BudgetPanel },
  { id: "accounts", label: "Accounts", icon: "▤", Panel: AccountsPanel },
  { id: "goals", label: "Goals", icon: "★", Panel: GoalsPanel },
] as const;

type JourneyPageId = (typeof JOURNEY_PAGES)[number]["id"];

const PAGE_TOOLS: readonly ShellTool[] = JOURNEY_PAGES.map(({ id, label, icon }) => ({ id, label, icon }));
const INVENTORY_TOOL_ID = "inventory";
/** The map carries at most three roads, and one is always "travel on". */
const MAX_OPPORTUNITY_SIGNS = 2;

interface PendingDecision {
  node: DecisionNode;
  age: number;
  month: number;
}

interface DecisionLogEntry {
  age: number;
  event: string;
  choice: string;
  direction: string;
}

const decodedMapSources = new Set<string>();

/** Decode route art before it replaces the scene currently on screen. */
function preloadMap(src: string): Promise<void> {
  if (decodedMapSources.has(src)) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new Image();
    const finish = () => {
      decodedMapSources.add(src);
      resolve();
    };
    image.onload = () => {
      if (typeof image.decode === "function") void image.decode().then(finish, finish);
      else finish();
    };
    image.onerror = finish;
    image.src = src;
  });
}

function isJourneyPage(value: string): value is JourneyPageId {
  return JOURNEY_PAGES.some((page) => page.id === value);
}

export interface DecisionJourneyProps {
  onboardingProfile: JourneyOnboardingProfile | null;
}

function monthlyIncomeFromProfile(profile: JourneyOnboardingProfile): number {
  const work = profile.workExperience;
  if (!work.hasPriorExperience || work.occupationId === "student" || work.occupationId === "caregiver") return 0;

  if (work.compensationBasis === "hourly" && work.grossHourlyRateCents && work.averageHoursPerWeek) {
    return Math.round((work.grossHourlyRateCents / 100) * work.averageHoursPerWeek * 52 / 12);
  }

  if (work.grossPayPerPeriodCents && work.payCadence) {
    return Math.round((work.grossPayPerPeriodCents / 100) * PAYMENTS_PER_NORMAL_YEAR[work.payCadence] / 12);
  }

  return DEFAULT_SETTINGS.monthlyIncome;
}

export default function DecisionJourney({ onboardingProfile }: DecisionJourneyProps) {
  const settings = useMemo(
    () => onboardingProfile ? {
      ...DEFAULT_SETTINGS,
      age: onboardingProfile.demographics.age,
      monthlyIncome: onboardingProfile.startingNetWorth == null
        ? monthlyIncomeFromProfile(onboardingProfile)
        : DEFAULT_SETTINGS.monthlyIncome,
      startingCash: onboardingProfile.startingNetWorth ?? DEFAULT_SETTINGS.startingCash,
      startingInvestments: 0,
    } : DEFAULT_SETTINGS,
    [onboardingProfile],
  );
  const baseline = useMemo(() => runBaseline(settings), [settings]);
  const [journey, setJourney] = useState<JourneyPath>(baseline);
  const [markerMonth, setMarkerMonth] = useState(0);
  const [activePage, setActivePage] = useState<JourneyPageId>("overview");
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [worldMap, setWorldMap] = useState(() => selectRouteMap("straight", "opening-road"));
  const [isMapTransitioning, setMapTransitioning] = useState(false);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [lastDirection, setLastDirection] = useState("The road out of high school");
  const [status, setStatus] = useState("Your first crossroads is right in front of you.");
  const [decisionPage, setDecisionPage] = useState<"map" | "explorer">(
    window.location.hash.startsWith("#/explore/") ? "explorer" : "map",
  );
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [initialMilestonePresented, setInitialMilestonePresented] = useState(false);
  /** Which year instrument the player took off the map; null while the signs are up. */
  const [plannerStep, setPlannerStep] = useState<PlannerStepId | null>(null);
  const firedInitialRef = useRef<JourneyPath | null>(null);
  const worldMapRef = useRef(worldMap);
  const mapRequestRef = useRef(0);

  const stopIndex = Math.round(markerMonth / STOP_MONTHS);
  const ageNow = settings.age + stopIndex;
  const statement = useMemo(
    () => statementAt(journey, markerMonth, settings.age),
    [journey, markerMonth, settings.age],
  );
  const activePageConfig = JOURNEY_PAGES.find((page) => page.id === activePage)!;
  const ActivePanel = activePageConfig.Panel;
  const progress = Math.round((stopIndex / STOPS) * 100);
  const stage = stageMeta(journey.context.stage);
  const opportunities = useMemo(() => decisionsAt(journey.context).opportunities, [journey]);
  const inventoryCards = useMemo<InventoryCardItem[]>(() => {
    const collected = new Map<string, InventoryCardItem>();
    for (const step of journey.history) {
      const details = detailsForDecision(step.nodeId)?.find((choice) => choice.id === step.branchId.replace(/^switch-/, ""));
      if (!details?.artwork) continue;
      const title = step.label
        .replace(/^Declare /, "")
        .replace(/^Switch major to /, "")
        .replace(/^Adopted /, "")
        .replace(/ job$/, "");
      const id = `${details.kind}:${details.id}`;
      collected.set(id, {
        id,
        title,
        acquiredAge: settings.age + Math.round(step.month / STOP_MONTHS),
        details,
      });
    }
    return [...collected.values()];
  }, [journey.history, settings.age]);

  // The inventory rides in the header row with the pages, but opens its own
  // surface rather than the dashboard panel.
  const shellTools = useMemo<readonly ShellTool[]>(() => [
    ...PAGE_TOOLS,
    {
      id: INVENTORY_TOOL_ID,
      label: `Inventory (${inventoryCards.length} card${inventoryCards.length === 1 ? "" : "s"})`,
      opensPanel: false,
      icon: <>▣{inventoryCards.length > 0 && <b>{inventoryCards.length}</b>}</>,
    },
  ], [inventoryCards.length]);

  /**
   * Reveal a new scene. The picker is handed the outgoing map id so a click
   * never lands back on the art it just left.
   */
  const revealMap = useCallback((pick: (previousId: string) => DecisionMap) => {
    const nextMap = pick(worldMapRef.current.id);
    const request = ++mapRequestRef.current;

    if (decodedMapSources.has(nextMap.src)) {
      worldMapRef.current = nextMap;
      setWorldMap(nextMap);
      setMapTransitioning(false);
      return;
    }

    setMapTransitioning(true);

    // Keep the current scene painted while its replacement is fetched and
    // decoded. The latest requested scene wins if actions overlap.
    void preloadMap(nextMap.src).then(() => {
      if (request !== mapRequestRef.current) return;
      worldMapRef.current = nextMap;
      setWorldMap(nextMap);
      setMapTransitioning(false);
    });
  }, []);

  // The raster route library is now small enough to warm one age-appropriate
  // pool in the background. Respect data-saver and load sequentially so this
  // never competes with the scene the player is actively waiting for.
  useEffect(() => {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;

    let cancelled = false;
    const pool = ageNow <= 30 ? PRE_JOURNEY_MAPS : DECISION_MAPS;
    const timer = window.setTimeout(() => {
      void (async () => {
        for (const map of pool) {
          if (cancelled) return;
          await preloadMap(map.src);
        }
      })();
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [ageNow <= 30]);

  /**
   * Show the road between decisions, sized to the signs it will carry: the
   * chances open right now plus the one that travels on.
   */
  const revealCrossroads = (ctx: LifeContext, seedKey: string, age: number) => {
    const openNow = Math.min(decisionsAt(ctx).opportunities.length, MAX_OPPORTUNITY_SIGNS);
    const signCount = Math.min(3, openNow + 1);
    const kind = signCount >= 3 ? "network" : signCount === 2 ? "fork-both" : "straight";
    revealMap((previousId) => selectDecisionMap(kind, seedKey, {
      preJourney: age <= 30,
      branchCount: signCount,
      exclude: previousId,
    }));
  };

  const navigateToMap = () => {
    setDecisionPage("map");
    window.history.pushState({ journeyPage: "map" }, "", "#/journey");
  };

  const navigateToExplorer = (node: DecisionNode) => {
    setDecisionPage("explorer");
    window.history.pushState({ journeyPage: node.id }, "", `#/explore/${node.id}`);
  };

  const presentMilestone = (node: DecisionNode, age: number, month: number, lead: string) => {
    setPending({ node, age, month });
    setPlannerStep(null);
    // A life-design year puts one sign per instrument on the road, so the map
    // needs exactly that many paths — not one per branch.
    const pathCount = isLifestyleDecisionNode(node.id) ? plannerStepsForAge(age).length : node.branches.length;
    revealMap((previousId) => selectDecisionMap(routeKindForNode(node), `${node.id}:${age}`, {
      preJourney: age <= 30,
      branchCount: pathCount,
      exclude: previousId,
    }));
    setStatus(`${lead} — choose the route forward.`);
    if (isDecisionExplorerNode(node.id)) navigateToExplorer(node);
    else setDecisionPage("map");
  };

  useEffect(() => {
    const syncPageFromHistory = () => setDecisionPage(window.location.hash.startsWith("#/explore/") ? "explorer" : "map");
    window.addEventListener("popstate", syncPageFromHistory);
    return () => window.removeEventListener("popstate", syncPageFromHistory);
  }, []);

  // The very first crossroads (life after high school) is waiting at month 0, so
  // present it as soon as a fresh baseline mounts or a restart resets the run.
  useEffect(() => {
    if (firedInitialRef.current === baseline) return;
    firedInitialRef.current = baseline;
    const { milestone } = decisionsAt(baseline.context);
    if (milestone) presentMilestone(milestone, settings.age, 0, `${milestone.title} at age ${settings.age}`);
    setInitialMilestonePresented(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, settings.age]);

  /** Advance a single year: refresh finances, roll the year, and stop on a milestone or a chance event. */
  const advanceYear = () => {
    if (pending || stopIndex >= STOPS) return;
    const nextStop = stopIndex + 1;
    const age = settings.age + nextStop;
    const month = nextStop * STOP_MONTHS;

    const ctx = contextWithFinances({ ...journey.context, month, ageYears: age }, statementAt(journey, month, settings.age));
    setJourney((current) => ({ ...current, context: ctx }));
    setMarkerMonth(month);

    const src = createRandomSource(`${settings.age}-evt-${age}`);
    const { forced } = evaluateYear(ctx, () => src.next());
    if (forced) {
      presentMilestone(forced, age, month, `${forced.title} at age ${age}`);
    } else if (nextStop >= STOPS) {
      revealMap(() => selectRouteMap("straight", "journey-complete"));
      setStatus("You reached the end of this route. Your life is settled.");
    } else {
      const lifestyleDecision = createLifestyleDecision(age, ctx.stage);
      presentMilestone(lifestyleDecision, age, month, `Age ${age} life-design review`);
    }
  };

  const nextYearIsFamilyPlanning = ageNow + 1 === 29;
  const shouldAutoAdvance = initialMilestonePresented
    && !pending
    && opportunities.length === 0
    && stopIndex < STOPS
    && !nextYearIsFamilyPlanning;

  // A crossroads containing only the generic travel sign is not a meaningful
  // choice. Move through it automatically, except when the next stop is the
  // explicit family-planning moment the player should choose to enter.
  useEffect(() => {
    if (!shouldAutoAdvance) return;
    const frame = window.requestAnimationFrame(advanceYear);
    return () => window.cancelAnimationFrame(frame);
    // advanceYear intentionally uses the state from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoAdvance]);

  const openOpportunity = (node: DecisionNode) => {
    presentMilestone(node, ageNow, markerMonth, node.title);
  };

  /** Backing out of an optional chance returns to a fresh road, not the scene it was offered on. */
  const dismissOpportunity = (node: DecisionNode) => {
    setPending(null);
    setPlannerStep(null);
    revealCrossroads(journey.context, `${node.id}:dismissed:${markerMonth}`, ageNow);
    navigateToMap();
  };

  const chooseRoute = (branch: DecisionBranch) => {
    if (!pending) return;
    const { node, month, age } = pending;

    // "Maybe later" on an optional opportunity leaves it open for a future year.
    if (isInertBranch(branch)) {
      setPending(null);
      setPlannerStep(null);
      revealCrossroads(journey.context, `${node.id}:declined:${month}`, age);
      navigateToMap();
      setStatus("You let the moment pass — you can revisit it later.");
      return;
    }

    const optionIndex = node.branches.findIndex((candidate) => candidate.id === branch.id);
    const direction = directionsForOptions(node.branches.length, routeKindForNode(node))[optionIndex] ?? "winding";
    const directionLabel = isLifestyleDecisionNode(node.id) ? "Life design" : ROUTE_DIRECTION_LABELS[direction];

    const next = applyDecision(journey, month, node, branch);
    // Refresh finances against the changed path so chained checks and the opportunity list are current.
    const withFin = { ...next, context: contextWithFinances(next.context, statementAt(next, month, settings.age)) };
    setJourney(withFin);
    setDecisionLog((current) => [
      ...current,
      { age, event: node.title, choice: branch.label, direction: directionLabel },
    ]);
    setLastDirection(directionLabel);
    setStatus(`You chose "${branch.label}" and continued along the ${directionLabel.toLowerCase()}.`);

    // Choosing a path (go to college) immediately surfaces its first milestone (declare a major).
    const { milestone } = decisionsAt(withFin.context);
    if (milestone) presentMilestone(milestone, age, month, milestone.title);
    else {
      // Nothing is forced, so the road itself becomes the next screen rather
      // than leaving the scene the decision was made on.
      setPending(null);
      setPlannerStep(null);
      revealCrossroads(withFin.context, `${node.id}:${branch.id}:${month}`, age);
      navigateToMap();
    }
  };

  const restartJourney = () => {
    firedInitialRef.current = null; // let the initial-crossroads effect fire again
    setJourney(baseline);
    setMarkerMonth(0);
    setPending(null);
    setPlannerStep(null);
    setDecisionLog([]);
    setInventoryOpen(false);
    setLastDirection("The road out of high school");
    setStatus("Your first crossroads is right in front of you.");
    setDecisionPage("map");
    window.history.replaceState({ journeyPage: "map" }, "", "#/journey");
    revealMap(() => selectRouteMap("straight", "opening-road"));
  };

  const worldHud = (
    <section className="journey-hud scroll" aria-label="Journey status">
      <div className="journey-hud__heading">
        <div>
          <span className="eyebrow">Age {ageNow} · {stage.emoji} {stage.label}</span>
          <h1>{lastDirection}</h1>
        </div>
        <div className="journey-hud__utility">
          <button type="button" className="journey-hud__reset" onClick={restartJourney}>Restart</button>
        </div>
      </div>
      <p aria-live="polite">{status}</p>
      <div className="journey-hud__progress" aria-label={`${progress}% of journey complete`}>
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="journey-hud__actions">
        <div><span>Net worth</span><b>{fmtMoney(statement?.balanceSheet.netWorthCents ?? 0)}</b></div>
        <button
          type="button"
          className="ornate-btn is-primary"
          disabled={Boolean(pending) || stopIndex >= STOPS}
          onClick={advanceYear}
        >
          {stopIndex >= STOPS ? "Journey complete" : "Travel a year ▶"}
        </button>
      </div>
    </section>
  );

  const sidebarPage = statement ? (
    <div className="journey-sidebar-page">
      <header className="journey-sidebar-page__head">
        <span className="eyebrow">Age {ageNow} financial view</span>
        <h2>{activePageConfig.label}</h2>
      </header>
      <ActivePanel
        statement={statement}
        journey={journey}
        baseline={baseline}
        month={markerMonth}
        startAge={settings.age}
      />
      <section className="journey-decision-log">
        <span className="eyebrow">Decisions taken</span>
        {decisionLog.length === 0 ? (
          <p>No forks yet. The first crossroads is waiting ahead.</p>
        ) : (
          <ol>
            {decisionLog.slice().reverse().map((entry) => (
              <li key={`${entry.age}-${entry.event}`}>
                <b>Age {entry.age}: {entry.choice}</b>
                <span>{entry.event} / {entry.direction}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  ) : null;

  return (
    <div className="journey-app">
      <UiShell
        activeTool={activePage}
        onToolClick={(tool) => {
          if (tool === INVENTORY_TOOL_ID) setInventoryOpen(true);
          else if (isJourneyPage(tool)) setActivePage(tool);
        }}
        panel={sidebarPage}
        panelTitle="Life dashboard"
        tools={shellTools}
        worldHud={worldHud}
      >
        <div className="journey-world">
          <img
            key={worldMap.id}
            className="journey-world__map"
            src={worldMap.src}
            alt={`${worldMap.label} watercolor route world`}
            decoding="async"
          />
          <div className="journey-world__atmosphere" aria-hidden="true" />
          {!isMapTransitioning && pending && !isDecisionExplorerNode(pending.node.id) && decisionPage === "map" && (
            <DecisionExperience
              age={pending.age}
              node={pending.node}
              ctx={{ ...journey.context, month: pending.month }}
              map={worldMap}
              onChoose={chooseRoute}
              onDismiss={pending.node.trigger === "opportunity" ? () => dismissOpportunity(pending.node) : undefined}
              plannerStep={plannerStep}
              onPickStep={setPlannerStep}
              onBackToMap={() => setPlannerStep(null)}
            />
          )}
          {!isMapTransitioning && !pending && !shouldAutoAdvance && (stopIndex < STOPS || opportunities.length > 0) && (
            <JourneyCrossroads
              age={ageNow}
              map={worldMap}
              opportunities={opportunities.slice(0, MAX_OPPORTUNITY_SIGNS)}
              onOpen={openOpportunity}
              onTravel={stopIndex < STOPS ? advanceYear : undefined}
              travelLabel={nextYearIsFamilyPlanning ? "Plan for family" : `Travel & plan age ${ageNow + 1}`}
            />
          )}
          {!isMapTransitioning && pending && isDecisionExplorerNode(pending.node.id) && decisionPage === "map" && (
            <JourneyPromptSign placement="left" label={pending.node.title} detail="Your choice is waiting" onClick={() => navigateToExplorer(pending.node)} />
          )}
        </div>
      </UiShell>

      {inventoryOpen && <CardInventory cards={inventoryCards} onClose={() => setInventoryOpen(false)} />}

      {pending && isDecisionExplorerNode(pending.node.id) && decisionPage === "explorer" && (
        <DecisionExperience
          age={pending.age}
          node={pending.node}
          ctx={{ ...journey.context, month: pending.month }}
          map={worldMap}
          onChoose={chooseRoute}
          onDismiss={pending.node.trigger === "opportunity" ? () => dismissOpportunity(pending.node) : undefined}
          onBackToMap={isDecisionExplorerNode(pending.node.id) ? navigateToMap : undefined}
        />
      )}
    </div>
  );
}
