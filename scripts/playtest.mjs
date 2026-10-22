import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('test-results');
mkdirSync(output, { recursive: true });
const cache = process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'ms-playwright') : '';
let executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE;
if (!executablePath && !existsSync(chromium.executablePath()) && existsSync(cache)) {
  for (const folder of readdirSync(cache).filter(name => /^chromium-\d+$/.test(name)).sort().reverse()) {
    const candidate = path.join(cache, folder, 'chrome-win64', 'chrome.exe');
    if (existsSync(candidate)) { executablePath = candidate; break; }
  }
}
const browser = await chromium.launch({ headless: true, executablePath });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const url = `${process.env.GAME_URL || 'http://127.0.0.1:5173'}/?qa`;
const check = async (fn, arg) => page.evaluate(fn, arg);
const capture = async name => page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  assert.equal(await page.locator('canvas').count(), 1);
  await capture('desktop-home');
  assert.equal(await check(() => window.__catGame.getScreen()), 'home');
  await page.waitForTimeout(300);
  assert.equal(await check(() => window.__catGame.battle.time), 0);
  await page.keyboard.press('1');
  assert.equal(await check(() => window.__catGame.battle.armies.player.hired), 0);
  await page.locator('#choose-level').click();
  await page.locator('#level-cardboard').click();
  assert.equal(await page.locator('#level-cardboard').getAttribute('aria-pressed'), 'true');
  assert.equal(await check(() => window.__catGame.battle.time), 0);
  await capture('desktop-levels');
  await page.locator('#level-start').click();
  assert.equal(await check(() => window.__catGame.battle.level.id), 'cardboard');
  await page.locator('#pause').click();
  await page.locator('#pause-home').click();
  assert.equal(await check(() => window.__catGame.getScreen()), 'home');
  await page.locator('#start').click();
  await page.locator('#hire-mouse').click();
  await page.locator('#hire-soldier').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.hired), 2);
  assert.equal(await page.locator('#hire-soldier').isDisabled(), true);
  await page.keyboard.press('p');
  const snapshot = await check(() => JSON.stringify({ a: window.__catGame.battle.armies, t: window.__catGame.battle.time }));
  await page.waitForTimeout(300);
  assert.equal(await check(() => JSON.stringify({ a: window.__catGame.battle.armies, t: window.__catGame.battle.time })), snapshot);
  await page.locator('#help').click();
  assert.equal(await page.locator('#guide').isVisible(), true);
  await page.locator('#guide-close').click();
  assert.equal(await check(() => window.__catGame.battle.phase), 'paused');
  await page.locator('#resume').click();
  await check(() => { const b = window.__catGame.battle; b.aiEnabled = false; b.units = []; b.armies.player.food = 120; window.__catGame.render(); });
  await page.locator('#upgrade-economy').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.economy), 1);
  await check(() => window.__catGame.advance(20));
  await page.locator('#upgrade-tech').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.researching), true);
  await check(() => window.__catGame.advance(15));
  assert.equal(await check(() => window.__catGame.battle.armies.player.tech), 2);
  await check(() => { window.__catGame.battle.armies.player.food = 500; window.__catGame.render(); });
  await page.locator('#hire-shield').click();
  await page.locator('#hire-slinger').click();
  await check(() => { window.__catGame.battle.armies.player.food = 500; window.__catGame.render(); });
  await page.keyboard.press('t');
  await check(() => window.__catGame.advance(20));
  assert.equal(await check(() => window.__catGame.battle.armies.player.tech), 3);
  await check(() => { window.__catGame.battle.armies.player.food = 500; window.__catGame.render(); });
  await page.locator('#hire-catapult').click();
  await page.locator('#hire-healer').click();
  assert.equal(await check(() => window.__catGame.battle.units.some(u => u.kind === 'healer')), true);
  // A representative battle fixture uses the same public recruitment actions as the UI.
  await check(() => {
    const b = window.__catGame.battle; b.units = []; b.effects = [];
    const order = ['mouse', 'soldier', 'shield', 'slinger', 'catapult', 'healer'];
    const positions = [665, 640, 620, 485, 350, 450];
    for (const side of ['player', 'enemy']) {
      const a = b.armies[side]; a.food = 2000; a.tech = 3; a.economy = 2;
      for (let i = 0; i < order.length; i++) {
        a.cooldowns[order[i]] = 0; b.summon(side, order[i]);
        b.units.at(-1).x = side === 'player' ? positions[i] : 1440 - positions[i];
      }
      a.food = side === 'player' ? 248 : 260;
    }
    b.time = 133; b.notify('盾卫保护投手，投石机在后方支援。前线交给猫咪，策略交给你。');
    window.__catGame.advance(1); window.__catGame.render();
  });
  await page.waitForTimeout(300);
  await capture('desktop-battle');
  await check(() => {
    const b = window.__catGame.battle;
    b.units.find(u => u.side === 'enemy' && u.kind === 'shield').x = 300; b.armies.player.roarCooldown = 0;
    window.__catGame.render();
  });
  await page.keyboard.press('Space');
  assert.ok(await check(() => window.__catGame.battle.armies.player.roarCooldown > 44));
  assert.ok(await check(() => window.__catGame.battle.units.some(u => u.side === 'enemy' && u.slow > 0)));
  const shotsBefore = await check(() => window.__catGame.battle.armies.player.cannonShots);
  await check(() => window.__catGame.advance(3));
  assert.ok(await check(() => window.__catGame.battle.armies.player.cannonShots) > shotsBefore);
  assert.match(await page.locator('#cannon-status').textContent(), /85/);
  const categories = await check(() => ['#hire-soldier', '#upgrade-economy', '#upgrade-tech', '#roar'].map(id => getComputedStyle(document.querySelector(id)).backgroundColor));
  assert.equal(new Set(categories).size, 4);
  await capture('desktop-cannon');
  await page.locator('#speed').click();
  assert.equal(await page.locator('#speed').textContent(), '2×');
  await check(() => {
    const b = window.__catGame.battle;
    b.units = b.units.filter(u => u.side === 'player' && u.kind === 'catapult');
    b.units[0].x = 1000; b.units[0].attackCooldown = 0; b.armies.enemy.hp = 100;
    window.__catGame.advance(1);
  });
  assert.equal(await check(() => window.__catGame.battle.winner), 'player');
  await capture('desktop-victory');
  assert.ok(await check(() => JSON.parse(localStorage.getItem('paw-pantry-progress-v1')).cardboard.stars >= 1));
  await page.locator('#next-level').click();
  assert.equal(await check(() => window.__catGame.battle.level.id), 'pantry');
  await page.locator('#pause').click();
  await page.locator('#pause-levels').click();
  assert.match(await page.locator('[data-record="cardboard"]').textContent(), /已通关/);
  await page.locator('#level-start').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.tech), 1);
  assert.equal(await check(() => window.__catGame.battle.units.length), 0);
  // Run a complete losing match from normal starting resources, with the real computer.
  await check(() => { window.__catGame.battle.aiEnabled = true; window.__catGame.advance(480); });
  assert.equal(await check(() => window.__catGame.battle.winner), 'enemy');
  await capture('desktop-defeat');
  await page.locator('#play-again').click();
  assert.equal(await check(() => window.__catGame.battle.phase), 'playing');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  await capture('laptop-home');
  await page.locator('#start').click();
  assert.ok(await check(() => document.querySelector('#roar').getBoundingClientRect().bottom < innerHeight));
  await page.locator('#hire-soldier').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.hired), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  assert.ok(await check(() => document.documentElement.scrollWidth <= window.innerWidth));
  await capture('mobile-ready');
  await page.locator('#start').click();
  await page.locator('#hire-soldier').click();
  assert.equal(await check(() => window.__catGame.battle.armies.player.hired), 1);
  await capture('mobile-battle');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(200);
  assert.ok(await check(() => document.documentElement.scrollWidth <= window.innerWidth));
  await capture('mobile-landscape');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'passed', scenarios: ['home idle', 'level selection', 'menu navigation', 'saved stars', 'next level', 'cannon damage', 'button categories', 'boot', 'recruitment', 'pause', 'guide', 'income upgrade', 'both technology tiers', 'all six units', 'roar', 'speed', 'victory', 'restart', 'full AI defeat', 'laptop controls visible', 'mobile portrait', 'mobile landscape'], browserErrors: errors, screenshots: output }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ browserErrors: errors, url: page.url() }, null, 2));
  await capture('failure');
  throw error;
} finally {
  await browser.close();
}
