import { useMemo, useState } from "react";
import {
  createMonteCarloReturnsStrategy,
  evaluateBudget,
  evaluateGoal,
  recommendedBudget,
  referenceData2026,
  runMonteCarloForecast,
  cents,
  type Goal,
  type GoalMetric,
  type MonteCarloForecastResult,
  type MonthlyStatement,
} from "@control-ai/engine";
import { fmtMoney, fmtMoneyFull, fmtPct } from "./format";
import { HORIZON, type JourneyPath } from "./pathModel";
import { contextWithFinances } from "./journeyGraph";
import { ForecastBandsChart, NetWorthChart } from "./charts";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b className={tone ? `is-${tone}` : ""}>{value}</b>
    </div>
  );
}

function Meter({ fraction, tone = "plum" }: { fraction: number; tone?: "plum" | "good" | "bad" }) {
  return (
    <div className="meter">
      <i className={`is-${tone}`} style={{ width: `${Math.max(0, Math.min(1, fraction)) * 100}%` }} />
    </div>
  );
}

interface PanelProps {
  statement: MonthlyStatement;
  journey: JourneyPath;
  baseline: JourneyPath;
  month: number;
  startAge: number;
}

export function OverviewPanel({ statement, journey, baseline, month, startAge }: PanelProps) {
  const s = statement;
  return (
    <div className="panel-body">
      <div className="headline">
        <span className="eyebrow">Net worth</span>
        <h2>{fmtMoneyFull(s.balanceSheet.netWorthCents)}</h2>
      </div>
      <NetWorthChart journey={journey.snapshots} baseline={baseline.snapshots} month={month} startAge={startAge} horizon={HORIZON} />
      <div className="stat-grid">
        <Stat label="Take-home / mo" value={fmtMoney(s.income.takeHomeCents)} />
        <Stat label="Spending / mo" value={fmtMoney(s.spending.totalCents)} />
        <Stat label="Savings rate" value={fmtPct(s.cashFlow.savingsRate)} tone={s.cashFlow.savingsRate >= 0.15 ? "good" : undefined} />
        <Stat label="Investments" value={fmtMoney(s.balanceSheet.investmentsCents)} />
        <Stat label="Debt" value={fmtMoney(s.balanceSheet.totalLiabilitiesCents)} tone={s.balanceSheet.totalLiabilitiesCents > 0 ? "bad" : undefined} />
        <Stat label="FI progress" value={fmtPct(s.planning.fiProgress)} />
      </div>
    </div>
  );
}

export function TaxPanel({ statement }: PanelProps) {
  const t = statement.taxes;
  const gross = Math.max(1, statement.income.grossCents);
  const rows: { label: string; cents: number; color: string }[] = [
    { label: "Federal", cents: t.federalCents, color: "#6a4a97" },
    { label: "State", cents: t.stateCents, color: "#3f7d4a" },
    { label: "FICA", cents: t.ficaCents, color: "#c39a3f" },
  ];
  return (
    <div className="panel-body">
      <div className="headline"><span className="eyebrow">Effective tax rate</span><h2>{fmtPct(t.effectiveRate, 1)}</h2></div>
      <div className="taxbar">
        {rows.map((r) => (
          <div key={r.label} className="taxbar__seg" style={{ width: `${(r.cents / gross) * 100}%`, background: r.color }} title={`${r.label}: ${fmtMoneyFull(r.cents)}`} />
        ))}
        <div className="taxbar__seg is-takehome" style={{ width: `${(statement.income.takeHomeCents / gross) * 100}%` }} title="Take-home" />
      </div>
      <div className="stat-grid">
        <Stat label="Gross / mo" value={fmtMoney(statement.income.grossCents)} />
        <Stat label="Federal" value={fmtMoney(t.federalCents)} />
        <Stat label="State" value={fmtMoney(t.stateCents)} />
        <Stat label="FICA" value={fmtMoney(t.ficaCents)} />
        <Stat label="Pretax 401(k)" value={fmtMoney(statement.income.pretaxContributionCents)} />
        <Stat label="Take-home" value={fmtMoney(statement.income.takeHomeCents)} tone="good" />
      </div>
      <p className="note">Federal withholding is cumulative — it climbs through the year as wages clear the standard deduction.</p>
    </div>
  );
}

