/**
 * Money is represented as an integer number of cents, never a floating-point
 * dollar amount. `Number.MAX_SAFE_INTEGER` cents is about $90 trillion, far
 * beyond any realistic single-life simulation, so a plain `number` stays
 * exact for addition/subtraction (the operations accounting identities
 * depend on) while avoiding the ergonomics/perf cost of `bigint` or a
 * decimal library. `assertSafe` turns the one real remaining risk —
 * runaway compounding in a pathological Monte Carlo path — into a loud
 * error instead of silent precision loss.
 */
export type Cents = number;

/** Comfortably above any realistic simulated net worth; a tripped guard rail, not a modeled limit. */
export const MAX_SAFE_CENTS: Cents = 1_000_000_000_000 * 100; // $1 trillion, in cents

export function assertSafe(value: Cents, context = "amount"): void {
  if (!Number.isInteger(value)) {
    throw new RangeError(`${context} must be an integer number of cents, got ${value}`);
  }
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${context} exceeds Number.MAX_SAFE_INTEGER cents: ${value}`);
  }
  if (Math.abs(value) > MAX_SAFE_CENTS) {
    throw new RangeError(`${context} exceeds the configured safety ceiling of ${MAX_SAFE_CENTS} cents: ${value}`);
  }
}

/** Round-half-to-even ("banker's rounding") — avoids the systematic upward bias of Math.round on .5 boundaries. */
export function roundHalfEven(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  // Exactly .5: round to whichever neighbor is even.
  return floor % 2 === 0 ? floor : floor + 1;
}

/** Boundary conversion in: dollars (possibly fractional, e.g. from user input) to integer cents. */
export function cents(wholeDollars: number): Cents {
  const value = roundHalfEven(wholeDollars * 100);
  assertSafe(value, "cents()");
  return value;
}

/** Boundary conversion out: integer cents to a dollar float, for display only — never re-enter arithmetic with this. */
export function toDollars(value: Cents): number {
  return value / 100;
}

export function addC(...values: readonly Cents[]): Cents {
  const total = values.reduce((sum, v) => sum + v, 0);
  assertSafe(total, "addC() result");
  return total;
}

export function subC(a: Cents, b: Cents): Cents {
  const result = a - b;
  assertSafe(result, "subC() result");
  return result;
}

export function negateC(value: Cents): Cents {
  return -value;
}

/** Applies a (possibly negative, possibly fractional) rate to an amount, rounding to the nearest cent. */
export function applyRate(value: Cents, rate: number): Cents {
  const result = roundHalfEven(value * rate);
  assertSafe(result, "applyRate() result");
  return result;
}

export function isZero(value: Cents): boolean {
  return value === 0;
}

export function minC(a: Cents, b: Cents): Cents {
  return a < b ? a : b;
}

export function maxC(a: Cents, b: Cents): Cents {
  return a > b ? a : b;
}

/** Clamps to zero from below — common for "cannot go below $0" balances (e.g. a paid-off debt). */
export function clampNonNegative(value: Cents): Cents {
  return value < 0 ? 0 : value;
}

/**
 * Splits `total` across `weights` (proportional shares) using the largest-
 * remainder method, so the parts always sum to exactly `total` — no silent
 * penny drift, which is the property a "correct static financial snapshot"
 * actually depends on. Weights may be zero; negative weights are rejected.
 */
export function allocate(total: Cents, weights: readonly number[]): Cents[] {
  assertSafe(total, "allocate() total");
  if (weights.length === 0) {
    if (total !== 0) throw new RangeError("allocate() called with no weights but a non-zero total");
    return [];
  }
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new RangeError("allocate() weights must be finite and non-negative");
  }
  const weightSum = weights.reduce((sum, w) => sum + w, 0);
  if (weightSum === 0) {
    // No basis to allocate proportionally; put everything on the first slot rather than divide by zero.
    return weights.map((_, i) => (i === 0 ? total : 0));
  }

  const rawShares = weights.map((w) => (total * w) / weightSum);
  const flooredShares = rawShares.map((s) => Math.floor(s));
  let remainder = total - flooredShares.reduce((sum, s) => sum + s, 0);

  // Distribute the leftover cents to the entries with the largest fractional remainder first.
  const order = rawShares
    .map((s, i) => ({ i, frac: s - flooredShares[i]! }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...flooredShares];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] = (result[i] ?? 0) + 1;
    remainder -= 1;
  }
  result.forEach((v, i) => assertSafe(v, `allocate() share[${i}]`));
  return result;
}
