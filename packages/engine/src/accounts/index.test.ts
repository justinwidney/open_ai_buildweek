import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { retirementLimits2026 } from "../reference-data/retirement-limits.js";
import { accountTypeInfo, allAccountTypes, annualContributionLimitCents } from "./info.js";
import { classifyWithdrawalTax } from "./withdrawal.js";
import type { AccountType } from "./types.js";

describe("accounts/info", () => {
  it("maps every account type to a treatment and never throws", () => {
    for (const info of allAccountTypes()) {
      assert.ok(info.label.length > 0);
      assert.equal(accountTypeInfo(info.accountType), info);
    }
  });

  it("401(k) limit adds the age-50 catch-up and the 60–63 super catch-up (which replaces it)", () => {
    const base = annualContributionLimitCents("traditional401k", 40, retirementLimits2026)!;
    const at50 = annualContributionLimitCents("traditional401k", 55, retirementLimits2026)!;
    const at61 = annualContributionLimitCents("roth401k", 61, retirementLimits2026)!;
    assert.equal(base, retirementLimits2026.employeeDeferralLimitCents);
    assert.equal(at50, retirementLimits2026.employeeDeferralLimitCents + retirementLimits2026.catchUp50PlusCents);
    assert.equal(at61, retirementLimits2026.employeeDeferralLimitCents + retirementLimits2026.superCatchUp60to63Cents);
    assert.ok(at61 > at50, "the super catch-up is larger than the standard one");
  });

  it("IRA limit adds its own catch-up at 50, and unmodeled types return null", () => {
    assert.equal(annualContributionLimitCents("rothIra", 40, retirementLimits2026), retirementLimits2026.iraLimitCents);
    assert.equal(annualContributionLimitCents("traditionalIra", 50, retirementLimits2026), retirementLimits2026.iraLimitCents + retirementLimits2026.iraCatchUp50PlusCents);
    for (const t of ["cash", "taxableBrokerage", "hsa", "education529"] as AccountType[]) {
      assert.equal(annualContributionLimitCents(t, 45, retirementLimits2026), null);
    }
  });
});

describe("accounts/classifyWithdrawalTax", () => {
  const balanceCents = cents(100_000);
  const costBasisCents = cents(60_000); // 40% unrealized gain

  it("decomposition always sums to the gross withdrawal", () => {
    for (const t of allAccountTypes()) {
      const r = classifyWithdrawalTax({ accountType: t.accountType, requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 45, qualifiedExpense: false });
      assert.equal(r.taxFreeCents + r.ordinaryIncomeCents + r.capitalGainsCents, r.grossAmountCents, `${t.accountType} parts must sum to gross`);
    }
  });

  it("caps the withdrawal at the balance", () => {
    const r = classifyWithdrawalTax({ accountType: "cash", requestedCents: cents(500_000), balanceCents, costBasisCents, ageYears: 45 });
    assert.equal(r.grossAmountCents, balanceCents);
  });

  it("taxable account realizes the gain portion as capital gains, basis returns tax-free", () => {
    const r = classifyWithdrawalTax({ accountType: "taxableBrokerage", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 45 });
    assert.equal(r.capitalGainsCents, cents(4_000)); // 40% of 10k
    assert.equal(r.taxFreeCents, cents(6_000));
    assert.equal(r.ordinaryIncomeCents, 0);
    assert.equal(r.penaltyCents, 0);
  });

  it("early traditional-401(k) withdrawal is all ordinary income plus a 10% penalty; no penalty at 60", () => {
    const early = classifyWithdrawalTax({ accountType: "traditional401k", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 45 });
    assert.equal(early.ordinaryIncomeCents, cents(10_000));
    assert.equal(early.penaltyCents, cents(1_000));
    const later = classifyWithdrawalTax({ accountType: "traditional401k", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 60 });
    assert.equal(later.penaltyCents, 0);
  });

  it("Roth contributions come out tax- and penalty-free before earnings", () => {
    // basis 60k, so a 10k early withdrawal is entirely return of contributions.
    const early = classifyWithdrawalTax({ accountType: "rothIra", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 40 });
    assert.equal(early.taxFreeCents, cents(10_000));
    assert.equal(early.ordinaryIncomeCents, 0);
    assert.equal(early.penaltyCents, 0);
    // A withdrawal larger than basis dips into earnings, which are taxed + penalized before 59.5.
    const intoEarnings = classifyWithdrawalTax({ accountType: "rothIra", requestedCents: cents(70_000), balanceCents, costBasisCents, ageYears: 40 });
    assert.equal(intoEarnings.taxFreeCents, cents(60_000));
    assert.equal(intoEarnings.ordinaryIncomeCents, cents(10_000));
    assert.equal(intoEarnings.penaltyCents, cents(1_000));
    // After 59.5 the whole thing is qualified and tax-free.
    const qualified = classifyWithdrawalTax({ accountType: "rothIra", requestedCents: cents(70_000), balanceCents, costBasisCents, ageYears: 65 });
    assert.equal(qualified.taxFreeCents, cents(70_000));
  });

  it("HSA is tax-free for qualified medical, ordinary income + 20% penalty otherwise (before 65)", () => {
    const medical = classifyWithdrawalTax({ accountType: "hsa", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 40, qualifiedExpense: true });
    assert.equal(medical.taxFreeCents, cents(10_000));
    const nonMedical = classifyWithdrawalTax({ accountType: "hsa", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 40, qualifiedExpense: false });
    assert.equal(nonMedical.ordinaryIncomeCents, cents(10_000));
    assert.equal(nonMedical.penaltyCents, cents(2_000));
  });

  it("529 non-qualified withdrawal taxes/penalizes only the earnings portion", () => {
    const r = classifyWithdrawalTax({ accountType: "education529", requestedCents: cents(10_000), balanceCents, costBasisCents, ageYears: 30, qualifiedExpense: false });
    assert.equal(r.taxFreeCents, cents(6_000));
    assert.equal(r.ordinaryIncomeCents, cents(4_000));
    assert.equal(r.penaltyCents, cents(400)); // 10% of the 4k earnings
  });
});
