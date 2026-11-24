// Capture the README screenshots with headless Chrome over the DevTools protocol.
// Usage: node tools/capture_screenshots.mjs [outDir] [url]
// Needs Google Chrome and a static server for the game, e.g. python3 -m http.server 8123.
// SEED (and SEED_7X7 for the 7x7 scene) pick the reproducible random games; the defaults
// show only everyday words. DEBUG_WORDS=1 prints the words played in each screenshot.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [outDir = 'screenshots', url = 'http://localhost:8123/'] = process.argv.slice(2);
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'balda-chrome-'));
const port = 9333;
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', 'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const page = targets.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch (e) { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

const ws = new WebSocket(await connect());
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const listeners = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  } else if (msg.method) {
    listeners.forEach((l) => l(msg));
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, { resolve, reject });
  ws.send(JSON.stringify({ id: i, method, params }));
});
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

await send('Page.enable');
await send('Runtime.enable');
// Seeded Math.random so the screenshots are reproducible.
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
  (() => { let s = ${Number(process.env.SEED || 5)}; Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; window.__reseed = (n) => { s = n; }; })();
  window.confirm = () => true;
` });

async function load(width, height, scheme, mobile = false) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: scheme }] });
  await evaluate('try { localStorage.clear() } catch (e) {}');
  const loaded = new Promise((r) => listeners.push(function f(m) {
    if (m.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(f), 1); r(); }
  }));
  await send('Page.navigate', { url });
  await loaded;
  await sleep(300);
}

async function shot(name, height) {
  await sleep(500); // let CSS transitions settle
  const params = { format: 'png' };
  if (height) params.clip = { x: 0, y: 0, width: await evaluate('innerWidth'), height, scale: 1 };
  const { data } = await send('Page.captureScreenshot', params);
  writeFileSync(join(outDir, name), Buffer.from(data, 'base64'));
  console.log('saved', join(outDir, name), process.env.DEBUG_WORDS ? await evaluate("balda.state ? balda.state.words.player.concat(balda.state.words.pc).join(',') : ''") : '');
}

// Helpers injected into the page: start a game and play moves through the real UI controls.
const HELPERS = `
  window.$h = {
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    cells: () => [...document.querySelectorAll('.cell')],
    key: (l) => document.querySelector('.key[data-letter="' + l + '"]').click(),
    async start(name, size = 5) {
      document.getElementById('player-name').value = name;
      document.getElementById('board-size').value = String(size);
      document.querySelector('#start-form button[type=submit]').click();
      while (document.getElementById('start-dialog').open) await this.sleep(50);
    },
    pickMove(minLen) {
      const moves = balda.findMoves().sort((a, b) => a.word.length - b.word.length);
      return moves.find((m) => m.word.length >= minLen) || moves[moves.length - 1];
    },
    prepare(move, steps) {
      const cells = this.cells();
      cells[move.cell].click();
      this.key(move.letter);
      move.path.slice(0, steps ?? move.path.length).forEach((c) => cells[c].click());
    },
    async play(minLen) {
      const move = this.pickMove(minLen);
      this.prepare(move);
      document.getElementById('submit').click();
      while (balda.state.phase === 'ai') await this.sleep(50);
    }
  };
`;

// 1. Start screen (light)
await load(900, 820, 'light');
await evaluate(`document.getElementById('player-name').value = 'Νίκος'; document.querySelector('.rules').open = true;`);
await shot('start.png');

// 2. Mid-game: spelling a word (light)
await load(900, 820, 'light');
await evaluate(HELPERS + `(async () => {
  await $h.start('Νίκος');
  for (const len of [4, 5, 4, 5]) await $h.play(len);
  $h.prepare($h.pickMove(6));
})()`);
await shot('move.png');

// 3. After the computer's reply (light): its word is highlighted
await load(900, 820, 'light');
await evaluate(HELPERS + `(async () => {
  await $h.start('Νίκος');
  for (const len of [4, 5, 4, 5, 6, 5]) await $h.play(len);
})()`);
await shot('game.png');

// 4. Phone, dark theme, choosing a letter
await load(390, 844, 'dark', true);
await evaluate(HELPERS + `(async () => {
  await $h.start('Νίκος');
  for (const len of [4, 5, 5]) await $h.play(len);
  const m = $h.pickMove(5);
  $h.prepare(m, 3);
})()`);
await shot('mobile-dark.png');

// 5. Game over
await load(900, 820, 'light');
await evaluate(HELPERS + `(async () => {
  await $h.start('Νίκος');
  while (balda.state.phase !== 'over') {
    if (!balda.findMoves().length) { document.getElementById('pass').click(); while (balda.state.phase === 'ai') await $h.sleep(50); continue; }
    await $h.play(6);
  }
})()`);
await shot('game-over.png');

// 6. A 7x7 board mid-game (light)
await load(900, 900, 'light');
await evaluate(HELPERS + `(async () => {
  __reseed(${Number(process.env.SEED_7X7 || 4)});
  await $h.start('Νίκος', 7);
  for (const len of [5, 6, 5, 6, 5, 6]) await $h.play(len);
})()`);
await shot('board-7x7.png');

ws.close();
chrome.kill();
