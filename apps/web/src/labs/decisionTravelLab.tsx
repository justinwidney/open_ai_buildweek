import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  buildMonthlyStatement,
  buyHome,
  changeContributionRate,
  changeJob,
  compareTrajectories,
  computeNetWorthCents,
  createFixedReturnsStrategy,
  createRandomSource,
  forkWithEvent,
  haveChild,
  initialFinancialAssetState,
  initialHoldingState,
  initialTaxBasis,
  marry,
  receiveWindfall,
  referenceData2026,
  rootRun,
  runSimulation,
  cents,
  type EventEffect,
  type LifeStateSnapshot,
  type MonthDetail,
} from "@control-ai/engine";
import "./lab.css";
import "./decisionTravelLab.css";

// A "Fast travel" through a life: each platform is a year you move to; each fork is a decision.
const HORIZON = 360; // 30 years of months
const STOP_MONTHS = 12; // one platform per year
const STOPS = Math.floor(HORIZON / STOP_MONTHS);
const PATH_COLORS = ["#7cc4ff", "#ffcf6b", "#a0e8a0", "#ff9ecb", "#c3a0ff", "#ff8f6b"];

const returnsStrategy = createFixedReturnsStrategy({ equity: 0.07 });
const runOptions = () => ({ returnsStrategy, referenceData: referenceData2026, rng: createRandomSource("decision-travel") });

interface LifeSettings {
  age: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  startingCash: number;
  startingInvestments: number;
  deferralPct: number;
}

const DEFAULT_SETTINGS: LifeSettings = { age: 26, monthlyIncome: 8500, monthlyExpenses: 4200, startingCash: 20000, startingInvestments: 15000, deferralPct: 6 };

interface DemoPath {
  id: string;
  label: string;
  color: string;
  parentId?: string;
  forkMonth?: number;
  decisionLabel?: string;
  snapshots: readonly LifeStateSnapshot[];
  details: readonly MonthDetail[];
}

function buildInitial(settings: LifeSettings): LifeStateSnapshot {
  const income = { config: { id: "job", label: "Career", baseMonthlyGrossCents: cents(settings.monthlyIncome), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: settings.deferralPct / 100, startMonth: 0 } };
  const expense = { config: { id: "living", label: "Living costs", category: "fixed" as const, baseMonthlyAmountCents: cents(settings.monthlyExpenses), annualInflationRate: 0.03, startMonth: 0 } };
  const cashAsset = initialFinancialAssetState({ id: "cash", label: "Cash", annualInterestRate: 0.01 }, cents(settings.startingCash));
  const holding = initialHoldingState({ id: "brokerage", label: "Investments", assetClassId: "equity", accountType: "taxableBrokerage" }, cents(settings.startingInvestments));
  const taxBasis = initialTaxBasis(2026, "single");
  const netWorthCents = computeNetWorthCents({ financialAssets: [cashAsset], portfolio: { holdings: [holding] }, physicalAssets: [], debts: [], month: 0 });
  return { runId: "baseline", month: 0, parentSnapshotRef: null, decisions: [], incomes: [income], expenses: [expense], debts: [], financialAssets: [cashAsset], portfolio: { holdings: [holding] }, physicalAssets: [], taxBasis, netWorthCents, extensions: {} };
}

function runBaseline(settings: LifeSettings): DemoPath {
  const { snapshots, details } = runSimulation(buildInitial(settings), HORIZON, runOptions());
  return { id: "baseline", label: "Baseline", color: PATH_COLORS[0]!, snapshots, details };
}

function forkPath(parent: DemoPath, forkMonth: number, effect: EventEffect, id: string, label: string, color: string): DemoPath {
  const parentAtFork = parent.snapshots[forkMonth]!;
  const { snapshot } = forkWithEvent({ parent: rootRun(parent.id), forkMonth, newRunId: id, parentSnapshotAtFork: parentAtFork, effect });
  const forward = runSimulation(snapshot, HORIZON - forkMonth, runOptions());
  return {
    id,
    label,
    color,
    parentId: parent.id,
    forkMonth,
    decisionLabel: effect.decision.label,
    snapshots: [...parent.snapshots.slice(0, forkMonth), ...forward.snapshots],
    details: [...parent.details.slice(0, forkMonth), ...forward.details],
  };
}

