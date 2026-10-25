# Contributing

Thanks for looking. This is a small theme; the rules below keep it reviewable.

## Prerequisites

- [bun](https://bun.sh) — the only package manager used here. Do not commit
  `package-lock.json`, `pnpm-lock.yaml` or `yarn.lock`.
- Basic SCSS. The build is `bd-scss`: `src/root.scss` becomes `irc.theme.css`, and
  `src/main.scss` becomes `irc.css`.
- To test in the client: Vencord (or Vesktop) on Discord desktop.

```bash
bun install
bun run dev
```

`dev` builds immediately and then on every change under `src/`: a single self-contained
`irc.theme.css` (fonts and layout inlined) in your client's themes folder. Enable it once
in Vencord → Themes → Local Themes. If the client's folder cannot be found, the output
goes to `.dev/`.

## Where things go

| Path                     | Holds                                                        |
| ------------------------ | ------------------------------------------------------------ |
| `src/root.scss`          | user variables only, the block at the top of `irc.theme.css` |
| `src/theme/_tokens.scss` | internal custom properties                                   |
| `src/theme/app/`         | background, titlebar, toolbar, window controls               |
| `src/theme/serverlist/`  | guild rail                                                   |
| `src/theme/sidebar/`     | channel and DM lists, user panel                             |
| `src/theme/chat/`        | message area, composer, dividers, notices, mentions          |
| `src/theme/members/`     | member list and role groups                                  |
| `src/theme/popouts/`     | popouts                                                      |
| `src/theme/messages/`    | message rows                                                 |
| `src/theme/forum/`       | forum posts                                                  |
| `src/theme/status/`      | presence rings                                               |
| `src/theme/_wiring.scss` | font wiring; not configuration                               |
| `src/addons/_fonts.scss` | embedded font, generated (do not hand-edit)                  |

Each folder has an `index.scss`; it lists its partials with `@forward` in cascade order. A
file that is not forwarded is not compiled.

Rules:

- **`src/root.scss` is for values, not rules.** If it needs a selector, it belongs in a
  partial.
- **Keep the `@use` order in `src/main.scss`.** It is the cascade.
- **Prefix theme variables with `--irc-`.** Discord owns most generic names; a live client
  will win the cascade and the variable will silently read Discord's value.
- **Never remove a notices file.** `THIRD-PARTY-NOTICES.md` and the `Derived from …`
  headers in the partials are license obligations, not decoration.
- **Do not commit build output.** `dist/` and the dev file at the repository root are
  generated; both are in `.gitignore`.

## Discord class hashes

Discord ships BEM-ish hashed classes (`.avatar_c19a55`, `.header_c19a55`). A layout rule
that stops working usually means the hash moved. Use `bun run reroll`, which applies the
community class map to `src/**/_*.scss`, then check the result in the client.

## Testing

There is no test suite. The checks are:

1. `bun run build` succeeds and `dist/` contains `irc.theme.css`, `irc.css`, `fonts.css`,
   `bg.png` and `.nojekyll`.
2. `bun run format:check` passes.
3. The theme still renders in the client. When a selector stops matching, open DevTools,
   copy the offending element (Elements → right click → Copy → Copy outerHTML) and paste it
   in the issue: the real DOM is the only reliable reference.

## Commits and pull requests

- One concern per commit. Formatting changes go in their own commit, never mixed with a
  behaviour change.
- Conventional Commits (`fix:`, `feat:`, `docs:`, `style:`, `refactor:`, `ci:`, `chore:`).
- No AI attribution trailers.
- Bump `meta.version` in `bd-scss.config.js` on every change, so the loaded build is
  identifiable in the client.

Pushing to `main` builds and publishes to the `deploy` branch. `deploy` is never edited by
hand.
