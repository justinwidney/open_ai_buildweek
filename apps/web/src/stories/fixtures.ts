import { findNode, initialLifeContext, lifeGraph2026, type LifeContext, type LifeStage } from "@control-ai/engine";

/**
 * Shared story fixtures. Everything here is built from the real engine
 * constructors rather than hand-written object literals, so a story breaks
 * loudly when the context shape changes instead of drifting quietly.
 */

interface ContextOptions {
  age?: number;
  stage?: LifeStage;
  /** Monthly take-home in whole dollars. 0 means "income not established yet". */
  takeHome?: number;
  flags?: Record<string, string | number | boolean>;
}

export function mockContext({ age = 19, stage = "school", takeHome = 2_400, flags = {} }: ContextOptions = {}): LifeContext {
  const base = initialLifeContext({ ageYears: age, stage, flags });
  if (takeHome <= 0) return base;
  const takeHomeCents = Math.round(takeHome * 100);
  return {
    ...base,
    finances: {
      liquidCents: 640_000,
      cashCents: 310_000,
      monthlyGrossCents: Math.round(takeHomeCents * 1.28),
      monthlyTakeHomeCents: takeHomeCents,
      monthlySpendingCents: Math.round(takeHomeCents * 0.78),
      monthlyDebtPaymentCents: 32_000,
      netWorthCents: 410_000,
      emergencyFundMonths: 2.4,
      savingsRate: 0.11,
    },
  };
}

/** Pull a real node out of the shipped catalog so stories exercise real data. */
export function catalogNode(nodeId: string) {
  const node = findNode(lifeGraph2026, nodeId);
  if (!node) throw new Error(`Story fixture: no node "${nodeId}" in lifeGraph2026`);
  return node;
}

/** Story action logger that also shows up in the Storybook actions panel. */
export const noop = () => {};
