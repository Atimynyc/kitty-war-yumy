import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.env.TEST_BROWSER || 'chromium';
const output = path.resolve('test-results/campaign30'); mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [], stages = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const capture = name => page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true });
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const finish = (hp = 3000, winner = 'player') => page.evaluate(({ hp, winner }) => {
  const b = window.__catGame.battle; b.aiEnabled = false; b.units = []; b.effects = []; b.projectiles = [];
  b.time = 120; b.armies.player.hp = hp;
  if (winner === 'player') {
    b.armies.enemy.hp = 1; b.armies.player.food = 1000; b.armies.player.cooldowns.soldier = 0;
    b.summon('player', 'soldier'); Object.assign(b.units.at(-1), { x: 1265, row: 1, attackCooldown: 0 });
  } else { b.armies.player.hp = 0; b.armies.enemy.hp = winner === 'draw' ? 0 : 3000; }
  window.advanceTime(1000 / 30);
}, { hp, winner });
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('paw-pantry-progress-qa-v3')));
const url = `${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`;
try {
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('campaign-fixture')) {
      localStorage.setItem('paw-pantry-progress-qa-v3',JSON.stringify({sunroom:{stars:3,bestTime:60},pantry:{stars:2,bestTime:230,ratingVersion:2}}));
      sessionStorage.setItem('campaign-fixture','1');
    }
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.locator('#choose-level').click();
  assert.equal(await page.locator('.stage-map:not([hidden]) .stage-node').count(), 5);
  assert.match(await page.locator('#legacy-records').textContent(), /阳光客厅.*3 星（旧评分）/);
  await page.locator('#level-campaign-02').click(); assert.equal(await page.locator('#level-start').isDisabled(), true);
  await page.locator('[data-chapter="6"]').click(); assert.equal(await page.locator('#level-start').isDisabled(), true);
  assert.equal((await state()).campaign.selectedUnlocked, false);
  await capture('locked-chapter');
  for (const size of [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(size);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('.chapter-tab, .stage-map:not([hidden]) .stage-node')].every(el => {
      const r = el.getBoundingClientRect(); return r.width >= 43 && r.height >= 43 && r.left >= 0 && r.right <= innerWidth;
    })), `chapter/stage touch targets at ${size.width}`);
    await capture(`select-${size.width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-chapter="1"]').click(); await page.locator('#level-campaign-01').click();
  await capture('chapter-1'); await page.locator('#level-start').click(); await advance(0);
  const scenes = ['sunroom', 'cardboard', 'kitchen', 'balcony', 'rooftop', 'pantry'];
  for (let stage = 1; stage <= 30; stage++) {
    const id = `campaign-${String(stage).padStart(2, '0')}`, scene = scenes[Math.floor((stage - 1) / 5)];
    assert.equal((await state()).level, id); await advance(0);
    await page.waitForFunction(scene => document.querySelector('canvas').dataset.scene === scene, scene);
    const grace = await page.evaluate(() => window.__catGame.battle.level.grace);
    await advance((grace - .1) * 1000); assert.equal((await state()).enemy.hired, 0);
    await advance(200); assert.ok((await state()).enemy.hired > 0);
    if ((stage - 1) % 5 === 0) await capture(`scene-${scene}`);
    if (stage === 1) {
      await page.locator('#pause').click(); const before = await state(); await advance(10000); assert.equal((await state()).time, before.time);
      await page.locator('#restart').click(); await advance(0); assert.equal((await state()).time, 0);
      for (const [hp, stars] of [[1500, 2], [1499, 1], [2999.9, 2], [3000, 3], [1, 1]]) {
        await finish(hp); assert.equal((await state()).result.stars, stars); await page.locator('#play-again').click();
      }
      const beforeLoss = await saved();
      for (const winner of ['enemy', 'draw']) { await finish(0, winner); assert.equal(await page.locator('#next-level').count(), 0); const afterLoss=await saved(); assert.deepEqual(afterLoss.campaign, beforeLoss.campaign); assert.deepEqual(afterLoss.legacy,beforeLoss.legacy); assert.equal(afterLoss.run,null); await page.locator('#play-again').click(); }
    }
    if (stage === 30) {
      await page.evaluate(() => { const b = window.__catGame.battle; b.armies.enemy.hp = 899; window.advanceTime(1000 / 30); });
      assert.equal((await state()).boss.spawned, true); await capture('final-boss');
    }
    await finish(stage === 30 ? 1 : 3000);
    const record = await saved(); assert.equal(record.version, 4); assert.ok(record.campaign[id].stars >= 1);
    assert.deepEqual(record.legacy.sunroom, { stars: 3, bestTime: 60 });
    assert.deepEqual(record.legacy.pantry, { stars: 2, bestTime: 230, ratingVersion: 2 });
    if (stage % 5 === 0) { assert.match(await page.locator('.chapter-reward').textContent(), /守护纪念章/); await capture(`chapter-${stage / 5}-complete`); }
    stages.push({ stage, scene, grace, stars: record.campaign[id].stars });
    if (stage < 30) await page.locator('#next-level').click();
  }
  assert.equal(await page.locator('#next-level').count(), 0);
  assert.match(await page.locator('.result-card h2').textContent(), /三十次守护/);
  await page.setViewportSize({ width: 320, height: 568 }); await capture('final-tiny');
  assert.ok(await page.evaluate(() => ['#play-again', '#result-levels'].every(selector => { const r = document.querySelector(selector).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; })));
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#loading').waitFor({ state: 'detached' });
  assert.equal(await page.locator('#home-cleared').textContent(), '30 / 30');
  await page.locator('#choose-level').click();
  assert.equal(await page.locator('[data-chapter="6"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#level-start').isDisabled(), false);
  await capture('all-cleared'); assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({ status: 'passed', engine, stages, scenarios: ['30 consecutive clears and reload', 'legacy save migration', 'locked previews', 'six scene transitions without resizing', 'all first wave timings', 'star boundaries and best rating', 'loss/draw no progress', 'pause/restart', 'chapter rewards', 'final boss and final ending', '320px/phone/landscape/desktop menu'], errors }, null, 2));
  console.log(`PASS ${engine}: 30-stage campaign, six scenes, saves and chapter navigation`);
} finally { await browser.close(); }
