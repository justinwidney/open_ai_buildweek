import { useMemo, useRef, useState } from "react";
import { createRandomSource } from "@control-ai/engine";
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
import { eventForAge, type EventOption, type LifeEvent } from "./labs/decision-travel/lifeEvents";
import { LifeEventPopup } from "./labs/decision-travel/LifeEventPopup";
import {
  directionsForOptions,
  ROUTE_DIRECTION_LABELS,
  selectDecisionMap,
  selectRouteMap,
  type DecisionMap,
} from "./labs/decision-travel/decisionMaps";
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
  { id: "overview", label: "Overview", icon: "\u2302", Panel: OverviewPanel },
  { id: "tax", label: "Taxes", icon: "%", Panel: TaxPanel },
  { id: "budget", label: "Budget", icon: "$", Panel: BudgetPanel },
  { id: "accounts", label: "Accounts", icon: "\u25a4", Panel: AccountsPanel },
  { id: "goals", label: "Goals", icon: "\u2605", Panel: GoalsPanel },
  { id: "forecast", label: "Forecast", icon: "\u2197", Panel: ForecastPanel },
] as const;

type JourneyPageId = (typeof JOURNEY_PAGES)[number]["id"];

const PAGE_TOOLS: readonly ShellTool[] = JOURNEY_PAGES.map(({ id, label, icon }) => ({ id, label, icon }));
interface PendingEvent {
  event: LifeEvent;
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
  const [pending, setPending] = useState<PendingEvent | null>(null);
  const [worldMap, setWorldMap] = useState(() => selectRouteMap("straight", "opening-road"));
  const [mapRevision, setMapRevision] = useState(0);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [lastDirection, setLastDirection] = useState("Straight path");
  const [status, setStatus] = useState("The road ahead is clear. Travel when you are ready.");
  const firedRef = useRef<Set<string>>(new Set());

  const stopIndex = Math.round(markerMonth / STOP_MONTHS);
  const ageNow = settings.age + stopIndex;
  const statement = useMemo(
    () => statementAt(journey, markerMonth, settings.age),
    [journey, markerMonth, settings.age],
  );
  const activePageConfig = JOURNEY_PAGES.find((page) => page.id === activePage)!;
  const ActivePanel = activePageConfig.Panel;
  const progress = Math.round((stopIndex / STOPS) * 100);

  const revealMap = (map: DecisionMap) => {
    setWorldMap(map);
    setMapRevision((revision) => revision + 1);
  };

  const advanceToNextCrossroads = () => {
    if (pending || stopIndex >= STOPS) return;

    for (let nextStop = stopIndex + 1; nextStop <= STOPS; nextStop += 1) {
      const age = settings.age + nextStop;
      const random = createRandomSource(`evt-${settings.age}-${age}`);
      const event = eventForAge(age, firedRef.current, () => random.next());
      if (!event) continue;

      const month = nextStop * STOP_MONTHS;
      setMarkerMonth(month);
      revealMap(selectDecisionMap(event, age));
      setPending({ event, age, month });
      setStatus(`${event.title} has appeared at age ${age}. Choose the route forward.`);
      return;
    }

    setMarkerMonth(STOPS * STOP_MONTHS);
    revealMap(selectRouteMap("straight", "journey-complete"));
    setStatus("You reached the end of this forty-year route.");
  };

  const chooseRoute = (option: EventOption) => {
    if (!pending) return;
    const optionIndex = pending.event.options.findIndex((candidate) => candidate.id === option.id);
    const direction = directionsForOptions(pending.event.options, pending.event.routeKind)[optionIndex] ?? "winding";
    const directionLabel = ROUTE_DIRECTION_LABELS[direction];

    firedRef.current.add(pending.event.id);
    if (option.build) {
      setJourney((current) => applyDecision(current, pending.month, option.build!(pending.month), { eventId: pending.event.id, optionId: option.id }));
    }
    setDecisionLog((current) => [
      ...current,
      { age: pending.age, event: pending.event.title, choice: option.label, direction: directionLabel },
    ]);
    setLastDirection(directionLabel);
    setStatus(`You chose "${option.label}" and continued along the ${directionLabel.toLowerCase()}.`);
    setPending(null);
  };

  const restartJourney = () => {
    firedRef.current = new Set();
    setJourney(baseline);
    setMarkerMonth(0);
    setPending(null);
    setDecisionLog([]);
    setLastDirection("Straight path");
    setStatus("The road ahead is clear. Travel when you are ready.");
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
          <span className="eyebrow">Age {ageNow} / route {stopIndex} of {STOPS}</span>
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
      <div className="journey-hud__actions">
        <div><span>Net worth</span><b>{fmtMoney(statement?.balanceSheet.netWorthCents ?? 0)}</b></div>
        <button
          type="button"
          className="ornate-btn is-primary"
          disabled={Boolean(pending) || stopIndex >= STOPS}
          onClick={advanceToNextCrossroads}
        >
          {stopIndex >= STOPS ? "Journey complete" : "Travel to next crossroads"}
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
            <span>{routeKindLabel(worldMap)}</span>
            <b>{worldMap.label}</b>
          </div>
        </div>
      </UiShell>

      {pending && (
        <LifeEventPopup
          age={pending.age}
          event={pending.event}
          onChoose={chooseRoute}
          showMap={false}
        />
      )}
    </div>
  );
}
