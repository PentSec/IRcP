/** @type {import('bd-scss/lib/config').Config} */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Where `dev` drops the single-file build.
//
// bd-scss writes to whatever path it is given, and calls mkdir() on its parent. If the
// client is not installed it resolves the folder to an empty string, and dev dies with
// `ENOENT: mkdir ''`. The folder can also simply not exist yet: Vencord only creates
// `themes/` the first time it is opened. So resolve it here, creating it for dev, and
// fall back to a local .dev/ instead of crashing anywhere else.
//
// The home folder comes from the environment or from the account database: HOME is unset in
// plenty of CI images, and Electron keeps its data under %APPDATA% and Application Support.
const CLIENTS = ['Vencord', 'vesktop', 'Vesktop'];

const homeFolder = () => {
  if (process.env.HOME) return process.env.HOME;
  try {
    return os.homedir();
  } catch {
    return undefined;
  }
};

const configRoots = (home) => {
  if (!home) return [];
  const roots = [];
  if (process.env.XDG_CONFIG_HOME) roots.push(process.env.XDG_CONFIG_HOME);
  if (process.platform === 'darwin') roots.push(path.join(home, 'Library', 'Application Support'));
  if (process.platform === 'win32') roots.push(process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming'));
  if (!process.env.XDG_CONFIG_HOME) roots.push(path.join(home, '.config'));
  roots.push(path.join(home, '.local', 'share'));
  return roots;
};

const resolveThemesFolder = () => {
  for (const base of configRoots(homeFolder())) {
    for (const client of CLIENTS) {
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
    version: '2.0.0-irc.101',
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

  // Fonts are a separate file on purpose: 163 KB of base64 (123 KB compressed) with its own
  // cache entry, so a change to the body does not re-download them. dist: true publishes
  // fonts.css and imports it from irc.theme.css; dev: true inlines it so `dev` keeps
  // producing one self-contained file.
  addons: [{ target: 'src/addons/_fonts.scss', name: 'fonts', dist: true, dev: true }],

  // bd-scss always writes a BetterDiscord copy as well. Pointing both at the same folder
  // avoids inventing a second directory in the repository — and a `.dev/` at the root
  // makes zsh's autocorrect offer it every time you type `bun run dev`.
  betterdiscord: { themeFolder: themes },
  vencord: { dev: true, themeFolder: themes }
};
