import type { FilingStatus } from "../types/tax-basis.js";

/**
 * Everyone whose finances the simulation tracks. Ages are stored as a
 * **birth month relative to the run's month 0** — negative for someone born
 * before the sim started (a 30-year-old at month 0 has `birthMonth: -360`).
 * Storing the offset (not a fixed age) means age advances automatically as
 * the run ticks forward, which is what drives contribution catch-ups, RMDs,
 * Social Security timing, and "results at a certain age."
 */
export interface Person {
  id: string;
  label: string;
  birthMonth: number;
  role: "primary" | "spouse";
}

export type DependentKind = "child" | "other";

export interface Dependent {
  id: string;
  label: string;
  birthMonth: number;
  kind: DependentKind;
}

export interface Household {
  filingStatus: FilingStatus;
  /** The primary person, and a spouse if filing jointly/separately. */
  members: readonly Person[];
  dependents: readonly Dependent[];
}
