# quilt — the fleet face

This directory is the **quilt face** of `SuperInstance/dicebear-quilt`: a thin
deterministic layer over the DiceBear renderer that turns a fleet agent's id
into a stable, verifiable visual identity.

- `PATCH.md` — the patch manifest (kind, input, output, interface, receipt verb).
- `quilt-avatar.mjs` — the CLI. Renders `(seed, style)` → SVG bytes + receipt.
- `quilt-selftest.mjs` — proves byte-identity and fail-loud behavior.
- `SELFTEST-2026-10-02.md` — the selftest table and verdict.

## The idea in one line

> Store the string, derive the bytes: an agent's face is a pure function of its id.

A DiceBear avatar is deterministic. Given the same seed and the same style
definition, the renderer walks the same PRNG stream and emits the same SVG
down to the byte. That makes an avatar a *derived artifact* — the agent only
has to remember its id, and any process in the fleet can regenerate its exact
face later. No image storage, no upload, no drift between services.

## Architecture of the quilt face

```
agent id (string)
      │
      ▼
quilt-avatar.mjs ── resolves style ──► @dicebear/styles/<style>.min.json
      │                                        │
      │                                        ▼
      │                                 new Style(definition)      (validated)
      │                                        │
      ▼                                        ▼
  --seed ────────────────────────────►  new Avatar(style, {seed})   (renders SVG)
      │                                        │
      │                                        ▼
      │                                   avatar.toString()
      ▼                                        │
  sha256(svg bytes) ◄──────────────────────────┘
      │
      ▼
canonical receipt (sorted keys, no timestamp)  ──►  stdout (--json)
SVG bytes                                       ──►  --out <path.svg> / stdout
```

Two layers, one contract:

1. **Engine** — `@dicebear/core` (a workspace package in this monorepo,
   `src/js/core`) provides `Style` and `Avatar`. It is validated: options are
   checked against a schema and the SVG is kept free of scripts, event
   handlers, and external references.
2. **Face** — `quilt-avatar.mjs` fixes the input envelope, resolves the style
   by name, hashes the bytes, and prints a canonical receipt. It adds *no*
   randomness and *no* wall-clock data, so the receipt is a pure function of
   `(seed, style)` too.

### The receipt

Canonical JSON — keys lexicographically sorted, no whitespace, no timestamp:

```json
{"bytes":1387,"license":"CC0 1.0","seed":"agent-0001","sha256":"14e1ecf8594f3e01ff501411f360b4b20330236ed2944988f38c754df89a1d18","style":"initials","styleVersion":"11.0.0-rc.3","tool":"quilt-avatar"}
```

| field          | meaning                                                        |
| -------------- | -------------------------------------------------------------- |
| `tool`         | always `quilt-avatar`                                          |
| `seed`         | the seed string that was rendered                              |
| `style`        | the style name that was rendered                               |
| `license`      | the style's `meta.license.name` (attribution facts, below)     |
| `sha256`       | SHA-256 of the exact SVG bytes — the identity of the face      |
| `bytes`        | length of the SVG in bytes                                     |
| `styleVersion` | `@dicebear/styles` version the definition came from            |

Because the receipt is timestamp-free and canonically serialized, two runs of
the same `(seed, style)` produce **identical receipts**. Comparison is `==`.

### Determinism rule

`(seed, style)` determines every byte. Render options are frozen to `{}` in
v1 — there is no `--size`/`--options` flag. Any option that changed the bytes
would have to appear in the receipt for identity to stay sound, so options stay
out of v1 entirely. See `PATCH.md`.

## A2A usage — headless agents

Agents in the fleet are long-lived and headless; they have ids but not faces.
The quilt face gives them one without a UI:

**Resolve a face on demand (any process, any time):**

```sh
node quilt/quilt-avatar.mjs --seed "$AGENT_ID" --style initials --out "/run/faces/$AGENT_ID.svg" --json
```

The receipt on stdout is the agent's face-identity; `$AGENT_ID` is the only
thing that needs to persist.

**Batch identity generation for a whole fleet:** drive the CLI from a loop or
a small script over your roster. Each agent gets its own style or a shared one;
because everything is deterministic, running the batch twice is idempotent —
existing faces are re-derived, not regenerated differently.

```sh
while read -r id; do
  node quilt/quilt-avatar.mjs --seed "$id" --style lorelei --out "faces/$id.svg" --json \
    >> faces/RECEIPTS.jsonl
done < roster.txt
```

`RECEIPTS.jsonl` is then a manifest of the fleet's faces: one canonical receipt
per line. Programs that need a face read the receipt, check the `sha256`, and
regenerate or fetch accordingly.

**Confirmation / verification:** an agent (or a supervisor) that receives an
SVG can re-run its own receipt and compare `sha256`. Equal hash ⇒ the bytes are
the genuine face for that id, with no need to trust the sender.

**Receipt anchoring (possible, not required):** the receipt is already a stable,
content-addressed statement — `sha256` over deterministic bytes. It can be
anchored in a `receiptd` chain like any other receipt: append
`{"verb":"rendered", ...receipt}` and the face's provenance becomes part of the
same hash-linked log the rest of the fleet already uses. Nothing in the quilt
face depends on this; it is simply compatible, because the receipt has no
timestamp and a canonical form.

## Style licenses and attribution

The **engine code is MIT** (see the root `LICENSE`, © Florian Körner / DiceBear).
The **avatar styles carry their own licenses**, repeated in each definition's
`meta.license` block and in `node_modules/@dicebear/styles/LICENSE.md`. Across
the 63 built-in styles:

| license                                  | styles | attribution required? |
| ---------------------------------------- | -----: | --------------------- |
| CC0 1.0 (public domain)                  |     44 | no                    |
| CC BY 4.0                                |     14 | **yes**               |
| "Free for personal and commercial use"   |      4 | see source terms      |
| MIT                                      |      1 | no (keep notice)      |

The 14 **CC BY 4.0** styles require attribution, e.g. `adventurer`,
`big-ears`, `big-smile`, `croodles`, `dylan`, `fun-emoji`, `glyphs`, `micah`,
`miniavs`, `personas`, `toon-head`, and their `-neutral` variants. The
renderer already embeds the attribution in each SVG as RDF/Dublin-Core
`<metadata>` (creator, source, license) — keep that block intact when you use
these styles. Run any style through the CLI and the receipt's `license` field
tells you which regime applies.

> Rule of thumb for the fleet: default to a CC0 style (`initials`, `lorelei`,
> `identicon`, `shapes`, `thumbs`, …) when attribution is inconvenient; use a
> CC BY style only where its embedded attribution block is preserved.

## Reproducing the selftest

```sh
node quilt/quilt-selftest.mjs            # writes SELFTEST-2026-10-02.md, exits 0 on PASS
node --check quilt/quilt-avatar.mjs      # syntax check
```
