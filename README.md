# substrate-rng

> Deterministic RNG from substrate state.

## Usage

```typescript
import { rngFromState } from 'substrate-rng';

const rng = rngFromState('cell-witness-001');
rng.nextFloat();    // [0, 1)
rng.int(1, 100);    // integer
rng.pick(['a', 'b', 'c']);
rng.shuffle([1, 2, 3, 4, 5]);
rng.dice(20);
rng.weighted([{weight: 9, value: 'common'}, {weight: 1, value: 'rare'}]);
```

## Why deterministic

Every cell IS its witness log. Every witness log is a state. From that state, we get a seed. From that seed, we get reproducible randomness.

Two visitors in the same room get the same rolls. Two brews with the same topic get the same winners. The substrate IS reproducible.
