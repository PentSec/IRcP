// Dev entry point.
//
// bd-scss `dev` starts chokidar and calls compileDev() only from the watcher's 'change'
// event: there is no build on 'ready'. Started as-is it prints "Watching..." and sits
// there until the first save, which looks like a hang (verified in
// node_modules/bd-scss/src/index.ts). So this wrapper starts the watcher, waits for its
// ready banner and then touches a source file once to trigger the initial build. Every
// later save works exactly as upstream.
//
// It also keeps the child in the foreground: Ctrl-C reaches the watcher, and its exit
// code becomes ours.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

import config from '../bd-scss.config.js';

const root = path.resolve(import.meta.dirname, '..');
const trigger = path.join(root, 'src', 'main.scss');

// The CSS points at url("bg.png"), relative to the stylesheet, so the background has to
// sit next to the theme file. `build` copies it into dist/; `dev` has no such step.
const themes = path.resolve(root, config.vencord.themeFolder);
const background = path.join(root, 'src', 'assets', 'bg.png');
fs.mkdirSync(themes, { recursive: true });
fs.copyFileSync(background, path.join(themes, 'bg.png'));

const child = spawn('bd-scss', ['dev'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
  shell: process.platform === 'win32'
});

let primed = false;
let banner = '';

child.stdout.on('data', (chunk) => {
  process.stdout.write(chunk);
  if (primed) return;

  // The ready banner is printed from chokidar's 'ready' handler, right before the
  // watcher blocks. It names both theme folders, so either line means "listening now".
  // Chunks can split mid-line, hence the buffer.
  banner += chunk.toString();
  if (!/Vencord:|BetterDiscord:/.test(banner)) return;
  primed = true;

  const now = new Date();
  fs.utimesSync(trigger, now, now);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('error', (error) => {
  console.error(`[dev] could not start bd-scss: ${error.message}`);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  process.exit(signal ? 0 : (code ?? 0));
});
