#!/usr/bin/env node
/**
 * quilt-selftest — proves byte-identity and fail-loud behavior for quilt-avatar.
 *
 * For a 3x3 grid of (seed, style) pairs it invokes quilt-avatar.mjs TWICE as
 * two separate OS processes, hashes each output independently, and asserts the
 * two byte streams are identical and match the receipt's sha256. It also
 * checks the two fail-loud paths: an unknown style and an empty seed must both
 * exit rc=2.
 *
 * Writes quilt/SELFTEST-<date>.md and prints the verdict table to stdout.
 * Exit code 0 when every check passes, 1 otherwise.
 *
 * Usage: node quilt/quilt-selftest.mjs [--date YYYY-MM-DD]
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(here, 'quilt-avatar.mjs');

const STYLES = ['initials', 'lorelei', 'adventurer'];
const SEEDS = ['agent-0001', 'agent-0002', 'agent-0003'];

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

/** Run the CLI once in its own process. Returns {rc, stdout, stderr, file}. */
function runCli(args, outFile) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf-8',
  });
  const file = outFile && fs.existsSync(outFile) ? fs.readFileSync(outFile) : null;
  return {
    rc: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    file,
  };
}

function main() {
  const dateArg = process.argv.indexOf('--date');
  const date =
    dateArg !== -1 && process.argv[dateArg + 1] ? process.argv[dateArg + 1] : '2026-10-02';

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quilt-selftest-'));
  const rows = [];
  let failures = 0;

  for (const style of STYLES) {
    for (const seed of SEEDS) {
      const outA = path.join(tmp, `${style}__${seed}__a.svg`);
      const outB = path.join(tmp, `${style}__${seed}__b.svg`);

      // Two SEPARATE process invocations.
      const a = runCli(['--seed', seed, '--style', style, '--out', outA, '--json'], outA);
      const b = runCli(['--seed', seed, '--style', style, '--out', outB, '--json'], outB);

      const rcOk = a.rc === 0 && b.rc === 0;
      const hashA = a.file ? sha256(a.file) : null;
      const hashB = b.file ? sha256(b.file) : null;
      const identical = hashA !== null && hashA === hashB;

      let receipt = {};
      try {
        receipt = JSON.parse(a.stdout);
      } catch {
        receipt = {};
      }
      const receiptMatches = receipt.sha256 === hashA && receipt.bytes === a.file?.length;
      const license = receipt.license ?? '?';
      const styleVersion = receipt.styleVersion ?? '?';
      const bytes = a.file ? a.file.length : 0;

      const ok = rcOk && identical && receiptMatches;
      if (!ok) {
        failures++;
      }

      rows.push({
        style,
        seed,
        hashA,
        hashB,
        bytes,
        license,
        styleVersion,
        identical,
        receiptMatches,
        ok,
      });
    }
  }

  // Fail-loud checks.
  const unknownStyle = runCli(['--seed', 'agent-0001', '--style', 'no-such-style-xyz', '--json']);
  const emptySeed = runCli(['--seed', '', '--style', 'initials', '--json']);
  const unknownStyleOk = unknownStyle.rc === 2;
  const emptySeedOk = emptySeed.rc === 2;
  if (!unknownStyleOk) failures++;
  if (!emptySeedOk) failures++;

  // ---- report ----
  const short = (h) => (h ? h.slice(0, 16) + '…' : 'n/a');
  const lines = [];
  lines.push(`# quilt-avatar selftest — ${date}`);
  lines.push('');
  lines.push(
    'Byte-identity and fail-loud behavior for `quilt/quilt-avatar.mjs`. Each row is',
  );
  lines.push(
    'rendered **twice in two separate OS processes**; the two independent sha256',
  );
  lines.push('digests must match, and must match the `sha256` in the printed receipt.');
  lines.push('');
  lines.push('Environment: Node ' + process.version + '; `@dicebear/core` (workspace) + `@dicebear/styles`.');
  lines.push('');
  lines.push('| style | seed | bytes | license | styles ver | run 1 sha256 (16) | run 2 sha256 (16) | identical | receipt ok |');
  lines.push('| ----- | ---- | ----: | ------- | ---------- | ----------------- | ----------------- | :-------: | :--------: |');
  for (const r of rows) {
    lines.push(
      `| ${r.style} | ${r.seed} | ${r.bytes} | ${r.license} | ${r.styleVersion} | \`${short(r.hashA)}\` | \`${short(r.hashB)}\` | ${r.identical ? 'yes' : 'NO'} | ${r.receiptMatches ? 'yes' : 'NO'} |`,
    );
  }
  lines.push('');
  lines.push('## Fail-loud checks');
  lines.push('');
  lines.push('| case | command | expected | actual rc | verdict |');
  lines.push('| ---- | ------- | :------: | --------: | :-----: |');
  lines.push(
    `| unknown style | \`--style no-such-style-xyz\` | rc=2 | ${unknownStyle.rc} | ${unknownStyleOk ? 'PASS' : 'FAIL'} |`,
  );
  lines.push(
    `| empty seed | \`--seed "" --style initials\` | rc=2 | ${emptySeed.rc} | ${emptySeedOk ? 'PASS' : 'FAIL'} |`,
  );
  lines.push('');
  lines.push(`Unknown-style stderr (first line): \`${unknownStyle.stderr.trim().split('\n')[0]}\``);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  const pass = rows.every((r) => r.ok) && unknownStyleOk && emptySeedOk;
  lines.push(
    pass
      ? `**PASS** — ${rows.length}/${rows.length} renders byte-identical across two separate processes; unknown-style and empty-seed both fail loud with rc=2.`
      : `**FAIL** — ${failures} check(s) failed.`,
  );
  lines.push('');
  lines.push(
    'Byte-identity is the identity: the receipt carries no timestamp, so a face is',
  );
  lines.push('verified by comparing `sha256`, never by trusting a clock.');
  lines.push('');

  const report = lines.join('\n') + '\n';
  const outPath = path.join(here, `SELFTEST-${date}.md`);
  fs.writeFileSync(outPath, report);

  // stdout: the table + verdict
  process.stdout.write(report.split('## Fail-loud')[0]);
  process.stdout.write('Fail-loud: unknown-style rc=' + unknownStyle.rc + ' (' + (unknownStyleOk ? 'PASS' : 'FAIL') + '), empty-seed rc=' + emptySeed.rc + ' (' + (emptySeedOk ? 'PASS' : 'FAIL') + ')\n');
  process.stdout.write('Report written to ' + outPath + '\n');
  process.stdout.write(pass ? 'VERDICT: PASS\n' : 'VERDICT: FAIL\n');

  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(pass ? 0 : 1);
}

main();
