/**
 * Lifecycle enums. Before this file the same four strings were declared
 * three incompatible ways: a bare `text()` column in @control-ai/db (so
 * `status: "banana"` type-checked), a `v.union(v.literal(...))` in Convex,
 * and a prose comment in the Cube model. Declared once here as a const
 * tuple + derived union so every backend narrows to the same set and the
 * Cube YAML can be checked against it in a test.
 */

export const RUN_STATUSES = ["draft", "running", "done", "error"] as const;
export type RunStatus = (typeof RUN_STATUSES)[number];

export const JOB_STATUSES = ["queued", "running", "done", "error"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export function isRunStatus(value: unknown): value is RunStatus {
  return typeof value === "string" && (RUN_STATUSES as readonly string[]).includes(value);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return typeof value === "string" && (JOB_STATUSES as readonly string[]).includes(value);
}

/** Narrows a value read back from an untyped store (a jsonb blob, a `text` column), failing loudly rather than letting a bad status flow into the UI. */
export function parseRunStatus(value: unknown): RunStatus {
  if (!isRunStatus(value)) throw new TypeError(`Not a RunStatus: ${JSON.stringify(value)} (expected one of ${RUN_STATUSES.join(", ")})`);
  return value;
}

export function parseJobStatus(value: unknown): JobStatus {
  if (!isJobStatus(value)) throw new TypeError(`Not a JobStatus: ${JSON.stringify(value)} (expected one of ${JOB_STATUSES.join(", ")})`);
  return value;
}
