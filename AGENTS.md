# AGENTS.md

Vencord theme for a personal Discord install, built with `bd-scss`. No tests: the
deliverable is CSS that Vencord injects into the renderer. `main` holds sources; `deploy`
holds generated files and is written only by CI.

## Layout

| Path                     | What it is                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `bd-scss.config.js`      | `meta` (the `@name`/`@version` header), `github`, the fonts addon, `deploy.origin` |
| `src/root.scss`          | compiles to `irc.theme.css`: user variables only, no selectors                     |
| `src/main.scss`          | compiles to `irc.css`: `@use` of the partials, in cascade order                    |
| `src/theme/_tokens.scss` | internal custom properties shared by every partial                                 |
| `src/theme/app/`         | background layer, titlebar, toolbar, window controls                               |
| `src/theme/serverlist/`  | guild rail: folders, items, unread pill, icons                                     |
| `src/theme/sidebar/`     | channel and DM lists, user panel                                                   |
| `src/theme/chat/`        | message area, composer, dividers, notice bars, mentions                            |
| `src/theme/members/`     | member list column, rows and role groups                                           |
| `src/theme/popouts/`     | server and channel popouts                                                         |
| `src/theme/messages/`    | one-line message rows: row, clock, runs, reply, nick, avatar                       |
| `src/theme/forum/`       | forum posts as log lines                                                           |
| `src/theme/status/`      | presence rings, glow and the avatar exceptions                                     |
| `src/theme/_wiring.scss` | maps `--irc-font` onto the variables Discord reads; not configuration              |
| `src/addons/_fonts.scss` | Iosevka `@font-face` with base64 subsets (460 KB), generated                       |
| `src/assets/bg.png`      | wallpaper, published next to the theme                                             |
| `scripts/postbuild.mjs`  | everything bd-scss does not do (see below)                                         |
| `scripts/dev.mjs`        | forces the initial dev build, which bd-scss skips                                  |
| `THIRD-PARTY-NOTICES.md` | MIT texts for the reused CSS, OFL/CC-BY for font and icon                          |

`dist/` and a dev build at the repository root are generated and gitignored.

## What bd-scss does (verified in `node_modules/bd-scss/src`)

- `build` writes `dist/<meta.name>.theme.css` = generated meta + `@import` of
  `<meta.name>.css` + imports of `dist:true` addons + compiled `root.scss`, and
  `dist/<meta.name>.css` = compiled `main.scss`. Output names come from `meta.name`, so it
  stays `irc`.
- `generateImport()` hardcodes `https://<profile>.github.io/<repo>/<name>.css`. There is
  no hook and no override.
- It writes CSS only: no assets, no `.nojekyll`, no header edits.
- `dev` writes **one** file with the body and the `dev:true` addons inlined, into the
  client's themes folder. That folder is resolved in `bd-scss.config.js`
  (`$XDG_CONFIG_HOME/Vencord/themes`, created on demand) because bd-scss resolves it to an
  empty string when the client is missing and then dies in `mkdir ''`; with no client it
  falls back to `.dev/`. `scripts/dev.mjs` wraps it because bd-scss compiles only from the
  watcher's `change` event and never on `ready`, so an unwrapped `dev` sits idle until the
  first save; the wrapper triggers that first build once the ready banner appears.
- `reroll` rewrites hashed classes only in `src/**/_*.scss`.

`scripts/postbuild.mjs` covers the gap: it rewrites the `github.io` import to
`deploy.origin`, restores `@name IRcP`, copies `bg.png` and the license notices, writes
`.nojekyll` and fails the build if any of that did not happen. Never hand-edit `dist/`.
A dev build skips postbuild, so it keeps `@name irc`; only the published file is renamed.

## How Vencord loads a theme (verified in `~/.config/Vencord/dist`)

- `renderer.js` injects `@import url("vencord:///themes/<file>?v=<Date.now()>")` into a
  `<style id="vencord-themes">`.
- `patcher.js` registers `protocol.handle("vencord")`: `/themes/<rest>` maps to the themes
  directory with a path-traversal guard.
- **Only the theme file URL carries the cache buster.** The entry is re-fetched on every
  toggle, but `irc.css` and `fonts.css` are ordinary HTTP resources on Pages/Cloudflare
  with `max-age=600`. So a body change reaches the client within ten minutes, with no
  restart; a variable change is instant.
- Vencord rewrites the mainFrame CSP (`Cn` in `patcher.js`): `vencord:` and `data:` are
  allowed for `style-src`, `img-src`, `font-src`, `connect-src`, `media-src`,
  `worker-src`, and stylesheet responses get `Content-Type: text/css`. CSP is not a
  suspect.
- The theme list is a **non-recursive** `readdir` filtered to top-level `*.css`.

## Gotchas that already cost time

- **GitHub answers `pentsec.github.io/IRcP/*` with `301 http://jeff.is-a.dev/*`**, which
  redirects again to HTTPS. Chromium blocks a stylesheet load that downgrades to plain
  HTTP, so a `github.io` import is broken, not merely slow. That is why postbuild
  rewrites it and why `deploy.origin` lives in `bd-scss.config.js`.
- `url()` inside a **custom property** resolves against the document base
  (`https://discord.com`), not against the stylesheet. `_ui.scss` uses that distinction:
  `var(--background-image, url('bg.png'))` is a normal declaration, so the fallback
  resolves next to the CSS — which is why `dev` copies `bg.png` into the themes folder and
  postbuild copies it into `dist/`. An override in `root.scss` _is_ a custom property, so
  it must be absolute or it silently 404s.
