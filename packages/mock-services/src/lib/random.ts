/**
 * Deterministic pseudo-random generation.
 *
 * Every synthetic record is produced from a seeded generator so the dataset is identical
 * across reloads, across server and client, and across test runs. That matters for three
 * reasons: assertions can target exact values, screenshots are stable, and there is no
 * hydration mismatch when the same seed renders on both sides.
 *
 * `Math.random()` is never used anywhere in the mock layer.
 */

/** Mulberry32: small, fast, and good enough for synthetic data. */
export function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    /** Uniform float in [0, 1). */
    next,
    /** Integer in [min, max] inclusive. */
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    /** Float in [min, max) rounded to `decimals`. */
    float: (min: number, max: number, decimals = 2) =>
      Number((next() * (max - min) + min).toFixed(decimals)),
    /** Random element. Throws on an empty array rather than returning undefined. */
    pick: <T>(items: readonly T[]): T => {
      if (items.length === 0) throw new Error('createRandom().pick: empty array');
      return items[Math.floor(next() * items.length)]!;
    },
    /** Weighted pick. Weights need not sum to 1. */
    weighted: <T>(entries: ReadonlyArray<{ value: T; weight: number }>): T => {
      const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
      let roll = next() * total;
      for (const entry of entries) {
        roll -= entry.weight;
        if (roll <= 0) return entry.value;
      }
      return entries[entries.length - 1]!.value;
    },
    /** True with probability `p`. */
    chance: (p: number) => next() < p,
    /** Shuffle a copy (Fisher–Yates). */
    shuffle: <T>(items: readonly T[]): T[] => {
      const copy = [...items];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(next() * (i + 1));
        [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      }
      return copy;
    },
    /** `count` distinct elements, or as many as exist. */
    sample: <T>(items: readonly T[], count: number): T[] => {
      if (count >= items.length) return [...items];
      return [...items].sort(() => next() - 0.5).slice(0, count);
    },
    /** Random ISO date within `daysBack` days of the reference date. */
    pastDate: (daysBack: number, reference: Date) => {
      const offset = next() * daysBack * 86_400_000;
      return new Date(reference.getTime() - offset);
    },
    /** Random ISO date within `daysForward` days ahead of the reference date. */
    futureDate: (daysForward: number, reference: Date) => {
      const offset = next() * daysForward * 86_400_000;
      return new Date(reference.getTime() + offset);
    },
  };
}

export type Random = ReturnType<typeof createRandom>;

/** ISO-8601 date (no time component). */
export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** ISO-8601 date-time. */
export function toDateTimeString(date: Date): string {
  return date.toISOString();
}

/** Add whole days to a date without mutating it. */
export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole days between two dates, rounded down. */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * A single fixed reference point for the whole dataset.
 *
 * Using a constant rather than `Date.now()` is what makes the dataset reproducible: a test
 * run in six months produces the same records as today. Relative dates (upcoming renewals,
 * overdue tasks) are computed from this instant, so the data always looks "current"
 * relative to itself.
 */
export const DATASET_EPOCH = new Date('2026-10-13T09:00:00.000Z');
