import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.env.TEST_BROWSER || 'chromium';
const output = path.resolve('test-results/enemy-faction');
mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const errors = [];
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const inspect = () => page.evaluate(() => window.__catGame.getAnimations());
const capture = async name => {
  // Simulation stepping updates the display list; WebKit can capture the previous
  // canvas until Phaser has painted it. Wait for two render frames without advancing combat.
  const frame = await page.evaluate(() => window.__catGame.getView().renderFrame);
  await page.waitForFunction(frame => window.__catGame.getView().renderFrame > frame + 1, frame);
  return page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true });
};
const kinds = ['mouse', 'soldier', 'shield', 'slinger', 'mage', 'catapult', 'healer', 'knight'];
const fixture = async (kind, combat = true) => page.evaluate(({ kind, combat }) => {
  const b = window.__catGame.battle; b.reset(); b.start(); b.aiEnabled = false;
  const spawn = (side, type, x, row = 1) => {
    b.armies[side].food = 10000; b.armies[side].tech = 3; b.armies[side].cooldowns[type] = 0;
    if (!b.summon(side, type)) throw new Error(`Cannot summon ${side} ${type}`);
    const u = b.units.at(-1); Object.assign(u, { x, row, targetRow: row, attackCooldown: 0 }); return u;
  };
  const ranged = ['mage', 'catapult', 'slinger'].includes(kind);
  const unit = spawn('enemy', kind, combat ? (ranged ? 820 : 716) : 950);
  if (combat) {
    const target = spawn('player', 'shield', 700); target.attackCooldown = 100;
    if (kind === 'healer') { const ally = spawn('enemy', 'soldier', 725); ally.hp = 80; ally.attackCooldown = 100; }
  } else if (kind === 'healer') spawn('enemy', 'soldier', 700);
  window.advanceTime(0); window.__catGame.render(); return unit.id;
}, { kind, combat });

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const catalog = await page.evaluate(async () => {
    const { unitSVG } = await import('/src/art.ts');
    const { ENEMY_ORDER, UNITS } = await import('/src/game/content.ts');
    const { ENEMY_UNITS } = await import('/src/game/enemy-roster.ts');
    const { unitParts } = await import('/src/game/unit-art.ts');
    return ENEMY_ORDER.map(kind => ({ kind, friendly: unitSVG(kind), enemy: unitSVG(kind, 'enemy'), name: ENEMY_UNITS[kind].name,
      role: ENEMY_UNITS[kind].role, playerName: UNITS[kind].name,
      looks: ['front', 'side', 'back'].map(look => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${unitParts(kind, 'enemy', look).map(p => p.svg).join('')}</svg>`) }));
  });
  const board = await browser.newPage({ viewport: { width: 1200, height: 1040 }, deviceScaleFactor: 1 });
  const img = svg => `<img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}" alt=""/>`;
  await board.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:36px 44px;background:#f8f0df;color:#634936;font-family:'Microsoft YaHei',sans-serif}header{display:flex;align-items:end;justify-content:space-between;margin-bottom:24px}h1{font-size:34px;margin:6px 0}header p{font-size:14px;color:#967457;margin:6px 0}.eyebrow{font-size:12px;letter-spacing:3px;color:#b85b49}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}.card{background:#fffbf2;border:1px solid #e5cfb6;border-radius:20px;padding:18px;text-align:center}.tag{font-size:11px;color:#a48362;letter-spacing:2px}.hero{height:162px}.hero img{width:162px;height:162px}.card h2{font-size:21px;margin:5px 0}.role{color:#b85b49;font-size:13px;margin:0 0 12px}.compare{border-top:1px dashed #e3d2bb;padding-top:10px;display:flex;gap:10px;align-items:center;justify-content:center;font-size:11px;color:#8f775c}.compare img{width:44px;height:44px}footer{margin-top:24px;display:flex;justify-content:space-between;font-size:12px;color:#987858}</style><header><div><div class="eyebrow">PAW & PANTRY / ENEMY CREW</div><h1>胖橘搜粮团</h1><p>红围巾 · 厨房装备 · 零食包装</p></div><p>八种敌军 / 游戏内实际素材</p></header><div class="grid">${catalog.map((c, i) => `<article class="card"><div class="tag">${String(i + 1).padStart(2, '0')} / 搜粮团成员</div><div class="hero">${img(c.enemy)}</div><h2>${c.name}</h2><p class="role">${c.role}</p><div class="compare">${img(c.friendly)}<span>我方对应职责<br>${c.playerName}</span></div></article>`).join('')}</div><footer><span>橘猫拿起厨房家当，跟着大胖橘出发。</span><span>0.13 · 敌方阵营美术</span></footer></html>`);
  await board.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await board.screenshot({ path: path.join(output, `${engine}-roster.png`), fullPage: true });
  await board.setContent(`<style>body{margin:20px;background:#faf0df}.row{display:flex;align-items:center;height:144px;font:16px sans-serif}.row span{width:150px}.row img{width:128px;height:128px;margin:0 16px}</style>${catalog.map(c => `<div class="row"><span>${c.name}</span>${c.looks.map(img).join('')}</div>`).join('')}`);
  await board.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await board.screenshot({ path: path.join(output, `${engine}-directions.png`), fullPage: true });
  await board.close();

  await page.locator('#choose-level').click();
  await page.locator('[data-chapter="5"]').click(); await page.locator('#level-campaign-22').click();
  assert.match(await page.locator('#selected-enemy-roster').innerText(), /小猪重骑兵/);
  assert.equal(await page.locator('#level-start').isDisabled(), true);
  assert.match(await page.locator('#selected-level-tip').innerText(), /小猪重骑兵/);
  await capture('level-preview');
  await page.locator('#levels-back').click(); await page.locator('#start').click(); await advance(0);
  for (const kind of kinds) {
    const id = await fixture(kind, false); await advance(150);
    assert.equal((await inspect()).find(p => p.id === id).state, 'walk');
    await capture(`${kind}-walk`);
    const actorId = await fixture(kind); await advance(1000 / 30);
    const poses = await inspect(), actor = poses.find(p => p.id === actorId);
    assert.equal(actor.state, 'attack', kind);
    assert.ok(Object.values(actor.parts).every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rotation)), kind);
    if (kind === 'knight') assert.equal(Object.keys(actor.parts).length, 8);
    const text = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(text.enemy.faction, '胖橘搜粮团');
    assert.equal(text.units.find(u => u.id === actorId).name, catalog.find(c => c.kind === kind).name);
    await advance(100); await capture(`${kind}-attack`);
    if (kind === 'mage') {
      assert.equal(await page.evaluate(() => window.__catGame.battle.projectiles.length), 1);
      await advance(230);
      assert.ok(await page.evaluate(() => window.__catGame.battle.units.some(u => u.side === 'player' && u.starSlow > 2.9)));
    } else if (kind === 'healer') {
      assert.equal(await page.evaluate(() => window.__catGame.battle.units.find(u => u.side === 'enemy' && u.kind === 'soldier').hp), 122);
    } else assert.ok(await page.evaluate(() => window.__catGame.battle.units.find(u => u.side === 'player').hp < 700));
    await page.locator('#pause').click(); const frozen = await inspect(); await advance(1000);
    assert.deepEqual(await inspect(), frozen); await page.locator('#resume').click();
    await page.evaluate(actorId => {
      const b = window.__catGame.battle, a = b.units.find(u => u.id === actorId), z = b.units.find(u => u.side === 'player');
      a.attackCooldown = 100; a.x = z.x + 16; a.row = z.row; z.attackCooldown = 0; z.targetId = a.id;
    }, actorId);
    await advance(1000 / 30);
    assert.equal((await inspect()).find(p => p.id === actorId).state, 'hurt', kind);
    await capture(`${kind}-hurt`);
    // Actual attack kills the raider and must leave its own artwork during the death pose.
    await page.evaluate(actorId => {
      const b = window.__catGame.battle, a = b.units.find(u => u.id === actorId), z = b.units.find(u => u.side === 'player');
      a.hp = 1; a.attackCooldown = 100; a.x = z.x + 16; a.row = z.row; z.attackCooldown = 0;
    }, actorId);
    await advance(1000 / 30); await advance(200);
    assert.equal((await inspect()).find(p => p.id === actorId).state, 'death', kind);
    await capture(`${kind}-death`); await advance(650);
    assert.ok((await inspect()).every(p => p.id !== actorId));
  }
  // Diagonal, lateral and backwards pursuit changes body art without rotating standing cats.
  for (const [name, x, row] of [['front', 690, 1], ['side', 800, 2], ['back', 910, 1]]) {
    const id = await fixture('soldier');
    await page.evaluate(({ x, row }) => {
      const b = window.__catGame.battle, a = b.units.find(u => u.side === 'enemy'), z = b.units.find(u => u.side === 'player');
      a.x = 800; a.row = 1; z.x = x; z.row = row; z.attackCooldown = 100;
    }, { x, row });
    await advance(150); await advance(150); const pose = (await inspect()).find(p => p.id === id);
    assert.equal(pose.look, name); assert.equal(pose.spriteRotation, 0); await capture(`facing-${name}`);
  }
  await fixture('knight', false); await advance(100);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => { window.advanceTime(0); return window.__catGame.getAnimations().every(p => p.body.rotation === 0 && p.parts.leftFoot.rotation === 0); });
  await capture('reduced-motion'); await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(kinds => {
    const b = window.__catGame.battle; b.reset('campaign-22'); b.start(); b.aiEnabled = false;
    for (const side of ['player', 'enemy']) for (const [i, kind] of kinds.entries()) {
      b.armies[side].food = 10000; b.armies[side].tech = 3; b.summon(side, kind);
      Object.assign(b.units.at(-1), { x: side === 'enemy' ? 730 + i * 40 : 710 - i * 40, row: i % 3, attackCooldown: 0 });
    }
  }, kinds);
  await advance(750); await capture('mixed-battle');
  for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await advance(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await capture(`viewport-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 }); await page.locator('#help').click();
  await page.locator('.enemy-guide summary').click();
  assert.equal(await page.locator('.enemy-guide .guide-units p').count(), 8);
  await page.locator('.enemy-guide').scrollIntoViewIfNeeded(); await capture('guide');
  await page.locator('#guide-close').click();
  await page.evaluate(() => { const b = window.__catGame.battle; b.reset(); b.start(); }); await advance(0);
  assert.deepEqual(await inspect(), []);
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({ status: 'passed', engine, roster: catalog.map(({ kind, name }) => ({ kind, name })), scenarios: ['real recruitment of all eight enemies', 'walk, attack, pause, death and cleanup', 'bell impact and can healing', 'three facing directions', 'mounted reduced motion', 'small screen, landscape and desktop', 'locked campaign preview and enemy field guide'], errors }, null, 2));
  console.log(`PASS ${engine}: enemy faction art and battle lifecycle`);
} finally { await browser.close(); }
