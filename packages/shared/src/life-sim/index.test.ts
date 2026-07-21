import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paymentsPerNormalYear, validateWorkSchedule, type CatalogQuery } from "./index.js";

describe("@control-ai/shared/life-sim facade", () => {
  it("re-exports engine-owned portable contracts", () => {
    const query: CatalogQuery = {
      catalog: { id: "careers", version: "1" },
      filters: [],
      sort: [],
      page: { limit: 10 },
    };
    assert.equal(query.catalog.id, "careers");
    assert.equal(paymentsPerNormalYear("biweekly"), 26);
    assert.equal(validateWorkSchedule({ hoursPerShift: 8, shift: "day", pattern: { kind: "weekly", daysPerWeek: 5 } }).valid, true);
  });
});
