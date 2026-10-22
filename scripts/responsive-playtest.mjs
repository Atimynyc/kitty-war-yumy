import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const output = path.resolve('test-results/responsive');
mkdirSync(output, { recursive: true });
const engine = process.env.TEST_BROWSER || 'chromium';
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const report = { engine, sizes: [], errors: [] };
const selectedCases = process.argv.slice(2);
const cases = [
  ['tiny-portrait', 320, 568, 2], ['android-small', 360, 640, 2],
  ['iphone-se', 375, 667, 2], ['iphone-mini', 375, 812, 3], ['iphone-14', 390, 844, 3],
  ['android-tall', 412, 915, 2.625], ['iphone-max', 430, 932, 3],
  ['fold-cover', 344, 882, 2], ['fold-open', 540, 720, 2],
  ['tablet-mini', 768, 1024, 2], ['tablet-pro', 1024, 1366, 2],
  ['tiny-landscape', 568, 320, 2], ['iphone-landscape', 844, 390, 3],
  ['android-landscape', 915, 412, 2.625], ['tablet-landscape', 1024, 768, 2],
  ['laptop', 1280, 800, 1], ['desktop', 1440, 900, 1],
];
const inspect = async page => page.evaluate(() => {
  const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  const selectors = ['#sound', '#help', '#pause', '#speed', ...Array.from(document.querySelectorAll('.unit-card')).map(e => `#${e.id}`), '#upgrade-economy', '#upgrade-tech', '#roar'];
  return {
    layout: document.documentElement.dataset.layout, viewport: { width: innerWidth, height: innerHeight },
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    arena: rect(document.querySelector('.arena-frame')), canvas: rect(document.querySelector('canvas')),
    view: window.__catGame.getView(),
    controls: selectors.map(selector => ({ selector, ...rect(document.querySelector(selector)) })),
  };
});
const waitForRedraw = async page => {
  const frame = await page.evaluate(() => window.__catGame.getView().renderFrame);
  await page.waitForFunction(previous => window.__catGame.getView().renderFrame >= previous + 2, frame, { timeout: 5000 });
};
const assertPainted = async (page, name) => {
  const png = await page.locator('canvas').screenshot();
  const colors = await page.evaluate(async data => {
    const image = new Image(); image.src = `data:image/png;base64,${data}`; await image.decode();
    const sample = document.createElement('canvas'); sample.width = 16; sample.height = 16;
    const context = sample.getContext('2d'); context.drawImage(image, 0, 0, 16, 16);
    const pixels = context.getImageData(0, 0, 16, 16).data, unique = new Set();
    for (let i = 0; i < pixels.length; i += 4) unique.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`);
    return unique.size;
  }, png.toString('base64'));
  assert.ok(colors > 8, `${name}: battlefield has not painted (${colors} colors)`);
};
function validate(info, name) {
  assert.ok(info.scroll.width <= info.viewport.width + 1, `${name}: horizontal overflow`);
  assert.ok(info.arena.height >= 150, `${name}: arena too short (${info.arena.height})`);
  assert.ok(Math.abs(info.canvas.width - info.arena.width) <= 3, `${name}: canvas width mismatched`);
  assert.ok(Math.abs(info.canvas.height - info.arena.height) <= 3, `${name}: canvas height mismatched`);
  if (info.layout !== 'desktop') {
    assert.ok(info.scroll.height <= info.viewport.height + 1, `${name}: vertical overflow ${info.scroll.height}/${info.viewport.height}`);
    for (const control of info.controls) {
      assert.ok(control.width >= 43 && control.height >= 43, `${name}: small target ${control.selector} (${control.width}×${control.height})`);
      assert.ok(control.x >= -1 && control.y >= -1 && control.right <= info.viewport.width + 1 && control.bottom <= info.viewport.height + 1, `${name}: clipped ${control.selector}`);
    }
    for (let a = 0; a < info.controls.length; a++) for (let b = a + 1; b < info.controls.length; b++) {
      const x = info.controls[a], y = info.controls[b];
      assert.ok(!(Math.min(x.right, y.right) - Math.max(x.x, y.x) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.y, y.y) > 1), `${name}: overlapping targets ${x.selector}/${y.selector}`);
    }
  }
  if (info.layout === 'portrait') {
    assert.equal(info.view.orientation, 'vertical');
    assert.ok(info.view.player.y > info.view.enemy.y);
    assert.ok(info.view.unitSize >= 28);
  } else assert.equal(info.view.orientation, 'horizontal');
}
const fixture = () => {
  const b = window.__catGame.battle; b.aiEnabled = false; b.units = []; b.effects = [];
  const kinds = ['mouse', 'soldier', 'shield', 'slinger', 'catapult', 'healer'];
  const positions = [665, 625, 580, 465, 330, 400];
  for (const side of ['player', 'enemy']) {
    const a = b.armies[side]; a.food = 2000; a.tech = 3;
    for (let i = 0; i < kinds.length; i++) { a.cooldowns[kinds[i]] = 0; b.summon(side, kinds[i]); b.units.at(-1).x = side === 'player' ? positions[i] : 1440 - positions[i]; }
    a.food = 250;
  }
  b.time = 130; b.phase = 'paused'; window.__catGame.render();
};
try {
  for (const [name, width, height, dpr] of cases.filter(([name]) => !selectedCases.length || selectedCases.includes(name))) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, hasTouch: width < 1101, isMobile: width < 1101 });
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(`${name}: ${error.message}`));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(`${name}: ${msg.text()}`); });
    try {
      await page.goto('http://127.0.0.1:5173/?qa', { waitUntil: 'networkidle' });
      await page.locator('#loading').waitFor({ state: 'detached' });
      await page.waitForTimeout(100);
      assert.equal(await page.evaluate(() => window.__catGame.battle.time), 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({ path: path.join(output, `${engine}-${name}-home.png`) });
      await page.locator('#choose-level').click();
      await page.locator('#level-sunroom').click();
      await page.screenshot({ path: path.join(output, `${engine}-${name}-levels.png`) });
      await page.locator('#level-start').click();
      await page.waitForTimeout(120);
      const ready = await inspect(page); validate(ready, name);
      await page.waitForFunction(() => window.__catGame.battle.phase === 'playing', null, { timeout: 5000 });
      await page.locator('#hire-soldier').click();
      assert.equal(await page.evaluate(() => window.__catGame.battle.armies.player.hired), 1);
      await page.evaluate(fixture);
      await page.locator('#resume').click();
      await page.waitForTimeout(100);
      await waitForRedraw(page);
      const info = await inspect(page); validate(info, name);
      await assertPainted(page, name);
      await page.screenshot({ path: path.join(output, `${engine}-${name}-battle.png`) });
      // A human press can span several HUD updates; its target must remain mounted.
      await page.locator('#pause').click({ delay: 140 });
      await page.waitForFunction(() => window.__catGame.battle.phase === 'paused');
      const snapshot = await page.evaluate(() => JSON.stringify({ armies: window.__catGame.battle.armies, units: window.__catGame.battle.units, time: window.__catGame.battle.time }));
      await page.setViewportSize({ width: height, height: width });
      await page.waitForTimeout(180);
      await waitForRedraw(page);
      validate(await inspect(page), `${name}-rotated`);
      assert.equal(await page.evaluate(() => JSON.stringify({ armies: window.__catGame.battle.armies, units: window.__catGame.battle.units, time: window.__catGame.battle.time })), snapshot);
      await page.setViewportSize({ width, height }); await page.waitForTimeout(100);
      await page.locator('#resume').click();
      await page.locator('#roar').click();
      assert.ok(await page.evaluate(() => window.__catGame.battle.armies.player.roarCooldown > 44));
      if (name === 'iphone-14' || name === 'tiny-portrait') {
        await page.locator('#help').click();
        assert.equal(await page.locator('#guide').isVisible(), true);
        await page.locator('#guide-close').click();
        await page.evaluate(() => { const b = window.__catGame.battle; b.winner = 'player'; b.armies.enemy.hp = 0; b.phase = 'ended'; window.__catGame.render(); });
        const button = await page.locator('#play-again').boundingBox();
        assert.ok(button.y >= 0 && button.y + button.height <= height);
        await page.screenshot({ path: path.join(output, `${engine}-${name}-result.png`) });
        await page.locator('#play-again').click();
        assert.equal(await page.evaluate(() => window.__catGame.battle.phase), 'playing');
        // Emulate occupied safe areas and a collapsed browser's changing available height.
        await page.addStyleTag({ content: ':root { --safe-top: 47px; --safe-bottom: 34px; --safe-left: 0px; --safe-right: 0px; }' });
        await page.setViewportSize({ width, height: height - 60 }); await page.waitForTimeout(150);
        await waitForRedraw(page);
        validate(await inspect(page), `${name}-safe-area-toolbar`);
        await assertPainted(page, `${name}-safe-area-toolbar`);
        await page.screenshot({ path: path.join(output, `${engine}-${name}-safe-area.png`) });
      }
      if (name === 'iphone-landscape') {
        await page.addStyleTag({ content: ':root { --safe-left: 47px; --safe-right: 47px; --safe-top: 0px; --safe-bottom: 21px; }' });
        await page.waitForTimeout(120);
        await waitForRedraw(page);
        validate(await inspect(page), `${name}-safe-sides`);
        await assertPainted(page, `${name}-safe-sides`);
        await page.screenshot({ path: path.join(output, `${engine}-${name}-safe-area.png`) });
      }
      report.sizes.push({ name, width, height, dpr, layout: info.layout, battlefield: [Math.round(info.arena.width), Math.round(info.arena.height)], unitPixels: Math.round(info.view.unitSize) });
      console.log(`PASS ${engine} ${name} ${width}×${height}`);
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${engine}-${name}-failure.png`), fullPage: true });
      console.error(JSON.stringify(await inspect(page), null, 2));
      console.error(JSON.stringify(report.errors));
      throw error;
    } finally { await context.close(); }
  }
  assert.deepEqual(report.errors, []);
  writeFileSync(path.join(output, `${engine}${selectedCases.length ? '-focused' : ''}-report.json`), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