export function BudgetPanel({ statement, journey }: PanelProps) {
  const rec = useMemo(() => recommendedBudget(contextWithFinances(journey.context, statement)), [journey.context, statement]);
  const report = useMemo(() => evaluateBudget(rec.target, statement), [rec, statement]);
  const maxPct = Math.max(...rec.categories.map((c) => c.pctOfTakeHome), 1);
  return (
    <div className="panel-body">
      <div className="headline"><span className="eyebrow">Recommended budget</span><h2>{rec.headline}</h2></div>
      <p className="note">{rec.rationale}</p>
      <p className="dt-sub">Based on take-home of {fmtMoneyFull(rec.monthlyTakeHomeCents)}/mo · target savings {rec.savingsRatePct}%</p>

      <span className="eyebrow" style={{ display: "block", marginTop: 10 }}>Suggested monthly split</span>
      {rec.categories.map((c) => (
        <div key={c.key} className="budget-row">
          <div className="budget-row__head"><span>{c.label}</span><b>{fmtMoney(c.monthlyCents)} · {c.pctOfTakeHome}%</b></div>
          <Meter fraction={c.pctOfTakeHome / maxPct} tone={c.key === "savings" ? "good" : "plum"} />
        </div>
      ))}

      <span className="eyebrow" style={{ display: "block", marginTop: 14 }}>How you're actually tracking</span>
      {report.totalSpending && (
        <div className="budget-row">
          <div className="budget-row__head"><span>Total spending</span><b className={report.totalSpending.overBudget ? "is-bad" : "is-good"}>{fmtMoney(report.totalSpending.actualCents)} / {fmtMoney(report.totalSpending.limitCents)}</b></div>
          <Meter fraction={report.totalSpending.actualCents / Math.max(1, report.totalSpending.limitCents)} tone={report.totalSpending.overBudget ? "bad" : "good"} />
        </div>
      )}
      {report.savingsRate && (
        <div className="budget-row">
          <div className="budget-row__head"><span>Savings rate</span><b className={report.savingsRate.met ? "is-good" : "is-bad"}>{fmtPct(report.savingsRate.actualRate)} vs {fmtPct(report.savingsRate.targetRate)} target</b></div>
          <Meter fraction={report.savingsRate.actualRate / Math.max(0.01, report.savingsRate.targetRate)} tone={report.savingsRate.met ? "good" : "bad"} />
        </div>
      )}
    </div>
  );
}

export function AccountsPanel({ statement }: PanelProps) {
  const bt = statement.balanceSheet.byTaxTreatment;
  const groups: { label: string; cents: number }[] = [
    { label: "Taxable", cents: bt.taxable },
    { label: "Tax-deferred (401k/IRA)", cents: bt.taxDeferred },
    { label: "Roth", cents: bt.roth },
    { label: "HSA", cents: bt.hsa },
    { label: "529 college", cents: bt.education529 },
  ].filter((g) => g.cents !== 0);
  const total = Math.max(1, statement.balanceSheet.totalAssetsCents);
  return (
    <div className="panel-body">
      <div className="headline"><span className="eyebrow">Balance sheet</span><h2>{fmtMoneyFull(statement.balanceSheet.netWorthCents)}</h2></div>
      <span className="eyebrow">Financial accounts by tax treatment</span>
      {groups.map((g) => (
        <div key={g.label} className="budget-row">
          <div className="budget-row__head"><span>{g.label}</span><b>{fmtMoney(g.cents)}</b></div>
          <Meter fraction={g.cents / total} />
        </div>
      ))}
      <div className="stat-grid" style={{ marginTop: 12 }}>
        <Stat label="Cash" value={fmtMoney(statement.balanceSheet.cashCents)} />
        <Stat label="Investments" value={fmtMoney(statement.balanceSheet.investmentsCents)} />
        <Stat label="Property" value={fmtMoney(statement.balanceSheet.physicalCents)} />
        <Stat label="Total assets" value={fmtMoney(statement.balanceSheet.totalAssetsCents)} />
        <Stat label="Liabilities" value={fmtMoney(statement.balanceSheet.totalLiabilitiesCents)} tone={statement.balanceSheet.totalLiabilitiesCents > 0 ? "bad" : undefined} />
        <Stat label="Net worth" value={fmtMoney(statement.balanceSheet.netWorthCents)} tone="good" />
      </div>
    </div>
  );
}

const GOAL_METRICS: { value: GoalMetric; label: string }[] = [
  { value: "netWorth", label: "Net worth" },
  { value: "retirementIncome", label: "Retirement income / yr" },
  { value: "liquidNetWorth", label: "Liquid net worth" },
  { value: "homeEquity", label: "Home equity" },
  { value: "debtFree", label: "Debt (≤ target)" },
];

