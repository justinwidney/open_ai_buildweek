import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addC,
  allocate,
  applyRate,
  assertSafe,
  cents,
  clampNonNegative,
  roundHalfEven,
  subC,
  toDollars,
} from "./index.js";

describe("money", () => {
  it("converts dollars to exact cents", () => {
    assert.equal(cents(19.99), 1999);
    assert.equal(cents(0.1 + 0.2), 30); // classic float trap, must land on exactly 30 cents
  });

  it("round-half-even avoids systematic upward bias", () => {
    assert.equal(roundHalfEven(0.5), 0);
    assert.equal(roundHalfEven(1.5), 2);
    assert.equal(roundHalfEven(2.5), 2);
    assert.equal(roundHalfEven(-0.5), 0);
  });

  it("addC/subC stay exact and reject unsafe results", () => {
    assert.equal(addC(cents(10), cents(5), cents(2.5)), cents(17.5));
    assert.equal(subC(cents(10), cents(3)), cents(7));
    assert.throws(() => assertSafe(1.5, "test"), RangeError);
  });

  it("applyRate rounds to the nearest cent", () => {
    assert.equal(applyRate(10_000, 0.06 / 12), 50); // $100 at 6%/yr monthly
  });

  it("clampNonNegative floors at zero", () => {
    assert.equal(clampNonNegative(-500), 0);
    assert.equal(clampNonNegative(500), 500);
  });

  it("allocate splits proportionally and sums exactly to the total", () => {
    const shares = allocate(cents(100), [1, 1, 1]);
    assert.equal(shares.reduce((a, b) => a + b, 0), cents(100));
    assert.equal(shares.length, 3);
    // 10000 cents / 3 = 3333.33... repeating for every equal-weight share; the single leftover
    // cent goes to exactly one of them so the parts still sum to exactly 10000.
    assert.deepEqual(
      [...shares].sort((a, b) => a - b),
      [3333, 3333, 3334],
    );
  });

  it("allocate handles an all-zero-weight edge case without dividing by zero", () => {
    const shares = allocate(cents(50), [0, 0]);
    assert.equal(shares.reduce((a, b) => a + b, 0), cents(50));
  });

  it("allocate rejects a non-zero total with no weights", () => {
    assert.throws(() => allocate(cents(10), []), RangeError);
  });

  it("toDollars is display-only and round-trips typical amounts", () => {
    assert.equal(toDollars(cents(42.5)), 42.5);
  });
});
