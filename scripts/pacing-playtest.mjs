import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.resolve('test-results/pacing'); mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [], captures = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const capture = async name => {
  const frame = await page.evaluate(() => window.__catGame.getView().renderFrame);
  await page.waitForFunction(frame => window.__catGame.getView().renderFrame > frame + 1, frame);
  await page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true });
  captures.push({ name, state: await state() });
};
// Controlled time/position fixtures isolate the UI and recruitment gate. The
// 540 normal-resource matches are measured separately by pacing-balance.mjs.
const setupWindow = () => page.evaluate(() => {
  const b = window.__catGame.battle;
  b.reset('campaign-06'); b.start(); b.time = 70;
  b.level = { ...b.level, economyAt: [], techAt: [] };
  b.summon('player', 'soldier');
  window.advanceTime(10100);
  const foe = b.units.find(u => u.side === 'enemy'), ally = b.units.find(u => u.side === 'player');
  Object.assign(foe, { x: 650, row: 1, attackCooldown: 0 });
  Object.assign(ally, { x: 634, row: 1, attackCooldown: 0 });
  b.messageUntil = 0; window.__catGame.render();
  return { food: b.armies.enemy.food, hp: ally.hp, hired: b.armies.enemy.hired };
});

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' }); await advance(0);
  await page.locator('#start').click(); await advance(0);
  assert.equal((await state()).reinforcement.schedule.rest, 12);
  assert.match(await page.locator('#reinforcement-status').textContent(), /首波敌人/);
  // Seed completed tutorial stages, then exercise the actual unlocked stage flow.
  await page.addInitScript(() => {
    if(!sessionStorage.getItem('pacing-fixture')) {
      localStorage.setItem('paw-pantry-progress-qa-v3', JSON.stringify({ version: 2,
        campaign: Object.fromEntries([1,2,3,4,5].map(n => [`campaign-0${n}`, { stars: 3, bestTime: 200, ratingVersion: 2 }])) }));
      sessionStorage.setItem('pacing-fixture','1');
    }
  });
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#loading').waitFor({ state: 'detached' });
  await advance(0); await page.locator('#start').click(); await advance(0);
  await page.locator('#pause').click(); await page.locator('#restart').click(); await advance(0);
  assert.equal((await state()).reinforcement.schedule.rest, 10);
  const initial = await setupWindow(); let s = await state();
  assert.ok(initial.hired > 0); assert.equal(s.reinforcement.regrouping, true); assert.equal(s.reinforcement.continuous, false);
  assert.match(await page.locator('#reinforcement-status').textContent(), /敌军整备 · 10秒后增援/);
  assert.match(await page.locator('#field-message').textContent(), /场上敌人仍在战斗/);
  await capture('rest-390');
  await page.locator('#upgrade-tech').click(); await advance(0);
  assert.equal((await state()).player.researching, true);
  await page.locator('#pause').click(); await advance(0); const paused = await state();
  const text = await page.locator('#reinforcement-status').textContent(); await advance(6000);
  assert.deepEqual(await state(), paused); assert.equal(await page.locator('#reinforcement-status').textContent(), text);
  await page.locator('#resume').click(); await advance(9700); s = await state();
  assert.equal(s.reinforcement.regrouping, true); assert.equal(s.enemy.hired, initial.hired); assert.equal(s.player.tech, 2);
  const foodAfter = await page.evaluate(() => window.__catGame.battle.armies.enemy.food);
  assert.ok(Math.abs(foodAfter - initial.food - 12 * 9.7) < .001);
  assert.ok(s.units.find(u => u.side === 'player')?.hp < initial.hp || !s.units.some(u => u.side === 'player'));
  await advance(3000); s = await state(); assert.equal(s.reinforcement.regrouping, false); assert.ok(s.enemy.hired > initial.hired);
  assert.match(await page.locator('#reinforcement-status').textContent(), /敌方增援/); await capture('recruitment-resumed');
  for (const [width, height] of [[320,568],[844,390],[1440,900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await setupWindow(); await advance(0);
    const layout = await page.evaluate(() => {
      const badge = document.querySelector('.arena-badge'), r = badge.getBoundingClientRect();
      const arena = document.querySelector('.arena-frame').getBoundingClientRect();
      return { x: r.x, right: r.right, y: r.y, bottom: r.bottom, visible: getComputedStyle(badge).display !== 'none',
        clipped: badge.scrollWidth > badge.clientWidth, overflow: document.documentElement.scrollWidth > innerWidth,
        arena: { x: arena.x, right: arena.right, y: arena.y, bottom: arena.bottom } };
    });
    assert.ok(layout.visible); assert.equal(layout.clipped, false); assert.equal(layout.overflow, false);
    assert.ok(layout.x >= layout.arena.x && layout.right <= layout.arena.right && layout.y >= layout.arena.y && layout.bottom <= layout.arena.bottom);
    await capture(`rest-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
  const ids = await page.evaluate(() => {
    const b = window.__catGame.battle; b.reset('campaign-06'); b.start(); b.aiEnabled = false;
    b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000;
    const spawn = (side, kind, x) => {
      b.armies[side].food = 10000; b.armies[side].tech = 3;
      b.summon(side, kind); const u = b.units.at(-1); Object.assign(u, { x, row: 1, attackCooldown: 10000 }); return u;
    };
    const cat = spawn('player', 'assassin', 600), old = spawn('enemy', 'soldier', 616), rear = spawn('enemy', 'slinger', 1050);
    old.attackCooldown = 0; cat.attackCooldown = 0; window.advanceTime(20);
    return { cat: cat.id, old: old.id, rear: rear.id };
  });
  await advance(2900); s = await state(); let cat = s.units.find(u => u.id === ids.cat);
  assert.ok(cat.stealthSeconds > 0); assert.equal(cat.targetId, null); await capture('assassin-hidden');
  await advance(150); s = await state(); cat = s.units.find(u => u.id === ids.cat);
  assert.equal(cat.stealthSeconds, 0); assert.equal(cat.targetId, ids.rear); const x = cat.x;
  await advance(300); assert.ok((await state()).units.find(u => u.id === ids.cat).x > x); await capture('assassin-forward');
  await page.locator('#pause').click(); await page.locator('#restart').click(); await advance(0); s = await state();
  assert.equal(s.time, 0); assert.equal(s.reinforcement.regrouping, false); assert.equal(s.enemy.hired, 0); assert.equal(s.units.length, 0);
  assert.equal(s.player.tech, 1); assert.match(await page.locator('#reinforcement-status').textContent(), /首波敌人/);
  await page.locator('#help').click(); assert.match(await page.locator('#guide').textContent(), /交替增援与整备/);
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({ status: 'passed', engine, scope: 'Controlled fixtures, not normal-resource balance evidence', scenarios: ['two chapter cadences', 'rest UI and existing combat', 'income and research continue', 'pause, resume, restart', 'four viewport sizes', 'assassin stealth to forward pursuit', 'guide'], captures, errors }, null, 2));
  console.log(`PASS ${engine}: regrouping UI, recruitment, economy, pause, restart, four viewports and assassin pursuit`);
} finally { await browser.close(); }
