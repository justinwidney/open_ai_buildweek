import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  canTransitionDecisionSession,
  isEffectiveAt,
  isIsoDate,
  isStableId,
  paymentsPerNormalYear,
  transitionDecisionSession,
  validateEffectivePeriod,
  validatePaySchedule,
  validateWorkSchedule,
  type CatalogQuery,
  type DecisionComparisonPreview,
  type DecisionSession,
} from "./index.js";

describe("stable and effective value contracts", () => {
  it("accepts storage-safe ids and real ISO calendar dates", () => {
    assert.equal(isStableId("occupation/software-developer"), true);
    assert.equal(isStableId(" contains spaces "), false);
    assert.equal(isIsoDate("2028-02-29"), true);
    assert.equal(isIsoDate("2027-02-29"), false);
  });

  it("uses inclusive starts and exclusive ends", () => {
    const period = { effectiveFrom: 12, effectiveTo: 24 };
    assert.equal(validateEffectivePeriod(period).valid, true);
    assert.equal(isEffectiveAt(period, 12), true);
    assert.equal(isEffectiveAt(period, 24), false);
    assert.equal(validateEffectivePeriod({ effectiveFrom: 24, effectiveTo: 12 }).valid, false);
  });
});

describe("pay cadence and work rotations", () => {
  it("exposes the normal-year cadence counts without monthly normalization", () => {
    assert.equal(paymentsPerNormalYear("weekly"), 52);
    assert.equal(paymentsPerNormalYear("biweekly"), 26);
    assert.equal(paymentsPerNormalYear("semimonthly"), 24);
    assert.equal(paymentsPerNormalYear("monthly"), 12);
  });

  it("validates anchored 7/7 and 10/4 rotations", () => {
    for (const [daysOn, daysOff] of [[7, 7], [10, 4]] as const) {
      const result = validateWorkSchedule({
        hoursPerShift: 12,
        shift: "rotating",
        pattern: { kind: "rotation", daysOn, daysOff, anchorOnDate: "2026-01-05" },
      });
      assert.equal(result.valid, true);
    }
    assert.equal(validateWorkSchedule({ hoursPerShift: 12, shift: "night", pattern: { kind: "rotation", daysOn: 0, daysOff: 7, anchorOnDate: "2026-01-05" } }).valid, false);
  });

  it("validates cadence-specific schedule fields", () => {
    assert.equal(validatePaySchedule({ cadence: "biweekly", anchorPayDate: "2026-01-09" }).valid, true);
    assert.equal(validatePaySchedule({ cadence: "semimonthly", daysOfMonth: [15, 31], nonBusinessDayPolicy: "previous-business-day" }).valid, true);
    assert.equal(validatePaySchedule({ cadence: "semimonthly", daysOfMonth: [15, 15], nonBusinessDayPolicy: "previous-business-day" }).valid, false);
  });
});

describe("decision lifecycle and portable request shapes", () => {
  const session: DecisionSession = {
    id: "session-1",
    decision: { id: "career-start", version: "1" },
    importance: { level: "major", reason: "Changes long-term income", comparisonMetricKeys: ["take-home", "net-worth"], requiresExplicitConfirmation: true },
    status: "open",
    sourceRunId: "run-1",
    sourceMonth: 0,
    inputs: {},
    versions: { engineVersion: "0.1.0", schemaVersion: 1, dataBundle: { id: "us-2026", version: "1" } },
    createdAt: "2026-07-21T12:00:00.000Z",
    updatedAt: "2026-07-21T12:00:00.000Z",
  };

  it("permits preview/compare/commit and makes terminal states terminal", () => {
    assert.equal(canTransitionDecisionSession("open", "preview"), true);
    assert.equal(canTransitionDecisionSession("open", "committed"), false);
    const preview = transitionDecisionSession(session, "preview", "2026-07-21T12:01:00.000Z");
    const compare = transitionDecisionSession({ ...preview, selectedOption: { id: "registered-nurse", version: "2026.1" } }, "compare", "2026-07-21T12:02:00.000Z");
    const committed = transitionDecisionSession(compare, "committed", "2026-07-21T12:03:00.000Z");
    assert.equal(committed.status, "committed");
    assert.throws(() => transitionDecisionSession(committed, "preview", "2026-07-21T12:04:00.000Z"), /Cannot transition/);
  });

  it("catalog queries and comparison previews round-trip through JSON", () => {
    const query: CatalogQuery = {
      catalog: { id: "occupations-us", version: "2026.1" },
      text: "nurse",
      filters: [{ field: "rotation", operator: "one-of", value: ["7/7", "10/4"] }],
      sort: [{ field: "typicalAnnualPayCents", direction: "desc" }],
      page: { limit: 24 },
    };
    const preview: DecisionComparisonPreview = {
      sessionId: "session-1",
      sourceRunId: "run-1",
      sourceMonth: 0,
      horizonMonths: 120,
      versions: session.versions,
      options: [{
        scenarioId: "scenario-1",
        option: { id: "registered-nurse", version: "2026.1" },
        eligible: true,
        issues: [],
        immediateCashRequiredCents: 0,
        metrics: [{ key: "take-home", unit: "cents", baselineValue: 0, projectedValue: 500000, delta: 500000 }],
        monthlyDeltas: [{ month: 1, values: { takeHomeCents: 500000 } }],
        explanations: [],
      }],
    };
    assert.deepEqual(JSON.parse(JSON.stringify({ query, preview })), { query, preview });
  });
});
