// Minifier for the published body stylesheet.
//
// The body is ~72 KB because it carries a comment on every non-obvious decision and every
// selector sits on its own line. Both are free in the source and expensive on the wire, so
// the published copy is compacted here instead of in the sources.
//
// What it does NOT do, on purpose:
//   - it never rewrites a declaration value (`0.15` stays `0.15`, `hsl()` stays `hsl()`),
//     so no colour, length or timing can drift by a rounding step;
//   - it keeps every comment that carries a licence notice;
//   - it only compacts `irc.css`. `irc.theme.css` is the file users open to change a
//     variable and `fonts.css` explains its own licensing, so both stay readable.
//
// The output is serialized by hand instead of by postcss's stringifier, which preserves
// formatting decisions we are deliberately dropping. Every run re-parses its own output and
// asserts that rules, selectors, properties, values and !important flags are unchanged and
// still in the same order: a minifier that loses something fails the build instead of
// publishing it.

import postcss from 'postcss';

const LICENCE = /derived from|MIT\. See THIRD-PARTY-NOTICES/i;

// Whitespace is significant inside a string and nowhere else, so the compactor is
// string-aware rather than a plain regex.
const compact = (text, { dropCommaSpace = false } = {}) => {
  let out = '';
  let quote = null;
  let pending = false;
  let afterComma = false;

  for (const char of text) {
    if (quote) {
      out += char;
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      if (pending && !afterComma) out += ' ';
      pending = false;
      afterComma = false;
      quote = char;
      out += char;
      continue;
    }
    if (char === ' ' || char === '\t' || char === '\n' || char === '\r') {
      pending = true;
      continue;
    }
    if (char === ',' && dropCommaSpace) {
      out = out.replace(/ $/, '') + ',';
      pending = false;
      afterComma = true;
      continue;
    }
    if (pending) {
      if (!afterComma) out += ' ';
      pending = false;
    }
    afterComma = false;
    out += char;
  }

  return out.trim();
};

const selectorOf = (rule) => compact(rule.selector, { dropCommaSpace: true });

const signature = (css) => {
  const root = postcss.parse(css);
  const rules = [];

  root.walkRules((rule) => {
    const context = [];
    for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
      if (parent.type === 'atrule') context.unshift(`@${parent.name} ${compact(parent.params)}`);
    }

    const declarations = [];
    rule.walkDecls((decl) => {
      declarations.push([decl.prop, compact(decl.value), Boolean(decl.important)]);
    });

    rules.push({ context: context.join(' '), selector: selectorOf(rule), declarations });
  });

  return JSON.stringify(rules);
};

const serializeChildren = (nodes = []) => {
  let out = '';
  let openDeclaration = false;

  for (const node of nodes) {
    if (node.type === 'decl') {
      out += `${openDeclaration ? ';' : ''}${serialize(node)}`;
      openDeclaration = true;
      continue;
    }
    out += serialize(node);
    openDeclaration = false;
  }

  return out;
};

const serialize = (node) => {
  if (node.type === 'comment') {
    return `/*${node.text.replace(/\s*\n\s*\*?\s*/g, ' ').trim()}*/`;
  }

  if (node.type === 'decl') {
    return `${node.prop}:${compact(node.value)}${node.important ? '!important' : ''}`;
  }

  if (node.type === 'rule') return `${selectorOf(node)}{${serializeChildren(node.nodes)}}`;
  if (node.type === 'atrule') {
    const head = `@${node.name}${node.params ? ` ${compact(node.params)}` : ''}`;
    return node.nodes ? `${head}{${serializeChildren(node.nodes)}}` : `${head};`;
  }

  return '';
};

export const minifyCss = (css, label) => {
  const root = postcss.parse(css);

  root.walkComments((comment) => {
    if (!LICENCE.test(comment.text)) comment.remove();
  });

  const output = root.nodes.map(serialize).join('');

  const before = signature(css);
  const after = signature(output);
  if (before !== after) {
    const index = [...before].findIndex((char, i) => char !== after[i]);
    const from = Math.max(0, index - 140);
    throw new Error(
      `[minify] ${label}: the compacted CSS is not equivalent at byte ${index}\n` +
        `  before: …${before.slice(from, index + 140)}…\n` +
        `  after:  …${after.slice(from, index + 140)}…`
    );
  }

  return output;
};
