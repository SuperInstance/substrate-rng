/**
 * substrate-rng: deterministic RNG from substrate state
 * 
 * Every brew, every cell, every cross-link — they all have state.
 * From that state, this generates a deterministic RNG.
 * The RNG is reproducible across runs.
 */

export type RngSeed = string | number[];

// === HASH ===
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) & 0xffffffff;
  }
  return h >>> 0;
}

// === MULBERRY32 (small, fast) ===
function mulberry32(seed: number): () => number {
  return () => {
    seed = (seed + 0x6D2B79F5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// === XORSHIFT128+ (better distribution) ===
function xorshift128plus(seed: number): () => number {
  let s0 = seed || 1;
  let s1 = (seed * 16807) || 2;
  return () => {
    let x = s0;
    const y = s1;
    s0 = y;
    x ^= x << 23;
    x ^= x >>> 17;
    x ^= y ^ (y >>> 26);
    s1 = x;
    return (s0 + s1) >>> 0 / 4294967296;
  };
}

// === STATE → SEED ===
export function stateToSeed(state: RngSeed): number {
  if (typeof state === 'string') return hashString(state);
  if (Array.isArray(state)) {
    return state.reduce((s, x, i) => s + x * (i + 1), 0) >>> 0;
  }
  return state >>> 0;
}

// === RNG CLASS ===
export class Rng {
  private next: () => number;
  private seed: number;
  
  constructor(seed: RngSeed, algorithm: 'mulberry32' | 'xorshift128plus' = 'mulberry32') {
    this.seed = stateToSeed(seed);
    this.next = algorithm === 'mulberry32' 
      ? mulberry32(this.seed)
      : xorshift128plus(this.seed);
  }
  
  nextFloat(): number {
    return this.next();
  }
  
  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  
  pick<T>(arr: T[]): T {
    if (arr.length === 0) throw new Error('Cannot pick from empty array');
    return arr[Math.floor(this.next() * arr.length)];
  }
  
  shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  
  dice(sides: number): number {
    return this.int(1, sides);
  }
  
  weighted<T>(items: { weight: number; value: T }[]): T {
    if (items.length === 0) throw new Error('Cannot pick from empty items');
    const total = items.reduce((s, x) => s + x.weight, 0);
    let r = this.next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item.value;
    }
    return items[items.length - 1].value;
  }
  
  getSeed(): number {
    return this.seed;
  }
}

// === CONVENIENCE ===
export function rngFromState(state: RngSeed): Rng {
  return new Rng(state);
}
