import type { Cents } from "../money/index.js";
import type { MonthKey } from "../types/month.js";
import type { JsonValue, ReplayVersionSet, StableId, ValidationIssue, VersionedReference } from "./values.js";

export const DECISION_IMPORTANCE_LEVELS = ["minor", "major"] as const;
export type DecisionImportanceLevel = (typeof DECISION_IMPORTANCE_LEVELS)[number];

export interface DecisionImportance {
  level: DecisionImportanceLevel;
  reason: string;
  comparisonMetricKeys: readonly string[];
  requiresExplicitConfirmation: boolean;
}

export const DECISION_SESSION_STATUSES = ["open", "preview", "compare", "committed", "cancelled"] as const;
export type DecisionSessionStatus = (typeof DECISION_SESSION_STATUSES)[number];

export interface DecisionSession {
  id: StableId;
  decision: VersionedReference;
  importance: DecisionImportance;
  status: DecisionSessionStatus;
  sourceRunId: StableId;
  sourceMonth: MonthKey;
  selectedOption?: VersionedReference;
  /** Normalized user choices only; no Date, bigint, class instance, or callback. */
  inputs: Readonly<Record<string, JsonValue>>;
  versions: ReplayVersionSet;
  createdAt: string;
  updatedAt: string;
}

const NEXT_SESSION_STATUSES: Readonly<Record<DecisionSessionStatus, readonly DecisionSessionStatus[]>> = {
  open: ["preview", "cancelled"],
  preview: ["preview", "compare", "cancelled"],
  compare: ["preview", "committed", "cancelled"],
  committed: [],
  cancelled: [],
};

export function canTransitionDecisionSession(from: DecisionSessionStatus, to: DecisionSessionStatus): boolean {
  return from === to || NEXT_SESSION_STATUSES[from].includes(to);
}

export function transitionDecisionSession(session: DecisionSession, status: DecisionSessionStatus, updatedAt: string): DecisionSession {
  if (!canTransitionDecisionSession(session.status, status)) {
    throw new RangeError(`Cannot transition decision session from ${session.status} to ${status}`);
  }
  if (status === "committed" && session.selectedOption === undefined) {
    throw new RangeError("Cannot commit a decision session without a selectedOption");
  }
  return { ...session, status, updatedAt };
}

export interface AssumptionOverride {
  key: string;
  value: JsonValue;
  unit?: string;
  reason?: string;
}

export interface DecisionPreviewRequest {
  sessionId: StableId;
  optionRefs: readonly VersionedReference[];
  horizonMonths: number;
  assumptions: readonly AssumptionOverride[];
  /** Keeps stochastic comparisons aligned without carrying a live RNG. */
  randomSeed: string | number;
}

export interface PreviewMetric {
  key: string;
  unit: "cents" | "percent" | "count" | "hours" | "months" | "score";
  baselineValue: number;
  projectedValue: number;
  delta: number;
}

export interface MonthlyPreviewDelta {
  month: MonthKey;
  values: Readonly<Record<string, number>>;
}

export interface PreviewExplanationLine {
  id: StableId;
  label: string;
  amountCents?: Cents;
  formula?: VersionedReference;
  sourceRecords: readonly VersionedReference[];
  inputs: Readonly<Record<string, JsonValue>>;
}

export interface DecisionOptionPreview {
  scenarioId: StableId;
  option: VersionedReference;
  eligible: boolean;
  issues: readonly ValidationIssue[];
  immediateCashRequiredCents: Cents;
  metrics: readonly PreviewMetric[];
  monthlyDeltas: readonly MonthlyPreviewDelta[];
  explanations: readonly PreviewExplanationLine[];
}

export interface DecisionComparisonPreview {
  sessionId: StableId;
  sourceRunId: StableId;
  sourceMonth: MonthKey;
  horizonMonths: number;
  versions: ReplayVersionSet;
  options: readonly DecisionOptionPreview[];
}
