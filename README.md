# substrate-rng

Seedable Random Number Generators. Deterministic, byte-exact across platforms.

Three RNGs:

```typescript
import { Xoshiro256, PCG64, SplitMix64, rng, stringToSeed,
  UniformInt, Bernoulli, Exponential, Poisson, latinHypercube } from 'substrate-rng';

// Xoshiro256** — default. Fast, high-quality, 256-bit state. Period 2^256 - 1.
const r = new Xoshiro256(42n);
r.next();              // float in [0, 1)
r.nextInt(100);        // int in [0, 100)
r.nextRange(5, 15);    // int in [5, 15]
r.nextGaussian(0, 1);  // standard normal
r.shuffle(arr);        // Fisher-Yates in-place
r.serialize();         // save state for replay
Xoshiro256.deserialize(state);

// Seed from anything
new Xoshiro256('cell-witness');  // string → 64-bit seed via FNV-1a
new Xoshiro256(42n);             // raw integer seed
new Xoshiro256(timeSeed());      // from Date.now() + hrtime

// Distributions
new UniformInt(0, 100, r).sample();
new Bernoulli(0.3, r).sample();
new Exponential(2.0, r).sample();
new Poisson(5, r).sample();

// Quasi-random
const samples = latinHypercube(100, 4, r);
```

## The math

### Xoshiro256** (Blackman & Vigna 2018)

State: four 64-bit words `(s0, s1, s2, s3)`. Period 2^256 - 1.

```
output = rotl((s1 * 5) rotl 7) * 9
t = s1 << 17
s2 ^= s0; s3 ^= s1; s1 ^= s2; s0 ^= s3; s2 ^= t; s3 = rotl(s3, 45)
```

Multiplier `5 = 0b101` comes from a 5-cycle LFSR. Rotation amounts (7, 45) are tuned for bit diffusion. The `**` suffix means the output function is a "scrambler" — multiply by 9 to break linear structure.

**Passes BigCrush** (TestU01, the standard rigorous test suite). No known failures. Used in Julia, Nim, V language standard libraries.

### PCG64 (O'Neill 2014)

State: 128-bit `(state, inc)`. Period 2^128.

```
state = state * 6364136223846793005 + inc  (mod 2^64)
XSH-RR output: randomize then permute bits
```

XSH-RR = "XorShift High bits, Random Rotate" — outputs high bits of state, then rotates by a random amount derived from the stream parameter. Permutation makes the output pass strong statistical tests.

Period 2^128 means at 10^12 outputs/second it would take ~10^19 years to repeat.

### SplitMix64 (Vigna 2014)

Minimal 64-bit RNG. Used as a building block to seed Xoshiro256 from a single u64:

```
state += 0x9e3779b97f4a7c15   // golden ratio constant
state = mix(state)             // bijective 64-bit transform
```

The golden ratio constant comes from a Knuth-style uniform sequence design.

### Distributions

| Distribution | Algorithm |
|--------------|-----------|
| UniformInt | Inverse CDF: `floor(rng() * (hi - lo + 1)) + lo` |
| Bernoulli | Uniform comparison: `rng() < p` |
| Gaussian | Box-Muller: `√(-2 ln u1) · cos(2π u2)`, then shift+scale |
| Exponential | Inverse CDF: `-ln(1 - rng()) / λ` |
| Poisson | Knuth for λ < 30, normal approximation otherwise |
| Latin Hypercube | One permutation per dimension, jitter within cells |

### Why seedable + deterministic?

Quilt cells need to be reproducible. Every cell's randomness is derived from its state hash. So we need an RNG that:
- Same seed → same sequence (byte-exact)
- Fast (called billions of times in a hash chain)
- High quality (no statistical bias)
- Small state (64-256 bits)

Xoshiro256** fits all four. PCG64 is the alternative when you want statistical excellence over speed.

## Why FNV-1a for string seeds?

`stringToSeed` is a 64-bit hash function. FNV-1a is non-cryptographic, deterministic, and fast. The seed becomes a single u64 that drives Xoshiro256** via SplitMix64.

Don't use FNV-1a for cryptographic seeds. Use `crypto.getRandomValues()` (32 bytes) + import as BigInt.

## Quilt receipts: receipted randomness

`src/ledger.ts` books every draw from a seedable RNG as a hash-chained
receipt in the fleet's 4quilt family envelope — the same canonical JSON
+ fnv1a-32 recipe as the Python family (laya4quilt, tagseq2tagseq4quilt,
gpu_bpe4quilt, jev-ultrafast-quilt). A draw is a deterministic
consequence of (seed, algorithm, state, draw_index); the ledger makes
that consequence auditable after the fact:

```typescript
import { Xoshiro256 } from "substrate-rng";
import { DrawLedger } from "substrate-rng/ledger";

const rng = new Xoshiro256("breed-tournament");
const ledger = new DrawLedger("substrate-rng");
ledger.bind("Xoshiro256**", "breed-tournament", rng.serialize());
const before = rng.serialize();
const pick = rng.nextRange(0, 100);     // the decision
const after = rng.serialize();
ledger.draw(0, "uniform_int", { lo: 0, hi: 100 }, pick, before, after);
const [ok, bad, why] = ledger.verify(); // => [true, null, null]
```

Cross-language: chains booked here verify with the Python family
verifier unmodified, and Python-booked fixtures verify here
(`src/tests/ledger.test.ts` freezes real family rows as fixtures).
Row shape, canonical-JSON contract, and the field-convention drift
notes live in the module header of `src/ledger.ts`.

Refusals are named rows, not silent gaps: state divergence after
`deserialize()` books `REFUSED` with the reason — replay divergence is
a lie about determinism, and the ledger says so in-band.

## License

MIT.
