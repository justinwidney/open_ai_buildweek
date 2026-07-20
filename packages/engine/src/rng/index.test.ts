import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRandomSource, seedFromString } from "./index.js";

describe("rng", () => {
  it("is deterministic for a given numeric seed", () => {
    const a = createRandomSource(42);
    const b = createRandomSource(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    assert.deepEqual(seqA, seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = createRandomSource(1);
    const b = createRandomSource(2);
    assert.notEqual(a.next(), b.next());
  });

  it("stays within [0, 1)", () => {
    const rng = createRandomSource("test-seed");
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      assert.ok(value >= 0 && value < 1, `value ${value} out of range`);
    }
  });

  it("string seeds are deterministic via seedFromString", () => {
    const a = createRandomSource("run-abc");
    const b = createRandomSource(seedFromString("run-abc"));
    assert.equal(a.next(), b.next());
  });

  it("nextGaussian produces a roughly standard-normal distribution over many samples", () => {
    const rng = createRandomSource("gaussian-check");
    const samples = Array.from({ length: 5000 }, () => rng.nextGaussian());
    const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
    const variance = samples.reduce((s, v) => s + (v - mean) ** 2, 0) / samples.length;
    assert.ok(Math.abs(mean) < 0.1, `mean ${mean} too far from 0`);
    assert.ok(Math.abs(variance - 1) < 0.15, `variance ${variance} too far from 1`);
  });
});
