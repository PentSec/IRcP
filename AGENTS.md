# AGENTS.md

Vencord local themes for a personal Discord install. No build, no tests: the deliverable
is CSS that Vencord injects into the Discord renderer at runtime.

## Layout

One entry point plus four imported files. The entry point holds the metadata and the
variables worth editing; everything else is layout.

- `irc.theme.css` — the enabled theme. Metadata, four `@import`s and the user variables
  (section 4). Nothing else: this is the file a theme toggle re-reads.
- `irc/01-status.css` — presence rings around avatars.
- `irc/02-ui.css` — app shell: background layer, sidebars, header, composer, member list,
  popouts.
- `irc/03-fonts.css` — Iosevka `@font-face` with base64 subsets (the 460 KB one).
- `irc/05-messages.css` — one-line message rows and the forum post list.
- `THIRD-PARTY-NOTICES.md` — MIT texts for the reused CSS and OFL/CC-BY notices for the
  embedded font and icon. Required by their licenses; never delete it.
- `README.md` — install and configuration instructions for users.
- `irc/bg.png` — background image, referenced by a stylesheet-relative URL (see gotchas).
- `fonts/` — upstream Nerd Font TTFs (641 MB) used to generate the embedded subsets.
  Only `IosevkaTermSlabNerdFont-{Regular,Bold,Italic,BoldItalic}.ttf` are used.
- Vencord runtime lives in `~/.config/Vencord/dist` — it is the source of truth for how
  themes load (`renderer.js`, `patcher.js`). `~/.config/Vencord/settings/settings.json`
  holds `enabledThemes`, and the themes folder is a symlink:
  `~/.config/Vencord/themes -> /home/jeff/Github/IRcP`.

## How Vencord loads a theme (verified in `~/.config/Vencord/dist`)

- `renderer.js` injects `@import url("vencord:///themes/<file>?v=<Date.now()>")` into a
  `<style id="vencord-themes">`.
- `patcher.js` registers `protocol.handle("vencord")`: `/themes/<rest>` maps to this
  directory with a path-traversal guard, so subfolders are servable for assets.
- **Only the theme file URL carries the cache-buster.** `irc.theme.css` is re-fetched on a
  theme toggle because Vencord appends `?v=<Date.now()>`, but the four `@import` targets
  keep their URL and are served from Chromium's cache. So: edits to `irc.theme.css` (the
  variables) apply on a toggle; edits to anything under `irc/` need a **full app restart**.
  That is the trade-off of the split, and the reason the variables stay in the entry
  point.
- Vencord rewrites the mainFrame CSP (`Cn` in `patcher.js`): adds `vencord:` and `data:`
  to `style-src`, `img-src`, `font-src`, `connect-src`, `media-src`, `worker-src`, and
  forces `Content-Type: text/css` on stylesheet responses. So `vencord://` imports,
  base64 fonts and `vencord://` images are all allowed. CSP is not a suspect.
- The theme list is a **non-recursive** `readdir` filtered to top-level `*.css`, so
  asset subdirectories never show up as themes.

## Gotchas that already cost time

- `url()` inside a **custom property** resolves against the document base
  (`https://discord.com`), not against the stylesheet. That is why the shipped background
  is set in `02-ui.css` as `var(--background-image, url("bg.png"))`: the fallback is a
  normal declaration and resolves next to that file locally and on jsDelivr. An override
  in the entry point must be an absolute URL or it silently 404s.
