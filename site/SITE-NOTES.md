# site/SITE-NOTES.md — dicebear-quilt playground

Single-page, no-build static site. Vanilla JS, dark theme, no frameworks.
Deploy target: Cloudflare Pages (serve `site/` as the root). **No git actions taken — parent handles that.**

## Files built

| file | what |
|------|------|
| `site/index.html` | all 4 sections + inline CSS; loads the two scripts |
| `site/app.js` | Section 2 — live face playground (classic script, dynamic `import()`) |
| `site/forgery.js` | Section 3 — the playable hash-chain forgery lab |
| `site/crew/*.svg` | 10 crew faces, copied from `quilt/play-2026-10-02/crew/` |
| `site/SITE-NOTES.md` | this file |

Sections: **1** hero + 10-item "greatest hits" tour · **2** live face playground with client-side sha256
receipt + "prove it" double-render · **3** the forgery lab (tamper / self-consistent rewrite / external
anchor) · **4** the crew grid.

## What works (verified)

- Receipt reproduction: the exact CDN style JSON, run through the pinned core, reproduces the shipped
  crew receipts byte-for-byte. Node check against the live `jsdelivr` bytes:
  `casey/adventurer`, `zeroclaw/pixel-art`, `mmx/fun-emoji` → all **CDN-BYTES MATCH** (and the earlier
  local-dist check matched all 3 sampled receipts, incl. `lucineer/bottts`).
- `node --check app.js` → OK. `node --check forgery.js` → OK.
- HTML structure: python `html.parser` balance check → **no unclosed / unmatched critical tags**.
- Canonical receipt is genuinely canonical: keys sorted lexicographically, `JSON.stringify` values, no
  whitespace, **no timestamp** — so two runs of the same `(seed, style)` render an identical receipt
  string, matching the `quilt-avatar` receipt format in the repo README.

## CDN pinning choices (and the one surprise)

- **core:** `https://esm.sh/@dicebear/core@11.0.0-rc.2` — HTTP 200. v11 API, verified:
  `new Avatar(new Style(definition), { seed }).toString()`. No `node:` imports; browser-safe ESM.
- **styles:** `https://cdn.jsdelivr.net/npm/@dicebear/styles@11.0.0-rc.3/dist/<style>.min.json` — HTTP 200,
  `access-control-allow-origin: *`, `application/json`.
- **SURPRISE — `@dicebear/styles` is NOT loadable from esm.sh.** The package is **JSON-only** (its
  `exports` map every style to `./dist/<style>.min.json`; there is no JS entry), so esm.sh's builder
  returns **404** for `https://esm.sh/@dicebear/styles@11.0.0-rc.3`. The task's assumption
  ("import @dicebear/styles from esm.sh") is not satisfiable for this package at any version.
  **Resolution:** import the *core* from esm.sh, fetch the *style definitions* as plain JSON from
  jsdelivr (unpkg also works; jsdelivr chosen for the `access-control-allow-origin: *` header and
  reliable `dist/` layout). Note the jsdelivr path needs the `dist/` segment — the package root 404s.
- Both esm.sh and jsdelivr pin to the **11.0.0-rc line**, matching the repo's `node_modules`
  (`@dicebear/core@11.0.0-rc.2`, `@dicebear/styles@11.0.0-rc.3`) so the page's receipts equal the CLI's.
  `styleVersion` in the receipt is hard-set to `11.0.0-rc.3` (the styles version), matching the shipped
  receipts; the core version is a separate concern and is only in the URLs.
- No exact `11.x.y` stable (only `11.0.0-rc.N`) exists on npm yet; `@dicebear/core@11` (bare) 404s on
  esm.sh, so the RC is pinned explicitly rather than floating.

## Known limits

- **Client-side sha256 needs a secure context** (`crypto.subtle`). Fine on Cloudflare Pages (https) and
  on `localhost`; opening `index.html` via `file://` will show the "CDN unreachable" banner and disable
  the receipt/lab. Graceful-degradation path: banner text is
  "CDN unreachable — receipts still valid", and the rest of the page stays usable.
- **8 styles only** (bottts, adventurer, personas, pixel-art, identicon, thumbs, fun-emoji, shapes), as
  requested. Each style JSON is fetched lazily and cached in-memory; first load of a new style needs the
  network. `personas`/`adventurer`/`fun-emoji` are **CC BY 4.0** — their SVGs embed attribution metadata
  and the receipt's `license` field reflects it; keep the `<metadata>` block.
- The playground's receipt hash is over the **exact SVG string** the core produces, which — for the same
  pinned core + style version — equals the CLI's `quilt-avatar` hash. Different core/style *versions* may
  emit different bytes; that is why both versions appear in the receipt.
- **No live browser smoke test in this environment** (headless Chromium couldn't start — no display;
  `browser start` failed with CDP ECONNREFUSED). De-risked instead by running the identical API + hashing
  in Node against the live CDN bytes, which reproduced the shipped receipts exactly.
- The crew grid uses `<img src="crew/*.svg">` (not inlined SVG) to keep `index.html` readable; all 10
  files are present under `site/crew/` and all 10 are referenced.

## Self-test results (run 2026-10-02)

```
node --check app.js      → OK
node --check forgery.js  → OK
esm.sh/@dicebear/core@11.0.0-rc.2                     → 200
cdn.jsdelivr.net/@dicebear/styles@11.0.0-rc.3/dist/bottts.min.json → 200 (CORS *)
esm.sh/@dicebear/styles@11.0.0-rc.3                   → 404 (JSON-only package; expected)
HTML tag-balance (python html.parser)                 → no unclosed/unmatched tags
CDN-bytes receipt repro (3 seeds/styles)              → MATCH ✓
```