- `raw.githubusercontent.com` serves `.css` as `text/plain` with `nosniff`, and Blink
  refuses that as a stylesheet (verified in Chromium and in Electron: the same bytes
  applied when served `text/css`, ignored when `text/plain`). GitHub Pages serves
  `text/css` and is the only host that matters here.
- Generic custom-property names collide in a live client (observed: `--font` computed to
  `"gg sans", "Noto Sans"` even though only the theme declared it). Namespace everything
  with `--irc-*` and use `!important` for font wiring. `--irc-theme: 1` is a marker
  proving the entry file parsed.
- Sass rewrites some modern syntax on the way out: `hsl(0 0% 100% / 0.12)` becomes
  `hsla(0, 0%, 100%, 0.12)` and `center / contain` becomes `center/contain`. Same
  meaning, so do not "fix" the output.
- Autoprefixer runs with the default browserslist, so `-o-` prefixes (Opera) appear in
  `dist/`. They are dead weight for Electron; adding a `browserslist` field to
  `package.json` would remove them, but it is a deliberate change, not a cleanup.
- Fonts stay base64 `data:` URIs. Vencord serves local themes over `vencord://` without
  CORS headers, and font loads are CORS-mode requests, so an external `.woff2` would fail
  silently. Splitting them would also need per-file cache busting.
- Two other styles are active and can outrank this theme when debugging a "rule doesn't
  apply": `~/.config/Vencord/settings/quickCss.css` (DiscordRecolor) and `themeLinks`
  (ClearVision).

## Discord DOM class hashes

Discord ships BEM-ish hashed classes (`.avatar_c19a55`, `.header_c19a55`). The hash
changes between builds; a rule that silently stops working usually means the hash moved.
To find the current one without logging in:

```bash
curl -s https://discord.com/app -o /tmp/app.html
grep -o '/assets/[a-z0-9]*\.[a-f0-9]*\.css' /tmp/app.html | sort -u > /tmp/css.txt
# download the chunks, then:
grep -l 'cozy' /tmp/dcss/*.css      # the message component lives in exactly one chunk
grep -o '\.[a-z]*_c19a55' FILE.css | sort -u
```

Discord's own rules in that chunk are the reference: copy their values instead of
inventing them. `bun run reroll` applies the community map to `src/**/_*.scss`.

## Debugging layout bugs

Do not build offline fixtures or render the theme outside the client. The source of truth
is the live DOM: ask the user to copy the offending element from DevTools (Elements →
right-click → Copy → Copy outerHTML) plus what they see on screen.

That pairing — real DOM + what the user reports — is faster and more accurate than any
reproduction, because the DOM carries the classes the build actually emits and the user
carries the perception the CSS has to satisfy.

## Verify without restarting Discord

Vencord → Open DevTools, then:

```js
[
  getComputedStyle(document.documentElement).getPropertyValue('--irc-theme').trim(),
  getComputedStyle(document.documentElement).getPropertyValue('--font-primary').trim(),
  getComputedStyle(document.body).fontFamily
];
```

`--irc-theme` empty means the entry did not load; `1` plus `gg sans` means a cascade
fight, not a load failure. Toggle the theme off/on to re-fetch the entry from the dev
build; the body follows the cache rules above.

## Regenerating the embedded fonts

`pyftsubset` (fonttools + brotli are installed), one run per face, then base64 into
`src/addons/_fonts.scss`:

```
pyftsubset fonts/IosevkaTermSlabNerdFont-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-024F,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-036F,U+0370-03FF,U+0400-04FF,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2500-257F,U+2580-259F,U+25A0-25FF,U+2C60-2C7F,U+A720-A7FF" \
  --layout-features='ccmp,locl,mark,mkmk,kern' --no-hinting --flavor=woff2 --output-file=regular.woff2
```

Use the plain `IosevkaTermSlabNerdFont-*` builds (Term metrics), not `-Mono` (forces 1ch
on every glyph) or `-Propo` (proportional). Ligatures (`calt`) are intentionally dropped
so `->` and `!=` stay literal in chat. The upstream TTFs are not in the repository.

## Conventions

- Bump `meta.version` in `bd-scss.config.js` (`2.0.0-irc.N`) on every change so the loaded
  build is identifiable.
- Variables the user is meant to touch go in `src/root.scss` and in the README table.
  Anything else is internal and lives in the partial that uses it.
- Keep `THIRD-PARTY-NOTICES.md` and the `Derived from …` headers. The reused CSS is MIT
  (notice and permission text must travel with copies or substantial portions) and the
  embedded font is SIL OFL 1.1 (copyright line and license must accompany the font).
  Renaming the theme or rewriting comments does not remove those obligations.
- One `@use` per folder in `src/main.scss`; each folder's `index.scss` `@forward`s its
  partials in cascade order. A new file is not compiled until its `@forward` is added in
  the right position. No `@import` anywhere in `src/`: it would be hoisted out of the
  body by bd-scss.
- **Moving a rule between files is a cascade change.** Rules that share a class and a
  property must keep their relative order. Before reordering, diff the built CSS and
  compare the declaration sequence; the split that produced this layout kept all 1274
  class+property pairs in order.
- `bun` only. One lockfile. `format:check` must pass; formatting changes get their own
  commit.
- The deployed URLs are part of the contract: `irc.theme.css` is what users paste into
  Vencord. Do not rename files without a migration plan.