// --- Decision catalog: the popup's choices, each with a couple of custom settings ---
interface DecisionField {
  key: string;
  label: string;
  default: number;
  min: number;
  max: number;
  step: number;
  prefix?: string;
  suffix?: string;
}
interface DecisionDef {
  id: string;
  emoji: string;
  label: string;
  blurb: string;
  fields: DecisionField[];
  build: (month: number, v: Record<string, number>) => EventEffect;
}

const DECISIONS: DecisionDef[] = [
  {
    id: "home",
    emoji: "🏠",
    label: "Buy a home",
    blurb: "Convert cash to equity, take on a mortgage.",
    fields: [
      { key: "price", label: "Price", default: 380000, min: 150000, max: 1200000, step: 10000, prefix: "$" },
      { key: "downPct", label: "Down payment", default: 20, min: 3, max: 50, step: 1, suffix: "%" },
    ],
    build: (month, v) =>
      buyHome({ id: `home-${month}`, priceCents: cents(v.price!), downPaymentCents: cents((v.price! * v.downPct!) / 100), closingCostsCents: cents(v.price! * 0.03), mortgageAnnualRate: 0.065, termMonths: 360, monthlyEscrowCents: cents((v.price! * 0.015) / 12), monthlyMaintenanceCents: cents((v.price! * 0.01) / 12), annualAppreciationRate: 0.03, effectiveFromMonth: month }),
  },
  {
    id: "job",
    emoji: "💼",
    label: "Change careers",
    blurb: "Swap to a new salary trajectory.",
    fields: [{ key: "salary", label: "New monthly pay", default: 12000, min: 3000, max: 40000, step: 500, prefix: "$" }],
    build: (month, v) => changeJob({ oldIncomeId: "job", newJob: { id: "job", label: "New career", baseMonthlyGrossCents: cents(v.salary!), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.08 }, effectiveFromMonth: month }),
  },
  {
    id: "save",
    emoji: "📈",
    label: "Change savings rate",
    blurb: "Adjust your 401(k) contribution.",
    fields: [{ key: "rate", label: "Deferral", default: 15, min: 0, max: 40, step: 1, suffix: "%" }],
    build: (month, v) => changeContributionRate({ incomeId: "job", newDeferralRate: v.rate! / 100, effectiveFromMonth: month }),
  },
  {
    id: "marry",
    emoji: "💍",
    label: "Get married",
    blurb: "File jointly, add a partner's income.",
    fields: [{ key: "spouseIncome", label: "Partner monthly pay", default: 6000, min: 0, max: 30000, step: 500, prefix: "$" }],
    build: (month, v) => marry({ effectiveFromMonth: month, spouseIncome: v.spouseIncome! > 0 ? { id: "spouse", label: "Partner", baseMonthlyGrossCents: cents(v.spouseIncome!), annualGrowthRate: 0.03, stateCode: "TX", pretaxDeferralRate: 0.05 } : undefined, weddingCostCents: cents(22000) }),
  },
  {
    id: "child",
    emoji: "🍼",
    label: "Have a child",
    blurb: "Add years of childcare costs.",
    fields: [{ key: "childcare", label: "Childcare / month", default: 1600, min: 0, max: 5000, step: 100, prefix: "$" }],
    build: (month, v) => haveChild({ childId: `kid-${month}`, effectiveFromMonth: month, oneTimeBirthCostCents: cents(6000), monthlyChildcareCents: cents(v.childcare!), childcareEndMonth: month + 60 }),
  },
  {
    id: "windfall",
    emoji: "🎁",
    label: "Windfall",
    blurb: "Inheritance, bonus, or equity sale.",
    fields: [{ key: "amount", label: "Amount", default: 75000, min: 5000, max: 1000000, step: 5000, prefix: "$" }],
    build: (month, v) => receiveWindfall({ id: `wf-${month}`, amountCents: cents(v.amount!), effectiveFromMonth: month }),
  },
];

