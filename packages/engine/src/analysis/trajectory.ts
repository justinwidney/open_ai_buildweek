import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { LifeStateSnapshot } from "../simulation/state.js";
import type { Goal, GoalContext, GoalMetric, GoalProgress } from "../goals/index.js";
import { evaluateGoal, metricValueCents } from "../goals/index.js";

/** A month-ordered sequence of snapshots — one life path. Both a run and its branch can be materialized this way. */
export type Path = readonly LifeStateSnapshot[];

const MONTHS_PER_YEAR = 12;

export interface DivergencePoint {
  month: MonthKey;
  valueA: Cents;
  valueB: Cents;
  /** A − B for this month's metric. */
  deltaCents: Cents;
}

export interface TemporalDivergence {
  metric: GoalMetric;
  series: DivergencePoint[];
  /** First month the two paths differ on this metric, or null if they never do. */
  forkMonth: MonthKey | null;
  /** Where the paths differ most (largest |A − B|), or null if identical throughout. */
  maxDivergence: { month: MonthKey; deltaCents: Cents; absCents: Cents } | null;
  /** A − B at the last shared month. */
  finalDeltaCents: Cents;
  /** True when the gap is narrowing by the end (|final| < |max|) — the paths are reconverging. */
  converging: boolean;
}

function byMonth(path: Path): Map<MonthKey, LifeStateSnapshot> {
  return new Map(path.map((s) => [s.month, s]));
}

/**
 * Method A — temporal divergence. Compares two paths month by month on a
 * metric (default net worth) and finds where and by how much they separate:
 * the fork month, the month of maximum divergence, and whether they're
 * reconverging by the end. Answers "where did life A and life B differ most?"
 * Pure; aligns on the months both paths share.
 */
export function compareTrajectories(pathA: Path, pathB: Path, options: { metric?: GoalMetric; context?: GoalContext } = {}): TemporalDivergence {
  const metric = options.metric ?? "netWorth";
  const context = options.context ?? {};
  const mapB = byMonth(pathB);

  const series: DivergencePoint[] = [];
  for (const snapshotA of pathA) {
    const snapshotB = mapB.get(snapshotA.month);
    if (!snapshotB) continue;
    const valueA = metricValueCents(metric, snapshotA, context);
    const valueB = metricValueCents(metric, snapshotB, context);
    series.push({ month: snapshotA.month, valueA, valueB, deltaCents: valueA - valueB });
  }
  series.sort((a, b) => a.month - b.month);

  const forkPoint = series.find((p) => p.deltaCents !== 0);
  let maxDivergence: TemporalDivergence["maxDivergence"] = null;
  for (const p of series) {
    const abs = Math.abs(p.deltaCents);
    if (!maxDivergence || abs > maxDivergence.absCents) maxDivergence = { month: p.month, deltaCents: p.deltaCents, absCents: abs };
  }
  const finalDeltaCents = series.length > 0 ? series[series.length - 1]!.deltaCents : 0;
  const converging = maxDivergence !== null && Math.abs(finalDeltaCents) < maxDivergence.absCents;

  return { metric, series, forkMonth: forkPoint?.month ?? null, maxDivergence, finalDeltaCents, converging };
}

export interface GoalGapTrajectory {
  goalId: string;
  series: readonly GoalProgress[];
  /** The month/age this path falls furthest short of the goal — the "greatest divergence from desired results at a certain age." Null if never behind. */
  maxShortfall: { month: MonthKey; ageYears?: number; shortfallCents: Cents } | null;
}

/**
 * Method C (core) — goal-relative gap over time. Evaluates a goal at every
 * month of a path and finds the age of maximum shortfall. This is the literal
 * "where is the greatest divergence between desired results and this path at a
 * certain age" the product is built around.
 */
export function goalGapTrajectory(goal: Goal, path: Path, context: GoalContext = {}): GoalGapTrajectory {
  const series = path.map((s) => evaluateGoal(goal, s, context));

  let maxShortfall: GoalGapTrajectory["maxShortfall"] = null;
  for (const p of series) {
    if (p.shortfallCents <= 0) continue;
    if (!maxShortfall || p.shortfallCents > maxShortfall.shortfallCents) {
      const ageYears = context.ageYearsAtStart === undefined ? undefined : context.ageYearsAtStart + Math.floor(p.month / MONTHS_PER_YEAR);
      maxShortfall = { month: p.month, ageYears, shortfallCents: p.shortfallCents };
    }
  }
  return { goalId: goal.id, series, maxShortfall };
}
