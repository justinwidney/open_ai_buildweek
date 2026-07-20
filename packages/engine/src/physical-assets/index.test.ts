import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { cents } from "../money/index.js";
import { computeEquityCents, currentPhysicalAssetValueCents } from "./index.js";
import type { PhysicalAssetConfig } from "./index.js";

const house: PhysicalAssetConfig = {
  id: "house",
  label: "Home",
  purchasePriceCents: cents(400_000),
  purchaseMonth: 0,
  annualValueChangeRate: 0.03,
  monthlyUpkeepCents: cents(300),
};

const car: PhysicalAssetConfig = {
  id: "car",
  label: "Car",
  purchasePriceCents: cents(30_000),
  purchaseMonth: 0,
  annualValueChangeRate: -0.15,
  monthlyUpkeepCents: cents(100),
};

describe("physical-assets", () => {
  it("a house appreciates over time", () => {
    const atPurchase = currentPhysicalAssetValueCents(house, 0);
    const afterFiveYears = currentPhysicalAssetValueCents(house, 60);
    assert.ok(afterFiveYears > atPurchase);
    assert.ok(Math.abs(afterFiveYears / atPurchase - Math.pow(1.03, 5)) < 0.001);
  });

  it("a car depreciates over time", () => {
    const atPurchase = currentPhysicalAssetValueCents(car, 0);
    const afterThreeYears = currentPhysicalAssetValueCents(car, 36);
    assert.ok(afterThreeYears < atPurchase);
  });

  it("equity is current value minus any linked debt balance", () => {
    const value = currentPhysicalAssetValueCents(house, 24);
    assert.equal(computeEquityCents(value, cents(350_000)), value - cents(350_000));
    assert.equal(computeEquityCents(value), value); // no linked debt = full value is equity
  });
});
