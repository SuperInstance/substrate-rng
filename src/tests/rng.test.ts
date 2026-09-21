import { test } from 'node:test';
import assert from 'node:assert';
import { rng, stringToSeed } from '../index.ts';

test('deterministic across runs', () => {
  const r1 = rng('cell-witness');
  const r2 = rng('cell-witness');
  assert.strictEqual(r1.next(), r2.next());
});

test('different states produce different sequences', () => {
  const a = rng('state-a').next();
  const b = rng('state-b').next();
  assert.notStrictEqual(a, b);
});

test('nextRange returns number in range', () => {
  const r = rng('test');
  for (let i = 0; i < 100; i++) {
    const v = r.nextRange(5, 10);
    assert.ok(v >= 5 && v <= 10);
  }
});

test('stringToSeed is deterministic', () => {
  assert.strictEqual(stringToSeed('hello'), stringToSeed('hello'));
  assert.notStrictEqual(stringToSeed('hello'), stringToSeed('world'));
});

test('rng.next() returns [0,1)', () => {
  const r = rng('range-test');
  for (let i = 0; i < 100; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `expected [0,1), got ${v}`);
  }
});
