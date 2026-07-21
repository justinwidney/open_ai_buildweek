import { useEffect, useMemo, useRef, useState } from "react";
import { createRandomSource, type DecisionBranch, type DecisionNode } from "@control-ai/engine";
import { PAYMENTS_PER_NORMAL_YEAR } from "@control-ai/shared/life-sim";
import { UiShell, type ShellTool } from "./components";
import {
  AccountsPanel,
  BudgetPanel,
  ForecastPanel,
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
import { DecisionExperience } from "./labs/decision-travel/DecisionExperience";
import {
  directionsForOptions,
  ROUTE_DIRECTION_LABELS,
  selectDecisionMap,
  selectRouteMap,
  type DecisionMap,
} from "./labs/decision-travel/decisionMaps";
import { contextWithFinances, decisionsAt, evaluateYear, isInertBranch, nodeEmoji, routeKindForNode, stageMeta } from "./labs/decision-travel/journeyGraph";
import { fmtMoney } from "./labs/decision-travel/format";
import { OnboardingExperience } from "./labs/onboarding/OnboardingLab";
import {
  ONBOARDING_PROFILE_STORAGE_KEY,
  type JourneyOnboardingProfile,
} from "./labs/onboarding/onboarding.types";
import "./labs/decision-travel/theme.css";
import "./labs/decision-travel/panels.css";
import "./DecisionJourney.css";

const JOURNEY_PAGES = [
  { id: "overview", label: "Overview", icon: "⌂", Panel: OverviewPanel },
  { id: "tax", label: "Taxes", icon: "%", Panel: TaxPanel },
  { id: "budget", label: "Budget", icon: "$", Panel: BudgetPanel },
  { id: "accounts", label: "Accounts", icon: "▤", Panel: AccountsPanel },
  { id: "goals", label: "Goals", icon: "★", Panel: GoalsPanel },
  { id: "forecast", label: "Forecast", icon: "↗", Panel: ForecastPanel },
] as const;

type JourneyPageId = (typeof JOURNEY_PAGES)[number]["id"];

const PAGE_TOOLS: readonly ShellTool[] = JOURNEY_PAGES.map(({ id, label, icon }) => ({ id, label, icon }));

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

function isJourneyPage(value: string): value is JourneyPageId {
  return JOURNEY_PAGES.some((page) => page.id === value);
}

function routeKindLabel(map: DecisionMap) {
  return map.kind.replaceAll("-", " ");
}

interface DecisionJourneyProps {
  onboardingProfile: JourneyOnboardingProfile | null;
  onEditStart: () => void;
}

function readStoredOnboardingProfile(): JourneyOnboardingProfile | null {
  try {
    const serialized = sessionStorage.getItem(ONBOARDING_PROFILE_STORAGE_KEY);
    if (!serialized) return null;
    const candidate = JSON.parse(serialized) as Partial<JourneyOnboardingProfile>;
    return candidate.schemaVersion === 1 && candidate.demographics?.age ? candidate as JourneyOnboardingProfile : null;
  } catch {
    return null;
  }
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

export function App() {
  const [onboardingProfile, setOnboardingProfile] = useState(readStoredOnboardingProfile);
  const skipOnboarding = import.meta.env.DEV && new URLSearchParams(window.location.search).get("skipOnboarding") === "1";

  if (!onboardingProfile && !skipOnboarding) {
    return <OnboardingExperience onComplete={setOnboardingProfile} showLabBack={false} />;
  }

  const editStart = () => {
    sessionStorage.removeItem(ONBOARDING_PROFILE_STORAGE_KEY);
    setOnboardingProfile(null);
  };

  return <DecisionJourney onboardingProfile={onboardingProfile} onEditStart={editStart} />;
}

function DecisionJourney({ onboardingProfile, onEditStart }: DecisionJourneyProps) {
  const settings = useMemo(
    () => onboardingProfile ? {
      ...DEFAULT_SETTINGS,
      age: onboardingProfile.demographics.age,
      monthlyIncome: monthlyIncomeFromProfile(onboardingProfile),
    } : DEFAULT_SETTINGS,
    [onboardingProfile],
  );
  const baseline = useMemo(() => runBaseline(settings), [settings]);
  const [journey, setJourney] = useState<JourneyPath>(baseline);
  const [markerMonth, setMarkerMonth] = useState(0);
  const [activePage, setActivePage] = useState<JourneyPageId>("overview");
  const [pending, setPending] = useState<PendingDecision | null>(null);
  const [worldMap, setWorldMap] = useState(() => selectRouteMap("straight", "opening-road"));
  const [mapRevision, setMapRevision] = useState(0);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [lastDirection, setLastDirection] = useState("The road out of high school");
  const [status, setStatus] = useState("Your first crossroads is right in front of you.");
  const firedInitialRef = useRef<JourneyPath | null>(null);

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

  const revealMap = (map: DecisionMap) => {
    setWorldMap(map);
    setMapRevision((revision) => revision + 1);
  };

  const presentMilestone = (node: DecisionNode, age: number, month: number, lead: string) => {
    setPending({ node, age, month });
    revealMap(selectDecisionMap(routeKindForNode(node), `${node.id}:${age}`, {
      preJourney: node.id === "hs-launch",
      branchCount: node.branches.length,
    }));
    setStatus(`${lead} — choose the route forward.`);
  };

  // The very first crossroads (life after high school) is waiting at month 0, so
  // present it as soon as a fresh baseline mounts or a restart resets the run.
  useEffect(() => {
    if (firedInitialRef.current === baseline) return;
    firedInitialRef.current = baseline;
    const { milestone } = decisionsAt(baseline.context);
    if (milestone) presentMilestone(milestone, settings.age, 0, `${milestone.title} at age ${settings.age}`);
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
      revealMap(selectRouteMap("straight", "journey-complete"));
      setStatus("You reached the end of this route. Your life is settled.");
    } else {
      setStatus(`Age ${age}: a quiet year. Travel on when you're ready.`);
    }
  };

  const openOpportunity = (node: DecisionNode) => {
    presentMilestone(node, ageNow, markerMonth, node.title);
  };

  const chooseRoute = (branch: DecisionBranch) => {
    if (!pending) return;
    const { node, month, age } = pending;

    // "Maybe later" on an optional opportunity leaves it open for a future year.
    if (isInertBranch(branch)) {
      setPending(null);
      setStatus("You let the moment pass — you can revisit it later.");
      return;
    }

    const optionIndex = node.branches.findIndex((candidate) => candidate.id === branch.id);
    const direction = directionsForOptions(node.branches.length, routeKindForNode(node))[optionIndex] ?? "winding";
    const directionLabel = ROUTE_DIRECTION_LABELS[direction];

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
    else setPending(null);
  };

  const restartJourney = () => {
    firedInitialRef.current = null; // let the initial-crossroads effect fire again
    setJourney(baseline);
    setMarkerMonth(0);
    setPending(null);
    setDecisionLog([]);
    setLastDirection("The road out of high school");
    setStatus("Your first crossroads is right in front of you.");
    revealMap(selectRouteMap("straight", "opening-road"));
  };

  const openPageFromPrompt = (prompt: string) => {
    const normalized = prompt.toLowerCase();
    const matched = JOURNEY_PAGES.find((page) => normalized.includes(page.id) || normalized.includes(page.label.toLowerCase()));
    if (matched) setActivePage(matched.id);
    else if (normalized.includes("money") || normalized.includes("worth")) setActivePage("overview");
    else if (normalized.includes("retire") || normalized.includes("future")) setActivePage("forecast");
  };

  const worldHud = (
    <section className="journey-hud scroll" aria-label="Journey status">
      <div className="journey-hud__heading">
        <div>
          <span className="eyebrow">Age {ageNow} · {stage.emoji} {stage.label} · route {stopIndex} of {STOPS}</span>
          <h1>{lastDirection}</h1>
        </div>
        <div className="journey-hud__utility">
          <button type="button" className="journey-hud__reset" onClick={onEditStart}>Edit start</button>
          <button type="button" className="journey-hud__reset" onClick={restartJourney}>Restart</button>
        </div>
      </div>
      <p aria-live="polite">{status}</p>
      <div className="journey-hud__progress" aria-label={`${progress}% of journey complete`}>
        <i style={{ width: `${progress}%` }} />
      </div>
      {opportunities.length > 0 && !pending && (
        <div className="journey-hud__opportunities">
          <span className="eyebrow">Open to you now</span>
          <div className="journey-hud__opps-row">
            {opportunities.map((node) => (
              <button key={node.id} type="button" className="ornate-btn dt-opportunity" onClick={() => openOpportunity(node)}>
                {nodeEmoji(node)} {node.title}
              </button>
            ))}
          </div>
        </div>
      )}
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
        defaultPanelOpen
        onMenuClick={() => setActivePage("overview")}
        onPromptSubmit={openPageFromPrompt}
        onToolClick={(tool) => { if (isJourneyPage(tool)) setActivePage(tool); }}
        panel={sidebarPage}
        panelTitle="Life dashboard"
        tools={PAGE_TOOLS}
        worldHud={worldHud}
      >
        <div className="journey-world">
          <img
            key={`${worldMap.id}-${mapRevision}`}
            className="journey-world__map"
            src={worldMap.src}
            alt={`${worldMap.label} watercolor route world`}
          />
          <div className="journey-world__atmosphere" aria-hidden="true" />
          <div className="journey-world__route-label">
            <span>{worldMap.library === "pre-journey" ? "pre-journey scene" : routeKindLabel(worldMap)}</span>
            <b>{worldMap.label}</b>
          </div>
        </div>
      </UiShell>

      {pending && (
        <DecisionExperience
          age={pending.age}
          node={pending.node}
          ctx={{ ...journey.context, month: pending.month }}
          onChoose={chooseRoute}
          onDismiss={pending.node.trigger === "opportunity" ? () => setPending(null) : undefined}
        />
      )}
    </div>
  );
}
