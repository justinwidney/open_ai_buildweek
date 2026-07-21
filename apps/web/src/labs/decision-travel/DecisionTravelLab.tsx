import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createRandomSource } from "@control-ai/engine";
import "../lab.css";
import "./theme.css";
import "./panels.css";
import { DEFAULT_SETTINGS, STOP_MONTHS, STOPS, applyDecision, runBaseline, seedFromSettings, statementAt, type JourneyPath, type LifeSettings } from "./pathModel";
import { eventForAge, type EventOption, type LifeEvent } from "./lifeEvents";
import { LifeEventPopup } from "./LifeEventPopup";
import { AccountsPanel, BudgetPanel, ForecastPanel, GoalsPanel, OverviewPanel, TaxPanel } from "./panels";
import { fmtMoney } from "./format";
import { createLife, deleteLife, listSavedLives, persistDecision, persistThrough, restoreJourney, storageStatus, type SavedLife } from "./persistence";

const TABS = [
  { id: "overview", label: "Overview", Panel: OverviewPanel },
  { id: "tax", label: "Taxes", Panel: TaxPanel },
  { id: "budget", label: "Budget", Panel: BudgetPanel },
  { id: "accounts", label: "Accounts", Panel: AccountsPanel },
  { id: "goals", label: "Goals", Panel: GoalsPanel },
  { id: "forecast", label: "Forecast", Panel: ForecastPanel },
] as const;

interface PendingEvent {
  event: LifeEvent;
  age: number;
  month: number;
}

/** Surfaces whether work is actually being saved. `memory` means localStorage was unavailable (private mode, blocked cookies). */
function StorageBadge({ version }: { version: number }) {
  const status = useMemo(() => storageStatus(), [version]);
  return (
    <p className="dt-storage">
      {status.durable ? `Saved locally · ${status.kb} KB` : "⚠ Not being saved — this browser is blocking local storage"}
    </p>
  );
}

