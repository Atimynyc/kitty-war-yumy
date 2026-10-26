import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const output = path.resolve('test-results/base-upgrade'); mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const paint = async () => {
  const frame = await page.evaluate(() => window.__catGame.getView().renderFrame);
  await page.waitForFunction(frame => window.__catGame.getView().renderFrame > frame + 1, frame);
};
const capture = async name => { await paint(); await page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true }); };
const saveFood = async cost => {
  const s = await state();
  if (s.player.food < cost) await advance(Math.ceil((cost - s.player.food) / s.player.income * 1000) + 10);
};

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  const economyConfig = await page.evaluate(async () => {
    const { FOOD_RATES, ECONOMY_COSTS } = await import('/src/game/content.ts');
    return { rates: FOOD_RATES, costs: ECONOMY_COSTS };
  });
  const art = await page.evaluate(async () => {
    const { basePreviewSVG, BASE_NAMES } = await import('/src/game/base-art.ts');
    return ['player', 'enemy'].map(side => [1, 2, 3].map(tier => ({ side, tier, name: BASE_NAMES[tier - 1], svg: basePreviewSVG(side, tier, tier - 1) })));
  });
  const board = await browser.newPage({ viewport: { width: 1080, height: 920 }, deviceScaleFactor: 1 });
  const img = (a, width) => `<img width="${width}" src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}" alt="${a.name}"/>`;
  await board.setContent(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#f8f0df;color:#65513b;font-family:'Microsoft YaHei',sans-serif}h1{margin:4px 0 8px;font-size:30px}p{color:#947e60;margin:0 0 22px;font-size:14px}.row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:16px 0}.card{text-align:center;background:#fffaf0;border:1px solid #ddcdb3;border-radius:20px;padding:12px}.card img{display:block;margin:auto}.name{font-size:19px;font-weight:700}.label{font-size:11px;color:#8e7759;letter-spacing:2px}.small{display:flex;align-items:end;gap:10px;justify-content:center}.small img{margin:0}.line{display:flex;justify-content:space-between;font-size:12px;color:#937d5d}</style><h1>科技升级，小窝真的变了。</h1><p>纸箱营地 → 加固猫屋 → 冻干要塞 · 游戏内实际建筑与猫爪罐头炮</p>${art.map((row, i) => `<div class="row">${row.map(a => `<div class="card"><div class="label">${i ? '胖橘搜粮团' : '我方小队'} · ${a.tier} 阶</div>${img(a, 220)}<div class="name">${a.name}</div><div class="label">主炮 ${[32, 55, 85][a.tier - 1]} 伤害</div></div>`).join('')}</div>`).join('')}<div class="line"><span>78 / 96 / 112 px 实际显示宽度</span><span>0.14 · 研究完成后换装</span></div><div class="row">${art[0].map(a => `<div class="small">${[78, 96, 112].map(size => img(a, size)).join('')}</div>`).join('')}</div></html>`);
  await board.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())));
  await board.screenshot({ path: path.join(output, `${engine}-tiers.png`), fullPage: true }); await board.close();

  await page.locator('#start').click(); await advance(0);
  await page.evaluate(() => { window.__catGame.battle.aiEnabled = false; });
  assert.equal((await state()).bases.player.name, '纸箱营地'); await capture('tier-1');
  await page.locator('#upgrade-tech').click(); await advance(3990);
  let s = await state(); assert.equal(s.player.tech, 1); assert.equal(s.bases.player.tier, 1); assert.ok(s.bases.player.researchProgress > .49);
  await capture('research');
  await page.locator('#pause').click(); await advance(0); const paused = await state(); await advance(5000);
  assert.deepEqual((await state()).bases, paused.bases); assert.equal((await state()).player.research, paused.player.research);
  await page.locator('#resume').click(); await advance(4000);
  assert.equal((await state()).bases.player.tier, 1, 'research must not change art early');
  await advance(20); s = await state();
  assert.equal(s.player.tech, 2); assert.equal(s.bases.player.name, '加固猫屋'); assert.equal(s.bases.enemy.tier, 1);
  assert.equal(s.cannon.damage, 55); assert.equal(s.bases.player.upgrading, true);
  await advance(120); await capture('upgrade-pulse');
  await page.locator('#pause').click(); await advance(0); const pulse = (await state()).bases;
  await advance(1200); assert.deepEqual((await state()).bases, pulse);
  await page.locator('#resume').click(); await advance(600); await capture('tier-2');
  await saveFood(280); await page.locator('#upgrade-tech').click(); await advance(11990);
  assert.equal((await state()).bases.player.tier, 2); await advance(20); await advance(650);
  s = await state(); assert.equal(s.bases.player.name, '冻干要塞'); assert.equal(s.cannon.damage, 85);
  assert.match(await page.locator('#compact-cannon').textContent(), /冻干要塞/); await capture('tier-3');
  for (const tier of [2, 3]) {
    assert.equal(await page.evaluate(() => window.__catGame.battle.researchTech('enemy')), true);
    await advance(0); await advance(tier === 2 ? 8010 : 12010); await advance(650);
    s = await state(); assert.equal(s.bases.enemy.tier, tier); assert.equal(s.bases.player.tier, 3);
  }
  for (const [i, cost] of economyConfig.costs.entries()) {
    await saveFood(cost); await page.locator('#upgrade-economy').click(); await advance(0);
    s = await state(); assert.equal(s.bases.player.economy, i + 1); assert.equal(s.bases.player.tier, 3);
    assert.equal(s.bases.enemy.economy, 0); await capture(`feeder-${i + 1}`);
    assert.equal(s.player.income, economyConfig.rates[i + 1]);
    assert.ok(s.bases.player.feeder && !s.bases.player.feeder.includes('undefined'));
    assert.equal(await page.locator('#economy-level').textContent(), `Lv.${i + 2}/${economyConfig.rates.length}`);
    const before = s.player.food; await advance(1000);
    assert.ok(Math.abs((await state()).player.food - before - economyConfig.rates[i + 1]) < .01);
  }
  assert.equal(await page.locator('#upgrade-economy').isDisabled(), true);
  assert.match(await page.locator('#economy-action').textContent(), /MAX/);
  assert.equal((await state()).economy.nextCost, null);
  const feederArt = await page.evaluate(async () => {
    const { basePreviewSVG, FEEDER_NAMES } = await import('/src/game/base-art.ts');
    const { FOOD_RATES } = await import('/src/game/content.ts');
    return FOOD_RATES.map((rate, i) => ({ level: i + 1, name: FEEDER_NAMES[i], rate, svg: basePreviewSVG('player', 3, i) }));
  });
  const feeders = await browser.newPage({ viewport: { width: 1040, height: 660 } });
  await feeders.setContent(`<html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f8f0df;color:#65513b;font-family:'Microsoft YaHei',sans-serif}h1{font-size:24px;margin:0 0 8px}p{font-size:13px;margin:0 0 16px;color:#8a795e}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}.card{text-align:center;background:#fffaf0;border:1px solid #ddcdb3;border-radius:16px;padding:12px}img{display:block;width:180px;margin:auto}.name{font-weight:bold;font-size:15px}.rate{font-size:13px;margin-top:8px;color:#507d68}</style><h1>投喂工坊 · 从一只食盆到金爪粮仓</h1><p>同一座三阶基地，展示八档产能的真实外观。升级产能不会跳过科技研究。</p><div class="grid">${feederArt.map(a=>`<div class="card"><div>Lv.${a.level}</div><img src="data:image/svg+xml;charset=utf-8,${encodeURIComponent(a.svg)}"/><div class="name">${a.name}</div><div class="rate">${a.rate} 猫粮 / 秒</div></div>`).join('')}</div></html>`);
  await feeders.locator('img').evaluateAll(images => Promise.all(images.map(img=>img.decode())));
  await feeders.screenshot({ path: path.join(output, `${engine}-eight-feeders.png`), fullPage: true }); await feeders.close();
  // Damage overlays preserve the player's upgraded silhouette.
  for (const [hp, damage] of [[1400, 1], [700, 2], [3000, 0]]) {
    await page.evaluate(hp => { window.__catGame.battle.armies.player.hp = hp; }, hp); await advance(0);
    s = await state(); assert.equal(s.bases.player.damage, damage); assert.equal(s.bases.player.tier, 3); await capture(`damage-${damage}`);
  }
  // Real cannon damage, aimed muzzle, recoil, then a target killed before the visual flight ends.
  await saveFood(90);
  for (const side of ['player', 'enemy']) {
    const targetId = await page.evaluate(side => {
      const b = window.__catGame.battle, opposite = side === 'player' ? 'enemy' : 'player';
      b.units = []; b.effects = []; b.armies[side].cannonCooldown = 0;
      b.armies[opposite].cooldowns.shield = 0;
      if (!b.summon(opposite, 'shield')) throw new Error('Need normal resources for the cannon target');
      const target = b.units.at(-1); target.x = side === 'player' ? 300 : 1100; target.row = 0;
      return target.id;
    }, side);
    await advance(1000 / 30); s = await state();
    assert.equal(s.units.find(u => u.id === targetId).hp, 615);
    assert.ok(s.bases[side].recoil > 0); assert.ok(Math.abs(s.bases[side].aim) > 0);
    await capture(`${side}-cannon`); await page.locator('#pause').click(); await advance(0);
    const frozen = (await state()).bases; await advance(2000); assert.deepEqual((await state()).bases, frozen); await page.locator('#resume').click();
    await advance(200); assert.equal((await state()).bases[side].recoil, 0);
    await page.evaluate(({ side, targetId }) => {
      const b = window.__catGame.battle; b.units.find(u => u.id === targetId).hp = 1; b.armies[side].cannonCooldown = 0;
    }, { side, targetId });
    await advance(1000 / 30); assert.ok((await state()).units.every(u => u.id !== targetId));
    await capture(`${side}-fatal-shot`); await advance(600);
  }

  // The same two bases must fit all six scenes and supported compact viewports.
  for (const stage of [1, 6, 11, 16, 21, 26]) {
    await page.evaluate(async stage => {
      const { getLevel } = await import('/src/game/levels.ts');
      window.__catGame.battle.level = getLevel(`campaign-${String(stage).padStart(2, '0')}`);
      window.dispatchEvent(new Event('resize'));
    }, stage); await advance(0); await capture(`scene-${stage}`);
  }
  for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(150); await advance(0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const view = await page.evaluate(() => window.__catGame.getView());
    for (const at of Object.values(view.cannons)) assert.ok(at.x > 0 && at.x < view.width && at.y > 0 && at.y < view.height);
    assert.equal((await state()).bases.player.tier, 3); await capture(`viewport-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  // Restore a selectable level before exercising the real restart control.
  await page.evaluate(async () => { const { getLevel } = await import('/src/game/levels.ts'); window.__catGame.battle.level = getLevel('campaign-01'); });
  await page.locator('#pause').click(); await page.locator('#restart').click(); await advance(0);
  s = await state();
  for (const base of Object.values(s.bases)) { assert.equal(base.tier, 1); assert.equal(base.economy, 0); assert.equal(base.damage, 0); assert.equal(base.upgrading, false); }
  await page.evaluate(() => { window.__catGame.battle.aiEnabled = false; });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  await page.locator('#upgrade-tech').click(); await advance(8010); await paint();
  s = await state(); assert.equal(s.bases.player.tier, 2); assert.equal(s.bases.player.scale, 1); assert.equal(s.bases.player.upgrading, false); await capture('reduced-motion');
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({ status: 'passed', engine, scenarios: ['normal-resource research through actual controls', 'no early texture change', 'independent enemy research', 'research and upgrade pause', 'all eight feeding modules and actual income', 'max-level disabled control', 'damage preserves tier', 'real 85-damage cannon and fatal shot', 'six scenes and three viewport sizes', 'restart and reduced motion'], errors }, null, 2));
  console.log(`PASS ${engine}: base research, three tiers, feeders, muzzle, pause and reset`);
} finally { await browser.close(); }
