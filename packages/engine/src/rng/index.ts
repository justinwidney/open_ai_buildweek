/**
 * Seeded, deterministic randomness. Nothing in this package may call
 * `Math.random()` — every stochastic computation (Monte Carlo sampling, a
 * random historical-backtest start date) takes a `RandomSource` explicitly,
 * so a run is reproducible from its seed and resumable/parallelizable
 * without re-deriving prior draws.
 */
export interface RandomSource {
  /** Next float in [0, 1). */
  next(): number;
  /** Standard-normal (mean 0, stddev 1) sample, for lognormal/normal return models. */
  nextGaussian(): number;
}

/** cyrb53 string hash — fast, decent distribution, not cryptographic (determinism, not security, is the goal). */
export function seedFromString(input: string): number {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/** mulberry32: tiny, fast, well-distributed-enough 32-bit PRNG — sufficient for simulation, not cryptography. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRandomSource(seed: number | string): RandomSource {
  const numericSeed = typeof seed === "string" ? seedFromString(seed) : seed;
  const next = mulberry32(numericSeed);
  let spareGaussian: number | null = null;

  return {
    next,
    nextGaussian(): number {
      if (spareGaussian !== null) {
        const value = spareGaussian;
        spareGaussian = null;
        return value;
      }
      // Box-Muller transform, generating a pair and caching the second for the following call.
      let u1 = 0;
      while (u1 === 0) u1 = next(); // avoid log(0)
      const u2 = next();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const angle = 2 * Math.PI * u2;
      spareGaussian = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    },
  };
}
