import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.resolve('test-results/specialists'); mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errors = []; page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const paint = async () => { const frame = await page.evaluate(() => window.__catGame.getView().renderFrame); await page.waitForFunction(frame => window.__catGame.getView().renderFrame > frame + 1, frame); };
const capture = async name => { await paint(); await page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true }); };
const foodFor = async cost => { const s = await state(); if (s.player.food < cost) await advance(Math.ceil((cost - s.player.food) / s.player.income * 1000) + 10); };
const fixture = async kind => {
  await page.evaluate(({ kind }) => {
    const b = window.__catGame.battle; b.reset(undefined,Object.keys(b.armies.player.cooldowns)); b.start(); b.aiEnabled = false;
    b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 10000;
    const add = (side, type, x, row = 1) => {
      b.armies[side].food = 10000; b.armies[side].tech = 3; b.armies[side].cooldowns[type] = 0;
      if (!b.summon(side, type)) throw new Error(`Cannot spawn ${side}:${type}`);
      const u = b.units.at(-1); Object.assign(u, { x, row, targetRow: row, attackCooldown: 10000 }); return u;
    };
    const a = add('player', kind, 600), near = ['kungfu', 'assassin', 'boxer', 'umbrella'].includes(kind);
    a.attackCooldown = kind === 'assassin' ? 10000 : 0;
    const foe = add('enemy', kind === 'assassin' || kind === 'kungfu' ? 'soldier' : kind === 'hook' ? 'slinger' : 'shield', near ? 616 : 790);
    if (kind === 'assassin' || kind === 'kungfu') foe.attackCooldown = 0;
    if (kind === 'drummer' || kind === 'umbrella') add('player', 'soldier', 650, 1.3);
    if (kind === 'hook') add('enemy', 'shield', 700);
    window.__catGame.render();
  }, { kind }); await advance(0);
};
try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const roster = await page.evaluate(async () => {
    const { unitSVG } = await import('/src/art.ts'), { UNITS, SPECIALIST_ORDER } = await import('/src/game/content.ts');
    return ['catapult', ...SPECIALIST_ORDER].map(kind => ({ kind, ...UNITS[kind], svg: unitSVG(kind) }));
  });
  const board = await browser.newPage({ viewport: { width: 1050, height: 1050 } });
  await board.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f7f0df;color:#655345;font-family:'Microsoft YaHei',sans-serif}h1{margin:0 0 8px;font-size:28px}p{margin:0 0 24px;color:#8d7b60;font-size:13px}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.card{background:#fffaf0;border:1px solid #ddcfb5;border-radius:20px;text-align:center;padding:14px}img{width:180px;height:180px;display:block;margin:auto}.role{font-size:12px;color:#8f9772}h2{font-size:19px;margin:5px 0 8px}.stats{font-size:11px;color:#9b845f}</style><h1>小队扩编 · 16 种伙伴随时招募</h1><p>新增八种猫咪，重画一台猫咪推着走的玩具大炮 · 游戏实际角色素材</p><div class="grid">${roster.map(u => `<div class="card"><div class="role">${u.role}</div><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(u.svg)}"/><h2>${u.name}</h2><div class="stats">${u.cost} 猫粮 · ${u.population} 人口 · ${u.tier} 阶科技</div></div>`).join('')}</div></html>`);
  await board.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await board.screenshot({ path: path.join(output, `${engine}-roster.png`), fullPage: true }); await board.close();
  await page.locator('#start').click(); await advance(0); await page.evaluate(() => { const b=window.__catGame.battle; b.playerRoster=Object.keys(b.armies.player.cooldowns); b.aiEnabled=false; window.__catGame.render(); });
  assert.equal(await page.locator('.unit-card').count(), 16);
  await capture('cards-original');
  // Normal starting resources, actual income/research, and UI recruitment on both halves of the roster.
  await page.locator('#upgrade-tech').click(); await advance(8010); await foodFor(280); await page.locator('#upgrade-tech').click(); await advance(12010);
  await foodFor(roster.filter(u => u.kind !== 'catapult').reduce((sum, u) => sum + u.cost, 0));
  for (const kind of ['gunner', 'litter', 'kungfu', 'assassin', 'umbrella', 'drummer', 'hook', 'boxer']) {
    const spec = roster.find(u => u.kind === kind); await foodFor(spec.cost);
    const before = (await state()).player.hired;
    await page.locator(`#hire-${kind}`).scrollIntoViewIfNeeded(); await page.locator(`#hire-${kind}`).click(); await advance(0);
    assert.equal((await state()).player.hired, before + 1, kind);
  }
  await capture('cards-new');
  await page.locator('#help').click(); assert.equal(await page.locator('.enemy-guide .guide-units > p').count(), 8);
  await page.locator('#guide-close').click();
  for (const { kind } of roster) {
    await fixture(kind); await advance(34);
    await capture(`${kind}-start`);
    if (kind === 'hook' || kind === 'boxer') { assert.ok((await state()).units.find(u => u.kind === kind).charge); await advance(650); }
    else if (kind === 'litter') { assert.equal((await state()).units.find(u => u.side === 'enemy').weakenedSeconds, 0); await advance(410); }
    else if (kind === 'assassin') {
      const s = await state(), cat = s.units.find(u => u.kind === kind); assert.ok(cat.stealthSeconds > 2.9); assert.equal(cat.hp, await page.evaluate(async () => { const { UNITS } = await import('/src/game/content.ts'); return UNITS.assassin.hp - UNITS.soldier.damage; }));
      assert.equal(s.animations.find(a => a.id === cat.id).state, 'stealth');
      await advance(1000); assert.ok((await state()).units.find(u => u.kind === kind).x > cat.x + 85);
    } else await advance(100);
    await capture(`${kind}-action`);
    if (kind === 'litter') assert.ok((await state()).units.find(u => u.side === 'enemy').weakenedSeconds > 3.8);
    if (kind === 'drummer') assert.ok((await state()).units.find(u => u.kind === 'soldier' && u.side === 'player').hasteSeconds > 0);
    if (kind === 'umbrella') assert.ok((await state()).units.find(u => u.kind === 'umbrella').guardSeconds > 0);
    // Every new view freezes on pause, resumes, and cleans itself up after death.
    await page.locator('#pause').click(); const frozen = await page.evaluate(() => JSON.stringify(window.__catGame.getAnimations()));
    await advance(1000); assert.equal(await page.evaluate(() => JSON.stringify(window.__catGame.getAnimations())), frozen); await page.locator('#resume').click();
    await page.evaluate(kind => { window.__catGame.battle.units.find(u => u.kind === kind && u.side === 'player').hp = 0; }, kind);
    await advance(34); assert.ok((await state()).animations.some(a => a.state === 'death')); await advance(900);
    assert.ok(!(await state()).units.some(u => u.kind === kind && u.side === 'player'));
  }
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(120); await fixture('gunner');
    const arena = await page.locator('.arena-frame').boundingBox(); assert.ok(arena.height >= 150);
    for (const card of await page.locator('.unit-card').all()) {
      await card.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForTimeout(120);
      const r = await card.boundingBox(), grid = await page.locator('.unit-grid').boundingBox();
      assert.ok(r.width >= 44 && r.height >= 44); assert.ok(r.y >= grid.y - 1 && r.y + r.height <= grid.y + grid.height + 1,JSON.stringify({width,height,id:await card.getAttribute('id'),r,grid}));
      assert.ok(r.x >= 0 && r.x + r.width <= width);
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false); await capture(`viewport-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await fixture('assassin'); await advance(34);
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.waitForTimeout(100); await advance(0);
  const a = (await state()).units.find(u => u.kind === 'assassin');
  const pose = await page.evaluate(id => window.__catGame.getAnimations().find(p => p.id === id), a.id);
  assert.equal(pose.alpha, .32); assert.equal(pose.body.rotation, 0); await capture('reduced-stealth');
  await page.locator('#pause').click(); await page.locator('#restart').click(); await advance(0);
  assert.equal((await state()).player.tech, 1); assert.equal((await state()).units.length, 0);
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({ status: 'passed', engine, cards: 16, enemyCards: 8, scenarios: ['normal-resource recruitment of all eight additions', 'independent enemy roster', 'nine articulated assets and combat effects', 'pause and death cleanup', 'all sixteen cards reachable at four sizes', 'reduced motion and reset'], errors }, null, 2));
  console.log(`PASS ${engine}: sixteen cards, nine assets, specialist combat, pause, death and small-screen scrolling`);
} finally { await browser.close(); }