- Distribution: `raw.githubusercontent.com` serves `.css` as `text/plain` with `nosniff`,
  and Blink refuses that as a stylesheet (verified in Chromium and in Electron: the same
  bytes applied when served `text/css`, ignored when served `text/plain`). SoftX's README
  still advertises a raw Vencord link, but its deployed theme actually works because the
  entry imports `discordstyles.github.io/SoftX/SoftX.css`, which GitHub Pages serves as
  `text/css`. This repo is published from GitHub Pages on the user site's custom domain:
  `https://jeff.is-a.dev/IRcP/irc.theme.css` (a project site inherits the custom domain of
  the account's user site, so no extra DNS is needed). Pages serves `.css` as `text/css`.
  The entry imports the other files with absolute URLs to that deployment, so a single
  downloaded file is enough and jsDelivr is no longer needed.
- Generic custom-property names collide in a live client (observed: `--font` computed to
  `"gg sans", "Noto Sans"` even though only the theme declared it, so something loaded
  later wins). Namespace everything with `--irc-*` and use `!important` for font wiring.
  `--irc-theme: 1` is a marker proving the file parsed.
- Fonts stay base64 `data:` URIs. Do not split them into `.woff2` files: assets would
  need per-file cache busting and the protocol sends no CORS headers.
- Two other styles are active and can outrank this theme when debugging a "rule doesn't
  apply": `~/.config/Vencord/settings/quickCss.css` (DiscordRecolor) and `themeLinks`
  (ClearVision). Both load in stylesheets after/around the theme.

## Discord DOM class hashes

Discord uses BEM-ish hashed classes (`.avatar_c19a55`, `.header_c19a55`, `.wrapper_c19a55`).
The hash changes between builds; a layout rule that silently stops working usually means
the hash moved. To find the current one without logging in:

```bash
curl -s https://discord.com/app -o /tmp/app.html
grep -o '/assets/[a-z0-9]*\.[a-f0-9]*\.css' /tmp/app.html | sort -u > /tmp/css.txt
# download the chunks, then:
grep -l 'cozy' /tmp/dcss/*.css      # the message component lives in exactly one chunk
grep -o '\.[a-z]*_c19a55' FILE.css | sort -u
```

Discord's own rules in that chunk are the reference for the message rows and the forum
list: copy their values instead of inventing them.

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
[getComputedStyle(document.documentElement).getPropertyValue('--irc-theme').trim(),
 getComputedStyle(document.documentElement).getPropertyValue('--font-primary').trim(),
 getComputedStyle(document.body).fontFamily]
```

`--irc-theme` empty means the file did not load; `1` plus `gg sans` means a cascade
fight, not a load failure.

To apply edits: toggle the theme off/on in Vencord (the theme file URL carries the
cache buster). Changes to the imported files always need a full app restart.

## Regenerating the embedded fonts

`pyftsubset` (fonttools + brotli are installed), one run per face, then base64 into
`irc/03-fonts.css`:

```
pyftsubset fonts/IosevkaTermSlabNerdFont-Regular.ttf \
  --unicodes="U+0020-007E,U+00A0-024F,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0300-036F,U+0370-03FF,U+0400-04FF,U+2000-206F,U+20A0-20BF,U+2100-214F,U+2190-21FF,U+2200-22FF,U+2300-23FF,U+2500-257F,U+2580-259F,U+25A0-25FF,U+2C60-2C7F,U+A720-A7FF" \
  --layout-features='ccmp,locl,mark,mkmk,kern' --no-hinting --flavor=woff2 --output-file=regular.woff2
```

Use the plain `IosevkaTermSlabNerdFont-*` builds (Term metrics), not `-Mono` (forces 1ch
on every glyph) or `-Propo` (proportional). Ligatures (`calt`) are intentionally dropped
so `->` and `!=` stay literal in chat.

## Conventions

- Bump `@version` (`2.0.0-irc.N`) on every change so the loaded build is identifiable.
- Keep `THIRD-PARTY-NOTICES.md`. The reused CSS is MIT (the notice and permission text
  must travel with copies or substantial portions) and the embedded font is SIL OFL 1.1
  (the copyright line and the license must accompany the font). Renaming the theme or
  rewriting the comments does not remove those obligations; the theme's own code and
  modifications are still yours.
- `@import` only in `irc.theme.css`, only **absolute URLs to this theme's own Pages
  deployment** (`https://jeff.is-a.dev/IRcP/irc/01-status.css`), and all of them before the
  first rule (CSS requires it). Absolute URLs make the entry self-sufficient: a downloaded
  `irc.theme.css` pulls the layout from Pages and works alone. The cost is that edits to
  the imported files only reach the client after a push; the entry's variables stay
  instant. Never import anything else: the only remote files are the ones this repository
  serves.