function DecisionTravelLab() {
  const [settings, setSettings] = useState<LifeSettings>(DEFAULT_SETTINGS);
  const [baseline, setBaseline] = useState<JourneyPath | null>(null);
  const [journey, setJourney] = useState<JourneyPath | null>(null);
  const [markerMonth, setMarkerMonth] = useState(0);
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const [pending, setPending] = useState<PendingEvent | null>(null);
  const [saved, setSaved] = useState<SavedLife[]>([]);
  const [busy, setBusy] = useState(false);
  const [storageVersion, setStorageVersion] = useState(0);
  const firedRef = useRef<Set<string>>(new Set());
  const roadRef = useRef<HTMLDivElement>(null);
  /** Highest month whose data has been written, so travelling only ever appends the newly revealed range. */
  const persistedThroughRef = useRef(0);

  const startAge = settings.age;
  const stopIndex = Math.round(markerMonth / STOP_MONTHS);
  const ageNow = startAge + stopIndex;

  const refreshSaved = useCallback(async () => {
    setSaved(await listSavedLives());
    setStorageVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  async function begin() {
    setBusy(true);
    try {
      const seed = seedFromSettings(settings);
      const base = runBaseline(settings);
      const runId = await createLife(settings, base, seed);
      const withRun = { ...base, runId };
      firedRef.current = new Set();
      persistedThroughRef.current = 0;
      setBaseline(withRun);
      setJourney(withRun);
      setMarkerMonth(0);
      setPending(null);
      await refreshSaved();
    } finally {
      setBusy(false);
    }
  }

  /** Rebuilds a saved life by replaying its stored decisions over a fresh run from its seed. */
  async function resume(life: SavedLife) {
    setBusy(true);
    try {
      const restored = await restoreJourney(life);
      firedRef.current = restored.fired;
      persistedThroughRef.current = life.progressMonth;
      setSettings(life.settings);
      setBaseline(restored.baseline);
      setJourney(restored.journey);
      setMarkerMonth(life.progressMonth);
      setPending(null);
      requestAnimationFrame(() => scrollToStop(Math.round(life.progressMonth / STOP_MONTHS)));
    } finally {
      setBusy(false);
    }
  }

  async function discard(life: SavedLife) {
    await deleteLife(life.run.id);
    await refreshSaved();
  }

  function leaveToSetup() {
    setJourney(null);
    setBaseline(null);
    setMarkerMonth(0);
    setPending(null);
    void refreshSaved();
  }

  function scrollToStop(index: number) {
    roadRef.current?.querySelector<HTMLElement>(`[data-stop="${index}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  function travel(delta: number) {
    if (!journey) return;
    const next = Math.max(0, Math.min(STOPS, stopIndex + delta));
    const nextMonth = next * STOP_MONTHS;
    setMarkerMonth(nextMonth);
    scrollToStop(next);
    if (delta <= 0) return;

    // Extend the stored range to cover the year just revealed. The stored range
    // doubles as the progress marker, which is how a resume knows where to land.
    if (journey.runId && nextMonth > persistedThroughRef.current) {
      const from = persistedThroughRef.current;
      persistedThroughRef.current = nextMonth;
      void persistThrough(journey.runId, journey, from, nextMonth).then(() => setStorageVersion((v) => v + 1));
    }

    const age = startAge + next;
    const src = createRandomSource(`evt-${settings.age}-${age}`);
    const ev = eventForAge(age, firedRef.current, () => src.next());
    if (ev) setPending({ event: ev, age, month: nextMonth });
  }

  function choose(opt: EventOption) {
    if (!pending || !journey) return;
    firedRef.current.add(pending.event.id);
    setPending(null);

    if (!opt.build) return; // Declined — the path is unchanged, so there is nothing to persist.

    const next = applyDecision(journey, pending.month, opt.build(pending.month), { eventId: pending.event.id, optionId: opt.id });
    setJourney(next);
    const step = next.history[next.history.length - 1]!;
    if (next.runId) {
      // A fork rewrites every month from here on, so re-persist the range already
      // stored; `appendMonths` is idempotent per month, so this overwrites rather than duplicates.
      void persistDecision(next.runId, next, step, persistedThroughRef.current).then(() => setStorageVersion((v) => v + 1));
    }
  }

  const statement = useMemo(() => (journey ? statementAt(journey, markerMonth, startAge) : null), [journey, markerMonth, startAge]);

  if (!journey || !baseline) {
    return (
      <main className="dt-app setup">
        <div className="scroll setup-card">
          <div className="event-card__head"><div className="crest">♛</div><div><span className="eyebrow">Financial pathway simulator</span><h1 className="dt-title">Begin a life</h1></div></div>
          <p className="dt-sub">Set your starting point, then travel year by year. As you age, forks in the road appear — some at life's usual milestones, some by chance — and every choice reshapes your path.</p>

          {saved.length > 0 && (
            <div className="saved-lives">
              <span className="eyebrow">Continue a life</span>
              <ul>
                {saved.map((life) => (
                  <li key={life.run.id}>
                    <button className="saved-life" disabled={busy} onClick={() => void resume(life)}>
                      <b>{life.run.label}</b>
                      <span>
                        age {life.settings.age + Math.round(life.progressMonth / 12)} · {fmtMoney(life.netWorthCents)} · {life.decisionCount} decision{life.decisionCount === 1 ? "" : "s"}
                      </span>
                    </button>
                    <button className="saved-life__x" title="Delete this life" disabled={busy} onClick={() => void discard(life)}>×</button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="setup-fields">
            {([
              ["age", "Starting age", 1],
              ["monthlyIncome", "Monthly income", 100],
              ["monthlyExpenses", "Monthly expenses", 100],
              ["startingCash", "Starting cash", 1000],
              ["startingInvestments", "Starting investments", 1000],
              ["deferralPct", "401(k) deferral %", 1],
            ] as const).map(([key, label, step]) => (
              <label key={key}>{label}<input type="number" step={step} value={settings[key]} onChange={(e) => setSettings({ ...settings, [key]: +e.target.value })} /></label>
            ))}
          </div>
          <button className="ornate-btn is-primary" disabled={busy} onClick={() => void begin()}>{busy ? "Setting out…" : "Set out →"}</button>
          <StorageBadge version={storageVersion} />
        </div>
      </main>
    );
  }

  const ActivePanel = TABS.find((t) => t.id === tab)!.Panel;
  const forkMonths = new Set(journey.history.map((h) => h.month));

  return (
    <main className="dt-app">
      <header className="dt-header scroll">
        <div className="event-card__head" style={{ marginBottom: 0 }}>
          <div className="crest">♛</div>
          <div><span className="eyebrow">Age {ageNow}</span><h1 className="dt-title">Your pathway</h1></div>
        </div>
        <div className="dt-header__nw"><span className="eyebrow">Net worth</span><b>{fmtMoney(journey.snapshots[markerMonth]?.netWorthCents ?? 0)}</b></div>
        <button className="ornate-btn" onClick={leaveToSetup}>Saved lives</button>
      </header>

      <section className="road scroll" ref={roadRef}>
        {Array.from({ length: STOPS + 1 }, (_, i) => {
          const month = i * STOP_MONTHS;
          const nw = journey.snapshots[month]?.netWorthCents ?? 0;
          return (
            <button key={i} data-stop={i} className={`stop ${i === stopIndex ? "is-here" : ""} ${i < stopIndex ? "is-past" : ""}`} onClick={() => { setMarkerMonth(month); scrollToStop(i); }}>
              <span className="stop__nw">{fmtMoney(nw)}</span>
              <span className="platform">{i === stopIndex && <span className="traveller">🧍</span>}{forkMonths.has(month) && <span className="forkflag">⚑</span>}</span>
              <span className="stop__age">{startAge + i}</span>
            </button>
          );
        })}
      </section>

      <section className="dt-controls">
        <button className="ornate-btn" disabled={stopIndex <= 0} onClick={() => travel(-1)}>◀ Look back</button>
        <button className="ornate-btn is-primary" disabled={stopIndex >= STOPS} onClick={() => travel(1)}>Travel a year ▶</button>
      </section>

      <section className="dt-lower">
        <div className="scroll module">
          <nav className="tabs">
            {TABS.map((t) => <button key={t.id} className={`tab ${t.id === tab ? "is-active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </nav>
          {statement && <ActivePanel statement={statement} journey={journey} baseline={baseline} month={markerMonth} startAge={startAge} />}
        </div>
        <aside className="scroll ledger">
          <span className="eyebrow">Decisions taken</span>
          {journey.history.length === 0 ? (
            <p className="dt-sub">No forks yet. Travel forward to meet them.</p>
          ) : (
            <ul>{journey.history.map((h, i) => <li key={i}><b>age {startAge + Math.round(h.month / 12)}</b> {h.label}</li>)}</ul>
          )}
          <StorageBadge version={storageVersion} />
        </aside>
      </section>

      {pending && <LifeEventPopup event={pending.event} age={pending.age} onChoose={choose} />}
    </main>
  );
}

createRoot(document.getElementById("decision-travel-root")!).render(
  <StrictMode>
    <DecisionTravelLab />
  </StrictMode>,
);
