/**
 * Linear-interpolation percentile over an ascending-sorted numeric array —
 * the same method as NumPy's default (`linear`) and most spreadsheet
 * `PERCENTILE` functions, so a P50 here matches what an analyst would get
 * elsewhere. `p` is a percentile in `[0, 100]`.
 */
export function percentileOfSorted(ascending: readonly number[], p: number): number {
  const n = ascending.length;
  if (n === 0) throw new Error("percentileOfSorted requires a non-empty array");
  if (n === 1) return ascending[0]!;

  const clamped = Math.min(100, Math.max(0, p));
  const rank = (clamped / 100) * (n - 1);
  const lowIndex = Math.floor(rank);
  const highIndex = Math.ceil(rank);
  if (lowIndex === highIndex) return ascending[lowIndex]!;

  const fraction = rank - lowIndex;
  const low = ascending[lowIndex]!;
  const high = ascending[highIndex]!;
  return low + (high - low) * fraction;
}

/** Arithmetic mean of a non-empty numeric array. */
export function meanOf(values: readonly number[]): number {
  if (values.length === 0) throw new Error("meanOf requires a non-empty array");
  let total = 0;
  for (const value of values) total += value;
  return total / values.length;
}
