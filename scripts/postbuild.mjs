// Post-build steps that bd-scss does not do.
//
// bd-scss only writes CSS. It has no hook for assets, no way to change the import it
// generates, and no way to separate the header from meta. Everything below is that gap:
//
//  1. rewrites the generated github.io import to the deploy origin (GitHub answers
//     pentsec.github.io/IRcP/* with a 301 to http://jeff.is-a.dev/* and then to https,
//     and Chromium blocks a stylesheet that downgrades to plain HTTP);
//  2. restores @name IRcP, because meta.name has to stay 'irc' for the file names;
//  3. copies the background next to the theme, which is where the CSS points at, and the
//     license notices, because the published branch is a distribution;
//  4. adds .nojekyll so Pages serves the folder as-is;
//  5. fails loudly if any of the above did not happen.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import config from '../bd-scss.config.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const { name } = config.meta;
const repo = config.github.repo;
const githubIo = `https://${config.github.profile.toLowerCase()}.github.io/${repo}/`;
const deployUrl = `${config.deploy.origin}/${repo}/`;

const fail = (message) => {
  console.error(`[postbuild] ${message}`);
  process.exit(1);
};

const read = (file) => fs.readFileSync(path.join(dist, file), 'utf8');
const write = (file, contents) => fs.writeFileSync(path.join(dist, file), contents);

// 1 and 2 -------------------------------------------------------------------
const themeFile = `${name}.theme.css`;
if (!fs.existsSync(path.join(dist, themeFile))) fail(`missing ${themeFile}; did bd-scss build run?`);

for (const file of fs.readdirSync(dist).filter((f) => f.endsWith('.css'))) {
  const before = read(file);
  const after = before.split(githubIo).join(deployUrl);
  if (after !== before) write(file, after);
}

const theme = read(themeFile);

if (theme.includes('github.io')) {
  fail(`a github.io URL survived in ${themeFile}: ${theme.match(/https:\/\/[^\s'"]*github\.io[^\s'"]*/)[0]}`);
}

// meta.name is lower case so the files are irc.css / irc.theme.css; the header is what
// users read, so it keeps the name the theme has always had.
const renamed = theme.replace(`@name ${name}\n`, '@name IRcP\n');
if (renamed === theme) fail(`could not find "@name ${name}" in ${themeFile}`);
write(themeFile, renamed);

// 3 -------------------------------------------------------------------------
const assets = path.join(root, 'src', 'assets');
const wallpapers = fs.existsSync(assets)
  ? fs.readdirSync(assets).filter((file) => /[.](png|jpe?g|webp|avif|gif)$/i.test(file))
  : [];
if (!wallpapers.length) fail('no wallpaper found in src/assets');
for (const file of wallpapers) fs.copyFileSync(path.join(assets, file), path.join(dist, file));

// The published branch is a distribution, and the licenses require their notices to
// travel with it: the CSS keeps "Derived from ... MIT" headers, these files keep the
// permission texts they point at.
for (const file of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}

// 4 -------------------------------------------------------------------------
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

// 5 -------------------------------------------------------------------------
const expected = [
  themeFile,
  `${name}.css`,
  'fonts.css',
  ...wallpapers,
  '.nojekyll',
  'LICENSE',
  'THIRD-PARTY-NOTICES.md'
];
const missing = expected.filter((file) => !fs.existsSync(path.join(dist, file)));
if (missing.length) fail(`missing from dist: ${missing.join(', ')}`);

console.log(`[postbuild] ${deployUrl}${themeFile}`);
console.log(`[postbuild] dist: ${expected.join(', ')}`);
