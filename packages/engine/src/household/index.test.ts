import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { ageYearsAt, childTaxCreditCents, dependentsUnderAge, householdContextAt, primaryPerson, qualifyingChildrenForCtc } from "./compute.js";
import type { Household } from "./types.js";

const household: Household = {
  filingStatus: "marriedFilingJointly",
  members: [
    { id: "you", label: "You", birthMonth: -360, role: "primary" }, // 30 at month 0
    { id: "spouse", label: "Spouse", birthMonth: -336, role: "spouse" }, // 28 at month 0
  ],
  dependents: [
    { id: "kid1", label: "Kid 1", birthMonth: -60, kind: "child" }, // 5 at month 0
    { id: "kid2", label: "Kid 2", birthMonth: 0, kind: "child" }, // born at month 0
    { id: "parent", label: "Grandparent", birthMonth: -840, kind: "other" }, // 70 at month 0
  ],
};

describe("household/compute", () => {
  it("ages advance as the run ticks forward", () => {
    assert.equal(ageYearsAt(-360, 0), 30);
    assert.equal(ageYearsAt(-360, 12), 31);
    assert.equal(ageYearsAt(-360, 11), 30);
    assert.equal(primaryPerson(household).id, "you");
  });

  it("counts dependents under an age threshold", () => {
    assert.equal(dependentsUnderAge(household, 0, 13).length, 2); // both kids under 13; grandparent excluded
    assert.equal(dependentsUnderAge(household, 0, 6).length, 2); // kid1 is 5, kid2 is 0
    // 6 years on: kid1 is 11, kid2 is 6 → only kid2 is under 7.
    assert.equal(dependentsUnderAge(household, 12 * 6, 7).length, 1);
  });

  it("child tax credit counts only children under 17, and ages them out", () => {
    assert.equal(qualifyingChildrenForCtc(household, 0).length, 2);
    assert.equal(childTaxCreditCents(household, 0), cents(4_000)); // 2 kids × $2,000
    // 17 years later kid1 (was 5) is 22 → out; kid2 (was 0) is 17 → out (must be UNDER 17).
    assert.equal(childTaxCreditCents(household, 17 * 12), cents(0));
    // 12 years later kid1 is 17 → out, kid2 is 12 → still qualifies.
    assert.equal(childTaxCreditCents(household, 12 * 12), cents(2_000));
  });

  it("derives a full household context for a month", () => {
    const ctx = householdContextAt(household, 0);
    assert.equal(ctx.filingStatus, "marriedFilingJointly");
    assert.equal(ctx.primaryAgeYears, 30);
    assert.equal(ctx.spouseAgeYears, 28);
    assert.equal(ctx.dependentCount, 3);
    assert.equal(ctx.childrenUnder13, 2);
    assert.equal(ctx.qualifyingChildrenForCtc, 2);
    assert.equal(ctx.estimatedAnnualChildTaxCreditCents, cents(4_000));
  });
});