function fmtMoney(c: number): string {
  const dollars = Math.round(c / 100);
  const sign = dollars < 0 ? "-" : "";
  const abs = Math.abs(dollars);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}k`;
  return `${sign}$${abs}`;
}

function DecisionTravelLab() {
  const [settings, setSettings] = useState<LifeSettings>(DEFAULT_SETTINGS);
  const [paths, setPaths] = useState<DemoPath[]>([]);
  const [activeId, setActiveId] = useState("baseline");
  const [markerMonth, setMarkerMonth] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [decisionId, setDecisionId] = useState(DECISIONS[0]!.id);
  const [fieldValues, setFieldValues] = useState<Record<string, number>>({});
  const roadRef = useRef<HTMLDivElement>(null);

  const started = paths.length > 0;
  const active = paths.find((p) => p.id === activeId) ?? paths[0];
  const baseline = paths[0];

  const stopIndex = Math.round(markerMonth / STOP_MONTHS);
  const ageAt = (month: number) => settings.age + Math.floor(month / 12);

  function begin() {
    const base = runBaseline(settings);
    setPaths([base]);
    setActiveId("baseline");
    setMarkerMonth(0);
  }

  function travelTo(nextStop: number) {
    const clamped = Math.max(0, Math.min(STOPS, nextStop));
    setMarkerMonth(clamped * STOP_MONTHS);
  }

  const selectedDecision = DECISIONS.find((d) => d.id === decisionId)!;
  function openDecisions() {
    const defaults: Record<string, number> = {};
    for (const f of selectedDecision.fields) defaults[f.key] = f.default;
    setFieldValues(defaults);
    setModalOpen(true);
  }
  function pickDecision(id: string) {
    setDecisionId(id);
    const def = DECISIONS.find((d) => d.id === id)!;
    const defaults: Record<string, number> = {};
    for (const f of def.fields) defaults[f.key] = f.default;
    setFieldValues(defaults);
  }
  function commitDecision() {
    if (!active) return;
    const effect = selectedDecision.build(markerMonth, fieldValues);
    const id = `${selectedDecision.id}-${paths.length}`;
    const color = PATH_COLORS[paths.length % PATH_COLORS.length]!;
    const label = `${selectedDecision.emoji} ${selectedDecision.label} @ ${ageAt(markerMonth)}`;
    const child = forkPath(active, markerMonth, effect, id, label, color);
    setPaths((prev) => [...prev, child]);
    setActiveId(id);
    setModalOpen(false);
  }

  useEffect(() => {
    const road = roadRef.current;
    if (!road) return;
    const node = road.querySelector<HTMLElement>(`[data-stop="${stopIndex}"]`);
    node?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [stopIndex, activeId]);

  // Current-month statement for the stats panel.
  const statement = useMemo(() => {
    if (!active) return null;
    const snapshot = active.snapshots[markerMonth];
    if (!snapshot) return null;
    const detail = markerMonth > 0 ? active.details[markerMonth - 1] : undefined;
    return buildMonthlyStatement({ snapshot, detail, context: { ageYearsAtStart: settings.age } });
  }, [active, markerMonth, settings.age]);

  // Divergence vs baseline, on net worth.
  const divergence = useMemo(() => {
    if (!active || !baseline || active.id === baseline.id) return null;
    const d = compareTrajectories(baseline.snapshots, active.snapshots, { metric: "netWorth" });
    return d.maxDivergence;
  }, [active, baseline]);

  if (!started) {
    return (
      <main className="dt-setup">
        <div className="dt-setup__card">
          <h1>Decision Fast-Travel</h1>
          <p>Set up a starting life, then travel year by year. At any platform, make a decision — it forks a new path you can compare against the others.</p>
          <div className="dt-fields">
            <label>Starting age<input type="number" value={settings.age} onChange={(e) => setSettings({ ...settings, age: +e.target.value })} /></label>
            <label>Monthly income<input type="number" step={100} value={settings.monthlyIncome} onChange={(e) => setSettings({ ...settings, monthlyIncome: +e.target.value })} /></label>
            <label>Monthly expenses<input type="number" step={100} value={settings.monthlyExpenses} onChange={(e) => setSettings({ ...settings, monthlyExpenses: +e.target.value })} /></label>
            <label>Starting cash<input type="number" step={1000} value={settings.startingCash} onChange={(e) => setSettings({ ...settings, startingCash: +e.target.value })} /></label>
            <label>Starting investments<input type="number" step={1000} value={settings.startingInvestments} onChange={(e) => setSettings({ ...settings, startingInvestments: +e.target.value })} /></label>
            <label>401(k) deferral %<input type="number" step={1} value={settings.deferralPct} onChange={(e) => setSettings({ ...settings, deferralPct: +e.target.value })} /></label>
          </div>
          <button className="dt-primary" onClick={begin}>Begin life →</button>
        </div>
      </main>
    );
  }

  const chart = <NetWorthChart paths={paths} markerMonth={markerMonth} settings={settings} />;

  return (
    <main className="dt">
      <header className="dt-top">
        <div className="dt-paths">
          {paths.map((p) => (
            <button key={p.id} className={`dt-chip ${p.id === activeId ? "is-active" : ""}`} style={{ borderColor: p.color }} onClick={() => setActiveId(p.id)}>
              <i style={{ background: p.color }} /> {p.label}
            </button>
          ))}
        </div>
        <button className="dt-reset" onClick={() => setPaths([])}>Restart</button>
      </header>

      <section className="dt-road" ref={roadRef}>
        {Array.from({ length: STOPS + 1 }, (_, i) => {
          const month = i * STOP_MONTHS;
          const nw = active?.snapshots[month]?.netWorthCents ?? 0;
          const isFork = active?.forkMonth !== undefined && active.forkMonth === month;
          return (
            <div key={i} data-stop={i} className={`dt-stop ${i === stopIndex ? "is-here" : ""} ${i < stopIndex ? "is-past" : ""}`}>
              <div className="dt-stop__nw" style={{ color: active?.color }}>{fmtMoney(nw)}</div>
              <button className="dt-platform" style={{ borderColor: active?.color }} onClick={() => travelTo(i)}>
                {i === stopIndex && <span className="dt-traveller">🧍</span>}
                {isFork && <span className="dt-forkflag">⑂</span>}
              </button>
              <div className="dt-stop__age">age {ageAt(month)}</div>
            </div>
          );
        })}
      </section>

      <section className="dt-controls">
        <button className="dt-nav" disabled={stopIndex <= 0} onClick={() => travelTo(stopIndex - 1)}>◀ Back</button>
        <button className="dt-primary" onClick={openDecisions}>Make a decision at age {ageAt(markerMonth)}</button>
        <button className="dt-nav" disabled={stopIndex >= STOPS} onClick={() => travelTo(stopIndex + 1)}>Travel ▶</button>
      </section>

      <section className="dt-lower">
        <div className="dt-panel dt-chart">{chart}</div>
        <aside className="dt-panel dt-stats">
          <h3>Age {ageAt(markerMonth)} · {active?.label}</h3>
          {statement && (
            <ul>
              <li><span>Net worth</span><b>{fmtMoney(statement.balanceSheet.netWorthCents)}</b></li>
              <li><span>Take-home / mo</span><b>{fmtMoney(statement.income.takeHomeCents)}</b></li>
              <li><span>Spending / mo</span><b>{fmtMoney(statement.spending.totalCents)}</b></li>
              <li><span>Savings rate</span><b>{(statement.cashFlow.savingsRate * 100).toFixed(0)}%</b></li>
              <li><span>Investments</span><b>{fmtMoney(statement.balanceSheet.investmentsCents)}</b></li>
              <li><span>Debt</span><b>{fmtMoney(statement.balanceSheet.totalLiabilitiesCents)}</b></li>
              <li><span>FI progress</span><b>{(statement.planning.fiProgress * 100).toFixed(0)}%</b></li>
            </ul>
          )}
          {divergence && (
            <div className="dt-diverge">
              <span>vs Baseline · max divergence</span>
              <b style={{ color: divergence.deltaCents < 0 ? "#a0e8a0" : "#ff9ecb" }}>
                {divergence.deltaCents < 0 ? "+" : "−"}{fmtMoney(divergence.absCents)}
              </b>
              <small>at age {ageAt(divergence.month)}</small>
            </div>
          )}
          {active?.decisionLabel && <p className="dt-note">This path forked on: <strong>{active.decisionLabel}</strong></p>}
        </aside>
      </section>

      {modalOpen && (
        <div className="dt-modal" onClick={() => setModalOpen(false)}>
          <div className="dt-modal__card" onClick={(e) => e.stopPropagation()}>
            <h2>Decision at age {ageAt(markerMonth)}</h2>
            <div className="dt-decision-grid">
              {DECISIONS.map((d) => (
                <button key={d.id} className={`dt-decision ${d.id === decisionId ? "is-active" : ""}`} onClick={() => pickDecision(d.id)}>
                  <span className="dt-decision__emoji">{d.emoji}</span>
                  <strong>{d.label}</strong>
                  <small>{d.blurb}</small>
                </button>
              ))}
            </div>
            <div className="dt-modal__fields">
              {selectedDecision.fields.map((f) => (
                <label key={f.key}>
                  <span>{f.label}: {f.prefix ?? ""}{(fieldValues[f.key] ?? f.default).toLocaleString()}{f.suffix ?? ""}</span>
                  <input type="range" min={f.min} max={f.max} step={f.step} value={fieldValues[f.key] ?? f.default} onChange={(e) => setFieldValues({ ...fieldValues, [f.key]: +e.target.value })} />
                </label>
              ))}
            </div>
            <div className="dt-modal__actions">
              <button className="dt-nav" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="dt-primary" onClick={commitDecision}>Fork this path →</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function NetWorthChart({ paths, markerMonth, settings }: { paths: DemoPath[]; markerMonth: number; settings: LifeSettings }) {
  const W = 720;
  const H = 260;
  const pad = 34;
  const maxNw = Math.max(1, ...paths.flatMap((p) => p.snapshots.filter((_, i) => i % STOP_MONTHS === 0).map((s) => s.netWorthCents)));
  const x = (month: number) => pad + (month / HORIZON) * (W - pad * 2);
  const y = (nw: number) => H - pad - (Math.max(0, nw) / maxNw) * (H - pad * 2);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="dt-svg" preserveAspectRatio="xMidYMid meet">
      <line x1={x(markerMonth)} y1={pad - 10} x2={x(markerMonth)} y2={H - pad} className="dt-svg__marker" />
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line x1={pad} y1={y(maxNw * f)} x2={W - pad} y2={y(maxNw * f)} className="dt-svg__grid" />
          <text x={4} y={y(maxNw * f) + 3} className="dt-svg__label">{fmtMoney(maxNw * f)}</text>
        </g>
      ))}
      {paths.map((p) => {
        const pts = p.snapshots.filter((_, i) => i % STOP_MONTHS === 0).map((s) => `${x(s.month)},${y(s.netWorthCents)}`).join(" ");
        return <polyline key={p.id} points={pts} fill="none" stroke={p.color} strokeWidth={2.5} />;
      })}
      {[0, 10, 20, 30].map((yr) => (
        <text key={yr} x={x(yr * 12)} y={H - 8} className="dt-svg__label">age {settings.age + yr}</text>
      ))}
    </svg>
  );
}

createRoot(document.getElementById("decision-travel-root")!).render(
  <StrictMode>
    <DecisionTravelLab />
  </StrictMode>,
);
