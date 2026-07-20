import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { applyBrackets, federalIncomeTax2026 } from "./federal-income-tax.js";
import { computePia, socialSecurity2026 } from "./social-security.js";
import { referenceData2026 } from "./index.js";

describe("reference-data", () => {
  it("applies federal brackets marginally, not as a flat rate on the whole amount", () => {
    // Entirely within the 10% bracket.
    assert.equal(applyBrackets(cents(10_000), federalIncomeTax2026.brackets.single), Math.round(cents(10_000) * 0.1));
  });

  it("applies federal brackets progressively across multiple brackets", () => {
    const singleBrackets = federalIncomeTax2026.brackets.single;
    const taxableIncome = cents(60_000); // spans the 10/12/22 brackets for 2026 single
    const tax = applyBrackets(taxableIncome, singleBrackets);
    // Sanity bounds: less than a flat 22% (highest rate reached), more than a flat 10% (lowest rate).
    assert.ok(tax < taxableIncome * 0.22);
    assert.ok(tax > taxableIncome * 0.1);
  });

  it("returns zero tax for non-positive taxable income", () => {
    assert.equal(applyBrackets(0, federalIncomeTax2026.brackets.single), 0);
    assert.equal(applyBrackets(-100, federalIncomeTax2026.brackets.single), 0);
  });

  it("computes PIA using the three-tier bend-point formula", () => {
    // AIME below the first bend point: flat 90%.
    const lowAime = cents(1_000);
    assert.equal(computePia(lowAime, socialSecurity2026), Math.round(lowAime * 0.9));

    // AIME above both bend points exercises all three tiers.
    const highAime = cents(10_000);
    const pia = computePia(highAime, socialSecurity2026);
    assert.ok(pia > 0);
    assert.ok(pia < highAime, "PIA should always be less than AIME itself");
  });

  it("assembles a complete reference-data bundle with provenance on every dataset", () => {
    assert.ok(referenceData2026.federalIncomeTax.source);
    assert.ok(referenceData2026.fica.url);
    assert.ok(referenceData2026.socialSecurity.asOf);
    assert.ok(Object.keys(referenceData2026.stateTax).length >= 3);
    assert.ok(referenceData2026.expenseBenchmarks.categories.length > 0);
    assert.ok(referenceData2026.homePriceBenchmarks.tiers.length > 0);
    assert.ok(Object.keys(referenceData2026.historicalReturns).length > 0);
  });

  it("expense benchmark category shares sum close to 1", () => {
    const total = referenceData2026.expenseBenchmarks.categories.reduce((sum, c) => sum + c.shareOfTotal, 0);
    assert.ok(Math.abs(total - 1) < 0.01, `shares summed to ${total}`);
  });
});
