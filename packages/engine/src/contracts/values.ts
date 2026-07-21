/** JSON-safe values accepted at process, worker, and persistence boundaries. */
export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

/**
 * A durable identifier. IDs are deliberately plain strings so serialized
 * records do not need casts at database and worker boundaries.
 */
export type StableId = string;

/** A version identifier such as `2026.1`, `v2`, or a content hash. */
export type VersionId = string;

/** A durable reference to one immutable version of a definition or dataset. */
export interface VersionedReference {
  id: StableId;
  version: VersionId;
}

/** The versions required to replay a simulation result. */
export interface ReplayVersionSet {
  engineVersion: VersionId;
  schemaVersion: number;
  dataBundle: VersionedReference;
  /** Optional canonical hash for detecting a changed bundle under the same label. */
  dataBundleHash?: string;
}

/** Start is inclusive and end, when present, is exclusive. */
export interface EffectivePeriod<TBoundary extends string | number = number> {
  effectiveFrom: TBoundary;
  effectiveTo?: TBoundary;
}

export const DATA_QUALITY_LEVELS = ["verified", "estimated", "derived", "user-provided", "unknown"] as const;
export type DataQuality = (typeof DATA_QUALITY_LEVELS)[number];

/** Source metadata for a catalog or any simulation-affecting assumption. */
export interface SourceProvenance {
  sourceId: StableId;
  publisher: string;
  asOf: string;
  url?: string;
  retrievedAt?: string;
  geography?: string;
  currency?: string;
  methodology?: string;
  quality: DataQuality;
  license?: string;
}

/** Provenance for a value calculated from versioned inputs. */
export interface DerivedProvenance {
  formula: VersionedReference;
  sourceRecords: readonly VersionedReference[];
  note?: string;
}

export const VALIDATION_SEVERITIES = ["error", "warning", "info"] as const;
export type ValidationSeverity = (typeof VALIDATION_SEVERITIES)[number];

export interface ValidationIssue {
  code: string;
  severity: ValidationSeverity;
  message: string;
  /** Serializable property path, for example `["schedule", "daysOn"]`. */
  path?: readonly (string | number)[];
  source?: VersionedReference;
}

export interface ValidationResult {
  valid: boolean;
  issues: readonly ValidationIssue[];
}

const STABLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isStableId(value: unknown): value is StableId {
  return typeof value === "string" && STABLE_ID_PATTERN.test(value);
}

export function isVersionId(value: unknown): value is VersionId {
  return typeof value === "string" && VERSION_PATTERN.test(value);
}

/** Strict `YYYY-MM-DD` check, including invalid calendar days. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value)) return false;
  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function isEffectiveAt<TBoundary extends string | number>(period: EffectivePeriod<TBoundary>, point: TBoundary): boolean {
  return point >= period.effectiveFrom && (period.effectiveTo === undefined || point < period.effectiveTo);
}

export function validateEffectivePeriod<TBoundary extends string | number>(period: EffectivePeriod<TBoundary>): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (period.effectiveTo !== undefined && period.effectiveTo <= period.effectiveFrom) {
    issues.push({
      code: "effective-period.invalid-order",
      severity: "error",
      message: "effectiveTo must be later than effectiveFrom",
      path: ["effectiveTo"],
    });
  }
  return validationResult(issues);
}

export function validationResult(issues: readonly ValidationIssue[]): ValidationResult {
  return { valid: !issues.some((issue) => issue.severity === "error"), issues };
}
