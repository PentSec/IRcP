// Cascade guard.
//
// Splitting or moving rules between partials is a cascade change: two rules that match
// the same element and set the same property are decided by whichever comes last. The
// declaration SET can stay identical while the result changes.
//
// This compares the rules of the build against a baseline and fails when a conflicting
// pair changed its relative order.
//
//   bun run verify:cascade                     # baseline: origin/deploy:irc.css
//   bun run verify:cascade -- --baseline f.css # baseline: any built irc.css
//
// Two rules are considered conflicting when they share a class (they could match the same
// element) and set the same property. Ids are ignored: #app-mount is on everything.
// Rules present in only one of the two files are not compared, so adding, removing or
// editing a rule never fails this check; only a reorder does.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import postcss from 'postcss';

const root = path.resolve(import.meta.dirname, '..');
const built = path.join(root, 'dist', 'irc.css');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

// --------------------------------------------------------------------------- inputs
if (!fs.existsSync(built)) {
  console.error('[cascade] dist/irc.css is missing. Run `bun run build` first.');
  process.exit(1);
}

const resolveBaseline = () => {
  const explicit = arg('baseline');
  if (explicit) {
    const file = path.resolve(root, explicit);
    if (!fs.existsSync(file)) {
      console.error(`[cascade] baseline not found: ${file}`);
      process.exit(1);
    }
    return { label: explicit, css: fs.readFileSync(file, 'utf8') };
  }

  // The deploy branch is the last published build. In CI it has to be fetched first.
  for (const ref of ['origin/deploy', 'deploy']) {
    try {
      const css = execFileSync('git', ['show', `${ref}:irc.css`], {
        cwd: root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      return { label: `${ref}:irc.css`, css };
    } catch {
      // no such ref, or the branch predates the split
    }
  }
  return null;
};

// --------------------------------------------------------------------------- parsing
const norm = (s) => s.replace(/\s+/g, ' ').replace(/["']/g, '').trim().toLowerCase();

// A rule can only hit elements another rule hits if they name a common class.
const tokensOf = (selector) => new Set([...selector.matchAll(/\.([A-Za-z0-9_-]+)/g)].map((m) => m[1]));

const parse = (css) => {
  const rules = [];
  const seen = new Map();

  postcss.parse(css).walkRules((rule) => {
    const context = [];
    for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
      if (p.type === 'atrule') context.unshift(`@${p.name} ${norm(p.params)}`);
    }

    // The same selector may appear more than once (two :root blocks, the pill loops):
    // the nth occurrence is its own rule.
    const selector = norm(rule.selector);
    const base = `${context.join(' ')}||${selector}`;
    const nth = seen.get(base) ?? 0;
    seen.set(base, nth + 1);

    rules.push({
      base,
      key: `${base}\u0000${nth}`,
      selector: rule.selector.replace(/\s+/g, ' '),
      tokens: tokensOf(rule.selector),
      props: new Set(rule.nodes.filter((n) => n.type === 'decl').map((n) => n.prop.toLowerCase())),
      index: rules.length
    });
  });

  return rules;
};

const baseline = resolveBaseline();
if (!baseline) {
  console.log('[cascade] no deploy baseline found; skipping (first published build).');
  process.exit(0);
}

const before = new Map(parse(baseline.css).map((r) => [r.key, r]));
const after = parse(fs.readFileSync(built, 'utf8'));

// --------------------------------------------------------------------------- compare
const flips = [];
let compared = 0;

for (let i = 0; i < after.length; i++) {
  for (let j = i + 1; j < after.length; j++) {
    const a = after[i];
    const b = after[j];

    // Both rules have to exist in the baseline to have an order to compare.
    const oldA = before.get(a.key);
    const oldB = before.get(b.key);
    if (!oldA || !oldB) continue;

    // Same selector twice (two :root blocks, the pill loops), or a shared class:
    // either way they can match the same element.
    const sameSelector = a.base === b.base;
    const shared = sameSelector || [...a.tokens].some((t) => b.tokens.has(t));
    if (!shared) continue;

    const props = [...a.props].filter((p) => b.props.has(p));
    if (!props.length) continue;

    compared++;
    if (oldA.index > oldB.index) flips.push({ a, b, props, sameSelector });
  }
}

const describe = (rule) => rule.selector.slice(0, 110);

if (!flips.length) {
  console.log(`[cascade] ${after.length} rules · ${compared} conflicting pairs · 0 inverted`);
  console.log(`[cascade] baseline: ${baseline.label}`);
  process.exit(0);
}

const shown = flips.slice(0, 10);
console.error(`[cascade] ${flips.length} conflicting pair(s) changed order against ${baseline.label}:`);
for (const { a, b, props, sameSelector } of shown) {
  console.error(`\n  props: ${props.join(', ')}${sameSelector ? ' (same selector)' : ''}`);
  console.error(`  was first: ${describe(a)}`);
  console.error(`  now first: ${describe(b)}`);
}
if (flips.length > shown.length) console.error(`\n  ... and ${flips.length - shown.length} more`);

console.error('\n[cascade] Two rules that can match the same element must keep their relative order.');
console.error('[cascade] Move the files back in the folder index.scss, or make the intent explicit.');
process.exit(1);
