# quilt — fleet face package

`quilt` is the fleet-facing face of this repository. It wraps the DiceBear
engine in a tiny, receipt-emitting CLI so any agent in the fleet can turn a
stable id into a stable pixel-identity.

## PATCH manifest

```yaml
kind: transduce
input:
  seed: string        # required; the agent id / stable seed
  style: string       # required; a built-in DiceBear style name
  options: {}         # reserved; empty and frozen in v1 (see "Determinism")
output:
  svg: bytes          # the rendered SVG, written to --out or stdout
  receipt: json       # canonical receipt on stdout when --json is passed
interface: [cli, programmatic]
deterministic: true
seedable: true
receipt_verb: rendered
```

## Why the fleet wants it

Agents need a stable visual identity that survives restarts, migrations, and
process boundaries. `quilt-avatar` gives every agent one: feed it the
agent-id as `--seed`, pick a `--style`, and the same string always renders the
same SVG bytes — on this box, on another box, in another process, tomorrow.
You store the **string** (the agent id) and derive the **bytes** on demand;
the receipt's `sha256` is the proof-of-identity, so a face can be verified
without shipping an image or trusting a timestamp. No upload, no external
state, no drift.

## Determinism

`(seed, style)` alone determines every byte of the output. Render options are
fixed to the empty object in v1 — there is deliberately no `--size`/`--options`
flag — because any option that changes the bytes would need to enter the
receipt for identity to stay sound, and the receipt schema is intentionally
minimal. If a future version adds options, the receipt grows an `options` key
at the same time.

The receipt carries **no timestamp**. Byte-identity is the identity: two runs
of the same `(seed, style)` produce the same receipt *and* the same SVG, so the
receipt can be compared with `==`.

## Interface

CLI (this directory):

```sh
node quilt/quilt-avatar.mjs --seed agent-0001 --style initials --out face.svg --json
```

Programmatic (import the engine directly, same determinism):

```js
import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/initials.json' with { type: 'json' };

const avatar = new Avatar(new Style(definition), { seed: 'agent-0001' });
avatar.toString(); // SVG string — identical to the CLI's bytes
```

See `quilt/README.md` for the deeper architecture, A2A usage patterns, and
receipt-anchoring notes, and `quilt/SELFTEST-2026-10-02.md` for the byte-identity
proof.
