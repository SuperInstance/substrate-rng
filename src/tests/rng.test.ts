import { test } from 'node:test';
import assert from 'node:assert';
import { Rng, rngFromState, stateToSeed } from '../index.ts';

test('deterministic across runs', () => {
  const r1 = rngFromState('cell-witness');
  const r2 = rngFromState('cell-witness');
  assert.strictEqual(r1.nextFloat(), r2.nextFloat());
});

test('different states produce different sequences', () => {
  const a = rngFromState('state-a').nextFloat();
  const b = rngFromState('state-b').nextFloat();
  assert.notStrictEqual(a, b);
});

test('int returns integer in range', () => {
  const r = rngFromState('test');
  for (let i = 0; i < 100; i++) {
    const v = r.int(5, 10);
    assert.ok(v >= 5 && v <= 10);
    assert.ok(Number.isInteger(v));
  }
});

test('pick returns element from array', () => {
  const r = rngFromState('pick-test');
  const arr = ['a', 'b', 'c'];
  for (let i = 0; i < 50; i++) {
    assert.ok(arr.includes(r.pick(arr)));
  }
});

test('shuffle preserves elements', () => {
  const r = rngFromState('shuffle-test');
  const arr = [1, 2, 3, 4, 5];
  const shuffled = r.shuffle(arr);
  assert.strictEqual(shuffled.length, arr.length);
  assert.deepStrictEqual([...shuffled].sort(), [...arr].sort());
});

test('dice returns 1 to sides', () => {
  const r = rngFromState('dice-test');
  for (let i = 0; i < 100; i++) {
    const v = r.dice(6);
    assert.ok(v >= 1 && v <= 6);
  }
});

test('weighted respects weights', () => {
  const r = rngFromState('weighted-test');
  const counts: Record<string, number> = { a: 0, b: 0 };
  for (let i = 0; i < 1000; i++) {
    const v = r.weighted([{ weight: 9, value: 'a' }, { weight: 1, value: 'b' }]);
    counts[v]++;
  }
  assert.ok(counts.a > counts.b * 5);  // a should be ~9x more
});

test('stateToSeed is deterministic', () => {
  assert.strictEqual(stateToSeed('hello'), stateToSeed('hello'));
  assert.notStrictEqual(stateToSeed('hello'), stateToSeed('world'));
});
