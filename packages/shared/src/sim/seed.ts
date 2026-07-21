import {
  computeNetWorthCents,
  initialDebtState,
  initialFinancialAssetState,
  initialHoldingState,
  initialTaxBasis,
  type Cents,
  type DebtConfig,
  type ExpenseConfig,
  type FilingStatus,
  type FinancialAssetConfig,
  type Household,
  type HoldingConfig,
  type IncomeSourceConfig,
  type LifeStateSnapshot,
  type PhysicalAssetConfig,
} from "@control-ai/engine";

/**
 * Everything needed to reconstruct a run's month-0 `LifeStateSnapshot` from
 * scratch — the static entity *configs*, not the evolving balances.
 *
 * Both @control-ai/db and @control-ai/convex already had a `rootSeed` column
 * described as "the initial decisions/config a run was seeded with," typed
 * `unknown` / `v.any()`. That left a real hole, called out in
 * @control-ai/db's repository.ts: the fact tables store *aggregate results*
 * (net worth, named flows/balances), never an income's growth rate or a
 * debt's term, so a persisted run could not be resumed or re-forked — the
 * configs simply weren't anywhere. Typing the seed and pairing it with
 * `buildInitialSnapshot` closes that: seed + decision list + rng seed is a
 * complete, replayable description of a run in a few kilobytes, which is
 * also exactly what makes the localStorage backend viable.
 */
export interface RootSeed {
  /** Bumped when a field's meaning changes, so a stored seed can be migrated rather than misread. */
  version: 1;
  /** Calendar year month 0 falls in — drives tax-bracket and contribution-limit lookup. */
  startCalendarYear: number;
  filingStatus: FilingStatus;
  /** Primary person's whole-year age at month 0. Drives `byAge` goals and a statement's reported age. */
  ageYearsAtStart?: number;
  /** Full household (members + dependents), when modeled. Takes precedence over `ageYearsAtStart`. */
  household?: Household;
  incomes: readonly IncomeSourceConfig[];
  expenses: readonly ExpenseConfig[];
  debts: readonly DebtConfig[];
  financialAssets: readonly OpeningBalance<FinancialAssetConfig>[];
  holdings: readonly OpeningBalance<HoldingConfig>[];
  physicalAssets: readonly PhysicalAssetConfig[];
  /** Seeds the run's `RandomSource`, so a Monte Carlo run replays identically. */
  rngSeed: string | number;
}

/** A config plus the balance it starts at — balances evolve, configs don't, so only the opening value belongs in a seed. */
export interface OpeningBalance<TConfig> {
  config: TConfig;
  openingBalanceCents: Cents;
}

export const EMPTY_ROOT_SEED_FIELDS = {
  version: 1,
  incomes: [],
  expenses: [],
  debts: [],
  financialAssets: [],
  holdings: [],
  physicalAssets: [],
} as const;

/**
 * Builds the month-0 snapshot a run starts from. Pure: the same seed always
 * produces the same snapshot, which is what lets any backend store only the
 * seed and rebuild the rest on demand.
 */
export function buildInitialSnapshot(runId: string, seed: RootSeed): LifeStateSnapshot {
  const financialAssets = seed.financialAssets.map((a) => initialFinancialAssetState(a.config, a.openingBalanceCents));
  const holdings = seed.holdings.map((h) => initialHoldingState(h.config, h.openingBalanceCents));
  const debts = seed.debts.map((config) => initialDebtState(config));
  const physicalAssets = seed.physicalAssets.map((config) => ({ config }));
  const portfolio = { holdings };

  return {
    runId,
    month: 0,
    parentSnapshotRef: null,
    decisions: [],
    incomes: seed.incomes.map((config) => ({ config })),
    expenses: seed.expenses.map((config) => ({ config })),
    debts,
    financialAssets,
    portfolio,
    physicalAssets,
    taxBasis: initialTaxBasis(seed.startCalendarYear, seed.filingStatus),
    netWorthCents: computeNetWorthCents({ financialAssets, portfolio, physicalAssets, debts, month: 0 }),
    extensions: {},
  };
}

export function isRootSeed(value: unknown): value is RootSeed {
  if (typeof value !== "object" || value === null) return false;
  const seed = value as Partial<RootSeed>;
  return seed.version === 1 && typeof seed.startCalendarYear === "number" && Array.isArray(seed.incomes) && Array.isArray(seed.expenses);
}