export function GoalsPanel({ journey, month, startAge }: PanelProps) {
  const [goals, setGoals] = useState<Goal[]>([
    { id: "fi", label: "$1.5M net worth by 60", metric: "netWorth", targetCents: cents(1_500_000), byAge: 60 },
    { id: "debt", label: "Debt-free by 55", metric: "debtFree", targetCents: 0, byAge: 55 },
  ]);
  const [metric, setMetric] = useState<GoalMetric>("netWorth");
  const [target, setTarget] = useState(500000);
  const [byAge, setByAge] = useState(55);
  const snapshot = journey.snapshots[month]!;

  function addGoal() {
    const label = `${GOAL_METRICS.find((g) => g.value === metric)!.label} ${fmtMoney(cents(target))} by ${byAge}`;
    setGoals((prev) => [...prev, { id: `g-${prev.length}-${Date.now()}`, label, metric, targetCents: cents(target), byAge }]);
  }

  return (
    <div className="panel-body">
      <div className="headline"><span className="eyebrow">Goals</span><h2>{goals.filter((g) => evaluateGoal(g, snapshot, { ageYearsAtStart: startAge }).achieved).length}/{goals.length} on track</h2></div>
      {goals.map((g) => {
        const p = evaluateGoal(g, snapshot, { ageYearsAtStart: startAge });
        return (
          <div key={g.id} className="budget-row">
            <div className="budget-row__head"><span>{g.label}</span><b className={p.achieved ? "is-good" : ""}>{p.achieved ? "✓" : fmtMoney(p.shortfallCents) + " to go"}</b></div>
            <Meter fraction={p.progress} tone={p.achieved ? "good" : "plum"} />
          </div>
        );
      })}
      <div className="goal-form">
        <select value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
          {GOAL_METRICS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
        <input type="number" step={10000} value={target} onChange={(e) => setTarget(+e.target.value)} aria-label="target dollars" />
        <span>by age</span>
        <input type="number" value={byAge} onChange={(e) => setByAge(+e.target.value)} aria-label="by age" style={{ width: 56 }} />
        <button className="ornate-btn is-gold" onClick={addGoal}>Add</button>
      </div>
    </div>
  );
}

export function ForecastPanel({ journey, month, startAge }: PanelProps) {
  const [result, setResult] = useState<MonteCarloForecastResult | null>(null);
  const [running, setRunning] = useState(false);

  function run() {
    setRunning(true);
    // Defer so the button shows a running state before the synchronous compute.
    setTimeout(() => {
      const initial = journey.snapshots[month]!;
      const months = Math.min(HORIZON - month, 40 * 12);
      const strategy = createMonteCarloReturnsStrategy({ equity: { annualMeanReturn: 0.07, annualVolatility: 0.16 } });
      setResult(runMonteCarloForecast({ initial, monthsToSimulate: months, paths: 250, returnsStrategy: strategy, referenceData: referenceData2026, seed: "decision-travel-forecast", goalCents: cents(1_000_000) }));
      setRunning(false);
    }, 20);
  }

  const terminal = result?.bands.at(-1)?.percentileCents;
  return (
    <div className="panel-body">
      <div className="headline"><span className="eyebrow">Monte Carlo forecast</span><h2>{result ? fmtPct(result.successProbability) + " reach $1M" : "—"}</h2></div>
      {result ? (
        <>
          <ForecastBandsChart bands={result.bands} startMonth={month} startAge={startAge + Math.floor(month / 12)} />
          {terminal && (
            <div className="stat-grid">
              <Stat label="Pessimistic (P10)" value={fmtMoney(terminal[10] ?? 0)} />
              <Stat label="Expected (P50)" value={fmtMoney(terminal[50] ?? 0)} tone="good" />
              <Stat label="Optimistic (P90)" value={fmtMoney(terminal[90] ?? 0)} />
              <Stat label="Chance of $1M+" value={fmtPct(result.successProbability)} />
              <Stat label="Ran out of money" value={fmtPct(result.ruinProbability)} tone={result.ruinProbability > 0.1 ? "bad" : undefined} />
              <Stat label="Paths simulated" value={`${result.paths}`} />
            </div>
          )}
        </>
      ) : (
        <p className="note">Run {250} random market paths from your current age forward to see the range of possible futures.</p>
      )}
      <button className="ornate-btn is-primary" onClick={run} disabled={running} style={{ marginTop: 10 }}>{running ? "Simulating…" : result ? "Re-run forecast" : "Run forecast"}</button>
    </div>
  );
}
