// Dev entry point.
//
// bd-scss `dev` starts chokidar and calls compileDev() only from the watcher's 'change'
// event: there is no build on 'ready'. Started as-is it prints "Watching..." and sits
// there until the first save, which looks like a hang (verified in
// node_modules/bd-scss/src/index.ts). So this wrapper starts the watcher, waits for its
// ready banner and then touches a source file once to trigger the initial build. Every
// later save works exactly as upstream.
//
// A Sass error throws inside bd-scss, and the watcher lives in the same process, so the
// whole build dies and the terminal is left with nothing watching. Here the watcher is
// restarted instead: a typo costs one restart, not the session. The restarted watcher is
// deliberately NOT primed, because touching the file again would retry the failing build
// in a loop; the next save is what resumes it.
//
// It also keeps the child in the foreground: Ctrl-C reaches the watcher, and its exit
// code becomes ours.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import config from '../bd-scss.config.js';

const root = path.resolve(import.meta.dirname, '..');
const trigger = path.join(root, 'src', 'main.scss');

// A child that dies before its ready banner never reached the watcher, so the config or
// the binary is wrong and restarting cannot fix it. Three of those and this gives up.
const MAX_START_FAILURES = 3;
const RESTART_DELAY_MS = 200;

// The CSS points at the wallpapers in src/assets by file name, relative to the stylesheet,
// so they have to sit next to the theme file. `build` copies them into dist/; `dev` has no
// such step, so it does the same here.
const themes = path.resolve(root, config.vencord.themeFolder);
const assets = path.join(root, 'src', 'assets');
const wallpaper = /[.](png|jpe?g|webp|avif|gif)$/i;

const copy = (file) => {
  if (wallpaper.test(file)) fs.copyFileSync(path.join(assets, file), path.join(themes, file));
};

fs.mkdirSync(themes, { recursive: true });
for (const file of fs.readdirSync(assets)) copy(file);

// A wallpaper added while the watcher is up has to reach the themes folder too, or the CSS
// points at a file the client never sees.
fs.watch(assets, (_event, file) => {
  if (!file) return;
  try {
    copy(file);
  } catch {
    // `rename` fires after a delete as well; nothing to copy then.
  }
});

let child;
let startFailures = 0;

// `prime` is true only for the first launch: see the restart note above.
const start = (prime) => {
  let banner = '';
  let ready = false;

  const proc = spawn('bd-scss', ['dev'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'inherit'],
    shell: process.platform === 'win32'
  });

  child = proc;

  proc.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    if (ready) return;

    // The ready banner is printed from chokidar's 'ready' handler, right before the
    // watcher blocks. It names both theme folders, so either line means "listening now".
    // Chunks can split mid-line, hence the buffer.
    banner += chunk.toString();
    if (!/Vencord:|BetterDiscord:/.test(banner)) return;
    ready = true;
    if (!prime) return;

    const now = new Date();
    fs.utimesSync(trigger, now, now);
  });

  proc.on('error', (error) => {
    console.error(`[dev] could not start bd-scss: ${error.message}`);
    process.exit(1);
  });

  proc.on('exit', (code, signal) => {
    if (signal) process.exit(0);
    if (code === 0) process.exit(0);

    if (ready) {
      startFailures = 0;
      console.error('\n[dev] the build failed and took the watcher with it. It is up again:');
      console.error('[dev] fix the error and save the file to rebuild.\n');
    } else {
      startFailures += 1;
      if (startFailures >= MAX_START_FAILURES) {
        console.error(`\n[dev] bd-scss died ${startFailures} times before it started watching.`);
        console.error('[dev] check bd-scss.config.js; not restarting again.\n');
        process.exit(code);
      }
      console.error(`\n[dev] bd-scss died before watching; restarting (${startFailures}/${MAX_START_FAILURES}).\n`);
    }

    setTimeout(() => start(false), RESTART_DELAY_MS);
  });
};

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child?.kill(signal));
}

start(true);
