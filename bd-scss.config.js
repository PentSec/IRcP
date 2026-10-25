/** @type {import('bd-scss/lib/config').Config} */
import fs from 'node:fs';
import path from 'node:path';

// Where `dev` drops the single-file build.
//
// bd-scss writes to whatever path it is given, and calls mkdir() on its parent. If the
// client is not installed it resolves the folder to an empty string, and dev dies with
// `ENOENT: mkdir ''`. The folder can also simply not exist yet: Vencord only creates
// `themes/` the first time it is opened. So resolve it here, creating it for dev, and
// fall back to a local .dev/ instead of crashing anywhere else.
const resolveThemesFolder = () => {
  const home = process.env.HOME;
  const bases = [process.env.XDG_CONFIG_HOME || path.join(home, '.config'), path.join(home, '.local', 'share')];
  for (const base of bases) {
    for (const client of ['Vencord', 'vesktop', 'Vesktop']) {
      const dir = path.join(base, client);
      if (fs.existsSync(dir)) return path.join(dir, 'themes');
    }
  }
  return '.dev';
};

const themes = resolveThemesFolder();
if (process.argv.includes('dev')) fs.mkdirSync(themes, { recursive: true });

export default {
  meta: {
    name: 'irc',
    author: 'PentSec',
    version: '2.0.0-irc.58',
    description:
      'A Discord theme shaped like a terminal IRC client: monospace log lines, dim metadata, translucent panels.',
    source: 'https://github.com/PentSec/IRcP'
  },

  // The file names come from meta.name: irc.theme.css (entry) and irc.css (body).
  // bd-scss builds the body import as https://<profile>.github.io/<repo>/<name>.css,
  // which lands on a two-hop redirect through plain HTTP. scripts/postbuild.mjs
  // rewrites it to `deploy.origin` instead, so the theme never leaves HTTPS.
  github: { profile: 'PentSec', repo: 'IRcP' },
  deploy: { origin: 'https://jeff.is-a.dev' },

  // Fonts are a separate file on purpose: 460 KB of base64 that nobody needs on every
  // theme load. dist: true publishes fonts.css and imports it from irc.theme.css;
  // dev: true inlines it so `dev` keeps producing one self-contained file.
  addons: [{ target: 'src/addons/_fonts.scss', name: 'fonts', dist: true, dev: true }],

  // bd-scss always writes a BetterDiscord copy as well. Pointing both at the same folder
  // avoids inventing a second directory in the repository — and a `.dev/` at the root
  // makes zsh's autocorrect offer it every time you type `bun run dev`.
  betterdiscord: { themeFolder: themes },
  vencord: { dev: true, themeFolder: themes }
};
