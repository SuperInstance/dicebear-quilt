<h1><img src="https://www.dicebear.com/logo-readme.svg" width="28" /> dicebear-quilt</h1>

**A fork of [dicebear/dicebear](https://github.com/dicebear/dicebear) that adds
`quilt/` — a deterministic, receipt-emitting face generator for the fleet.**

Upstream is the DiceBear avatar library, MIT licensed (© Florian Körner). This
fork tracks upstream branch `11.x` and is **additive**: it adds a `quilt/`
directory and a rebuilt README; the upstream README is preserved verbatim as
[`README.upstream.md`](./README.upstream.md). All upstream code, packages, and
the seven language ports are unchanged, and the MIT license
([`LICENSE`](./LICENSE)) still governs.

## What DiceBear is (three lines)

DiceBear turns any seed string — a username, an email, an agent id — into an SVG
avatar in one of 63 styles. The same seed always produces the same avatar, so
you store a string instead of an image. Avatars are customizable through style
options: colors, background, rotation, individual features.

Upstream lives at [dicebear/dicebear](https://github.com/dicebear/dicebear) and
[dicebear.com](https://www.dicebear.com); the styles are a separate repository,
[`dicebear/styles`](https://github.com/dicebear/styles), shipped here as the
`@dicebear/styles` npm package.

## The QUILT TOOL

Fleet agents are long-lived and headless: they have stable ids but not faces.
`quilt` closes that gap. An agent's face is a **pure function of its id** — you
store the id string and derive the SVG bytes whenever you need them. Same id,
same style ⇒ same bytes, on any box, in any process, forever. The receipt's
`sha256` is the face's identity, so a face can be verified without shipping an
image or trusting a timestamp.

### Quickstart

```sh
# once, to wire the workspace dep (builds @dicebear/core)
npm install && npm --workspace src/js/core run build

# render a face, write the SVG, print a receipt
node quilt/quilt-avatar.mjs --seed agent-0001 --style initials --out face.svg --json

# or stream the SVG straight to stdout (no receipt)
node quilt/quilt-avatar.mjs --seed agent-0001 --style initials
```

Programmatic use (same determinism, engine imported directly):

```js
import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/initials.json' with { type: 'json' };

const face = new Avatar(new Style(definition), { seed: 'agent-0001' });
face.toString(); // SVG string — byte-identical to the CLI output
```

### Receipt format

Canonical JSON: keys lexicographically sorted, no whitespace, **no timestamp**.
A real receipt from the shipped selftest:

```json
{"bytes":1387,"license":"CC0 1.0","seed":"agent-0001","sha256":"14e1ecf8594f3e01ff501411f360b4b20330236ed2944988f38c754df89a1d18","style":"initials","styleVersion":"11.0.0-rc.3","tool":"quilt-avatar"}
```

| field          | meaning                                                   |
| -------------- | --------------------------------------------------------- |
| `tool`         | always `quilt-avatar`                                     |
| `seed`         | the seed string that was rendered                         |
| `style`        | the style name that was rendered                          |
| `license`      | the style's license name (see attribution note)           |
| `sha256`       | SHA-256 of the exact SVG bytes — the identity of the face |
| `bytes`        | length of the SVG in bytes                                |
| `styleVersion` | `@dicebear/styles` version the definition came from       |

Because the receipt has no timestamp and is canonically serialized, two runs of
the same `(seed, style)` produce **identical receipts**. `rc=2` on a missing or
empty `--seed` and on an unknown `--style` (which lists the 63 available
styles).

### Style licenses — attribution

The **code is MIT**. The **styles are not** — each carries its own license,
repeated in the definition's `meta.license` and in
[`node_modules/@dicebear/styles/LICENSE.md`](https://github.com/dicebear/styles).
Across the 63 built-in styles: 44 are **CC0 1.0** (public domain, no
attribution), 14 are **CC BY 4.0** (attribution required — e.g. `adventurer`,
`croodles`, `dylan`, `fun-emoji`, `personas`, `toon-head`), 4 are "free for
personal and commercial use" (`avataaars`, `bottts`), and 1 is MIT. For CC BY
styles the renderer embeds the attribution as RDF/Dublin-Core `<metadata>` in
each SVG — keep that block. Prefer a CC0 style (`initials`, `lorelei`,
`identicon`, `shapes`) when attribution is inconvenient. The receipt's `license`
field always tells you which regime you rendered under.

### More

- [`quilt/PATCH.md`](./quilt/PATCH.md) — the quilt patch manifest (kind, input,
  output, interface, `receipt_verb: rendered`).
- [`quilt/README.md`](./quilt/README.md) — architecture of the quilt face,
  A2A usage for headless agents, batch fleet identity generation, and optional
  receipt anchoring via a `receiptd` chain.
- [`quilt/SELFTEST-2026-10-02.md`](./quilt/SELFTEST-2026-10-02.md) — the
  byte-identity proof: 3 seeds × 3 styles rendered twice in separate processes,
  all byte-identical, plus the fail-loud checks.

### Reproduce the proof

```sh
node --check quilt/quilt-avatar.mjs
node quilt/quilt-selftest.mjs
```

## Upstream

Everything outside `quilt/` is upstream DiceBear. See
[`README.upstream.md`](./README.upstream.md) for the original project overview,
the seven-language port table, and the full documentation links
([dicebear.com](https://www.dicebear.com), [playground](https://www.dicebear.com/playground),
[editor](https://editor.dicebear.com)).

## License

The code is [MIT licensed](./LICENSE), including commercial use. The avatar
styles are the work of their respective creators and carry their own licenses;
[a full overview](https://www.dicebear.com/licenses/) lists them all. This fork
keeps the same MIT terms.
