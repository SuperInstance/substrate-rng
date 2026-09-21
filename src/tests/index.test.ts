/**
 * Tests for substrate-rng
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Xoshiro256, PCG64, SplitMix64, rng, stringToSeed, timeSeed,
  UniformInt, Bernoulli, Exponential, Poisson, latinHypercube } from '../index.ts';

test('Xoshiro256: same seed → same sequence', () => {
  const a = new Xoshiro256(42n);
  const b = new Xoshiro256(42n);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.nextU64(), b.nextU64());
  }
});

test('Xoshiro256: different seeds → different sequences', () => {
  const a = new Xoshiro256(1n);
  const b = new Xoshiro256(2n);
  let sameCount = 0;
  for (let i = 0; i < 100; i++) {
    if (a.nextU64() === b.nextU64()) sameCount++;
  }
  assert.equal(sameCount, 0);
});

test('Xoshiro256: string seed is deterministic', () => {
  const a = new Xoshiro256('cell-witness');
  const b = new Xoshiro256('cell-witness');
  assert.equal(a.nextU64(), b.nextU64());
});

test('Xoshiro256: different string seeds → different sequences', () => {
  const a = new Xoshiro256('cell-witness');
  const b = new Xoshiro256('cell-bind');
  assert.notEqual(a.nextU64(), b.nextU64());
});

test('Xoshiro256: next() is in [0, 1)', () => {
  const r = new Xoshiro256(42n);
  for (let i = 0; i < 10000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `out of range: ${v}`);
  }
});

test('Xoshiro256: next() is approximately uniform (chi-square)', () => {
  const r = new Xoshiro256(42n);
  const N = 100000;
  const buckets = 100;
  const counts = new Array(buckets).fill(0);
  for (let i = 0; i < N; i++) {
    counts[Math.floor(r.next() * buckets)]++;
  }
  const expected = N / buckets;
  let chiSq = 0;
  for (const c of counts) {
    chiSq += (c - expected) ** 2 / expected;
  }
  // chi-square critical value at df=99, p=0.001 is ~149
  assert.ok(chiSq < 200, `chi-square too high: ${chiSq}`);
});

test('Xoshiro256: nextInt(n) is in [0, n)', () => {
  const r = new Xoshiro256(42n);
  for (let i = 0; i < 10000; i++) {
    const v = r.nextInt(10);
    assert.ok(v >= 0 && v < 10);
  }
});

test('Xoshiro256: nextRange is in range', () => {
  const r = new Xoshiro256(42n);
  for (let i = 0; i < 1000; i++) {
    const v = r.nextRange(5, 15);
    assert.ok(v >= 5 && v <= 15);
  }
});

test('Xoshiro256: sample returns k unique indices in [0, n)', () => {
  const r = new Xoshiro256(42n);
  const s = r.sample(20, 5);
  assert.equal(s.length, 5);
  assert.equal(new Set(s).size, 5);
  for (const x of s) assert.ok(x >= 0 && x < 20);
});

test('Xoshiro256: nextGaussian has correct mean and stddev', () => {
  const r = new Xoshiro256(42n);
  const N = 100000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < N; i++) {
    const v = r.nextGaussian(0, 1);
    sum += v;
    sumSq += v * v;
  }
  const mean = sum / N;
  const variance = sumSq / N - mean * mean;
  assert.ok(Math.abs(mean) < 0.05, `mean too far from 0: ${mean}`);
  assert.ok(Math.abs(variance - 1) < 0.1, `variance too far from 1: ${variance}`);
});

test('Xoshiro256: serialize/deserialize roundtrip', () => {
  const a = new Xoshiro256(42n);
  for (let i = 0; i < 100; i++) a.nextU64();
  const state = a.serialize();
  const b = Xoshiro256.deserialize(state);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.nextU64(), b.nextU64());
  }
});

test('Xoshiro256: shuffle is a permutation', () => {
  const r = new Xoshiro256(42n);
  const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const shuffled = r.shuffle([...arr]);
  assert.deepEqual([...shuffled].sort((a, b) => a - b), arr);
  // With high probability, the shuffled array is not the original
  let diff = 0;
  for (let i = 0; i < arr.length; i++) if (arr[i] !== shuffled[i]) diff++;
  assert.ok(diff > 0, 'shuffle did nothing');
});

test('PCG64: same seed → same sequence', () => {
  const a = new PCG64(42n);
  const b = new PCG64(42n);
  // Run them in lockstep
  for (let i = 0; i < 100; i++) a.next();
  for (let i = 0; i < 100; i++) b.next();
  assert.equal(a.next(), b.next());
});

test('SplitMix64: same seed → same sequence', () => {
  const a = new SplitMix64(42n);
  const b = new SplitMix64(42n);
  for (let i = 0; i < 100; i++) {
    assert.equal(a.nextU64(), b.nextU64());
  }
});

test('stringToSeed: deterministic', () => {
  assert.equal(stringToSeed('hello'), stringToSeed('hello'));
  assert.notEqual(stringToSeed('hello'), stringToSeed('world'));
});

test('UniformInt: range', () => {
  const r = new Xoshiro256(42n);
  const d = new UniformInt(10, 20, r);
  for (let i = 0; i < 1000; i++) {
    const v = d.sample();
    assert.ok(v >= 10 && v <= 20);
  }
});

test('Bernoulli: probability approximately p', () => {
  const r = new Xoshiro256(42n);
  const d = new Bernoulli(0.3, r);
  let trueCount = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) if (d.sample()) trueCount++;
  const p = trueCount / N;
  assert.ok(Math.abs(p - 0.3) < 0.02, `p too far from 0.3: ${p}`);
});

test('Exponential: mean ≈ 1/λ', () => {
  const r = new Xoshiro256(42n);
  const lambda = 2;
  const d = new Exponential(lambda, r);
  let sum = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) sum += d.sample();
  const mean = sum / N;
  const expected = 1 / lambda;
  assert.ok(Math.abs(mean - expected) < 0.05, `mean too far from ${expected}: ${mean}`);
});

test('Poisson: mean ≈ λ', () => {
  const r = new Xoshiro256(42n);
  const lambda = 5;
  const d = new Poisson(lambda, r);
  let sum = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) sum += d.sample();
  const mean = sum / N;
  assert.ok(Math.abs(mean - lambda) < 0.5, `mean too far from ${lambda}: ${mean}`);
});

test('latinHypercube: covers [0, 1) without gaps', () => {
  const r = new Xoshiro256(42n);
  const n = 100;
  const dim = 2;
  const samples = latinHypercube(n, dim, r);
  assert.equal(samples.length, n);
  for (const s of samples) {
    assert.equal(s.length, dim);
    for (const v of s) assert.ok(v >= 0 && v < 1);
  }
  // Check coverage: in each dimension, divide [0, 1) into n bins
  for (let d = 0; d < dim; d++) {
    const bins = new Array(n).fill(0);
    for (const s of samples) bins[Math.min(n - 1, Math.floor(s[d] * n))]++;
    for (const c of bins) assert.ok(c >= 1, `bin has no sample in dim ${d}`);
  }
});

test('rng() default factory works', () => {
  const r = rng();
  for (let i = 0; i < 100; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1);
  }
});

test('rng(seed) is deterministic', () => {
  const a = rng('test-seed');
  const b = rng('test-seed');
  for (let i = 0; i < 10; i++) assert.equal(a.next(), b.next());
});
