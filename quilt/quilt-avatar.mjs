#!/usr/bin/env node
/**
 * quilt-avatar — deterministic fleet face renderer.
 *
 * Renders a DiceBear avatar for a given (seed, style) pair and prints a
 * canonical JSON receipt. The same seed always produces the same bytes, so a
 * fleet agent stores its agent-id string and derives its visual identity on
 * demand instead of shipping an image.
 *
 * Usage:
 *   node quilt/quilt-avatar.mjs --seed agent-0001 --style initials --out face.svg --json
 *   node quilt/quilt-avatar.mjs --seed agent-0001 --style initials        # SVG to stdout
 *   node quilt/quilt-avatar.mjs --seed agent-0001 --style initials --out face.svg
 *
 * Exit codes:
 *   0  rendered
 *   2  usage error (missing/empty --seed, unknown --style, bad argument)
 *
 * The receipt has no timestamp: byte-identity is the identity. The canonical
 * receipt is a JSON object with lexicographically sorted keys, so its own
 * serialization is stable too.
 */
import { Avatar, Style } from '@dicebear/core';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const require = createRequire(import.meta.url);

const TOOL = 'quilt-avatar';
const EXIT_OK = 0;
const EXIT_USAGE = 2;

/** A built-in style name: lowercase alphanumerics joined by single dashes. */
const STYLE_NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function fail(message) {
  process.stderr.write(`${TOOL}: ${message}\n`);
  process.exit(EXIT_USAGE);
}

function parseArgs(argv) {
  const args = { seed: undefined, style: undefined, out: undefined, json: false, help: false };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--seed':
        args.seed = argv[++i];
        break;
      case '--style':
        args.style = argv[++i];
        break;
      case '--out':
        args.out = argv[++i];
        break;
      case '--json':
        args.json = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        fail(`unknown argument "${argv[i]}" (try --help)`);
    }
  }

  return args;
}

function usage() {
  return [
    `${TOOL} — deterministic DiceBear face for a fleet agent`,
    '',
    'Usage:',
    `  node quilt/quilt-avatar.mjs --seed <string> --style <name> [--out <path.svg>] [--json]`,
    '',
    'Options:',
    '  --seed   <string>   required; the agent id / stable seed string',
    '  --style  <name>     required; a built-in DiceBear style name',
    '  --out    <path.svg> write the SVG here (default: SVG to stdout)',
    '  --json              print the canonical receipt to stdout',
    '  --help, -h          show this help',
  ].join('\n');
}

/** Directory that holds the minified style definitions shipped by @dicebear/styles. */
function stylesDir() {
  return path.dirname(require.resolve('@dicebear/styles/initials.json'));
}

/** Sorted names of every built-in style, read from one directory listing. */
function listStyles() {
  return fs
    .readdirSync(stylesDir())
    .filter((file) => file.endsWith('.min.json'))
    .map((file) => file.replace(/\.min\.json$/, ''))
    .sort();
}

/** On-disk path of a built-in style definition, or undefined when unknown. */
function resolveStylePath(style) {
  if (!STYLE_NAME_RE.test(style)) {
    return undefined;
  }
  try {
    return require.resolve(`@dicebear/styles/${style}.json`);
  } catch {
    return undefined;
  }
}

/**
 * Version of the @dicebear/styles package a definition came from, read from
 * its `$id` (e.g. .../@dicebear/styles@11.0.0-rc.3/dist/lorelei.min.json).
 * Falls back to "unknown" when the definition carries no such `$id`.
 */
function styleVersion(definition) {
  const id = definition && definition.$id;
  if (typeof id === 'string') {
    const match = id.match(/@dicebear\/styles@([^/]+)\//);
    if (match) {
      return match[1];
    }
  }
  return 'unknown';
}

/** Serialize an object with lexicographically sorted keys and no whitespace. */
function canonicalJson(object) {
  const sorted = {};
  for (const key of Object.keys(object).sort()) {
    sorted[key] = object[key];
  }
  return JSON.stringify(sorted);
}

function render(args) {
  if (args.seed === undefined) {
    fail('missing required --seed');
  }
  if (args.seed === '') {
    fail('--seed must not be empty');
  }
  if (args.style === undefined) {
    fail('missing required --style');
  }

  const stylePath = resolveStylePath(args.style);
  if (stylePath === undefined) {
    const available = listStyles();
    fail(
      `unknown style "${args.style}". ${available.length} built-in styles available: ` +
        available.join(', '),
    );
  }

  const definition = JSON.parse(fs.readFileSync(stylePath, 'utf-8'));
  const style = new Style(definition);

  // Options are fixed and empty in v1 so that (seed, style) alone determines
  // every byte of the output. See quilt/PATCH.md.
  const avatar = new Avatar(style, { seed: args.seed });

  const svg = avatar.toString();
  const bytes = Buffer.from(svg, 'utf-8');
  const receipt = {
    tool: TOOL,
    seed: args.seed,
    style: args.style,
    license: style.meta().license().name() ?? 'unknown',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    styleVersion: styleVersion(definition),
  };

  if (args.out !== undefined) {
    const target = path.resolve(args.out);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, bytes);
  }

  if (args.json) {
    process.stdout.write(canonicalJson(receipt) + '\n');
  } else if (args.out === undefined) {
    process.stdout.write(svg + '\n');
  }

  return EXIT_OK;
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(usage() + '\n');
    process.exit(EXIT_OK);
  }

  process.exit(render(args));
}

main();
