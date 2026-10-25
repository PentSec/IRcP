# IRcP

A Vencord theme that turns Discord into a terminal IRC client: one log line per message,
a clock gutter, monospace type, dim metadata and translucent panels over a wallpaper.

```
13:38 <PentSec> one line per message, with the clock, the nick and the text
13:38 <PentSec> sharing a single baseline
```

## Requirements

- [Vencord](https://vencord.dev) (or Vesktop) on Discord desktop.
- Optional: the **RoleColorEverywhere** plugin, if you want the member-list role headers
  painted with each role's own colour. Discord does not expose that colour otherwise.

## Install

### Online (recommended)

1. Open Discord → **Vencord → Settings → Themes**.
2. Paste this URL into **Online Themes**, one per line:

   ```
   https://jeff.is-a.dev/IRcP/irc.theme.css
   ```

3. Leave the field. The theme applies immediately.

> The theme is served by GitHub Pages (`.css` as `text/css`). Its imports point at the same
> deployment, so a downloaded `irc.theme.css` works on its own. Do not use
> `raw.githubusercontent.com`: it serves `.css` as `text/plain` with `nosniff`, and the
> browser refuses it as a stylesheet.

### Local

1. Download `irc.theme.css`. The single file is enough: its imports point at the hosted
   copy of the layout.
2. Drop it into your Vencord themes directory (Vencord → Themes → *Open Themes Folder*).
3. Enable it in the **Local Themes** list.

The style files under `irc/` are the theme body (layout, font, message rows), not personal
config. They are loaded from `jeff.is-a.dev`, so you do not need to copy them.

## Configuration

Everything worth touching lives in the two `:root` blocks of `irc.theme.css`.

| Variable | What it does | Default |
| --- | --- | --- |
| `--accent` | Theme colour: glows, mentions, categories, unread pills | `hsl(164 100% 45%)` |
| `--glow-intensity` | Strength of every glow; `0` disables them | `1` |
| `--background-image` | Optional override for `irc/bg.png`; must be an absolute URL | *(unset)* |
| `--background-blur` | Blur applied to the background image | `8px` |
| `--opacity` | Opacity of the app panels | `0.78` |
| `--irc-line-height` | Line height of a message row | `1.25` |
| `--irc-ts-width` | Clock column width (`8ch` for a 12-hour clock, `5ch` for 24-hour) | `8ch` |
| `--irc-avatar-size` | Avatar box in a message row; above `1em` the row grows | `1.2em` |
| `--irc-nick-glow` / `--irc-nick-glow-size` | Nickname halo strength and blur | `1` / `6px` |
| `--irc-forum-stamp` | Width of the forum thumbnail column | `3.4em` |
| `--irc-status-*` | Avatar ring sizes and colours | see the file |
| `--members-width`, `--guilds-width`, `--server-icon-size` | Sidebar geometry | see the file |

Variables in `irc.theme.css` apply on a theme toggle. Changes to the imported files
(`irc/*.css`) need a full Discord restart, because Vencord only cache-busts the entry
file.

## Notes

- The font (Iosevka Term Slab) is embedded as base64 subsets, so no font is fetched.
- Forum channels, the Friends tab and the member list are themed as well. Discord moves
  these class hashes between builds, so a layout touch-up may be needed after a large
  Discord update.
- The chat toolbar icons are Tabler outline icons drawn as CSS masks.

## Credits and license

The theme's own code and modifications are by PentSec. It reuses work under these
licenses:

- SoftX, Copyright (c) 2021 DiscordStyles, MIT
- RadialStatus, Copyright (c) 2020 DiscordStyles, MIT
- Iosevka, Copyright (c) 2015-2026 Renzhi Li, SIL OFL 1.1
- Font Awesome Free icons, Copyright Fonticons, Inc., CC BY 4.0

The full texts are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
