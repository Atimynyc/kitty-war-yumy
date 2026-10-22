import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine = process.env.TEST_BROWSER || 'chromium', output = 'test-results/spells';
mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const capture = name => page.screenshot({ path: `${output}/${engine}-${name}.png`, fullPage: true });
const fixture = () => page.evaluate(() => {
  const b = window.__catGame.battle; b.reset(); b.start(); b.aiEnabled = false;
  for (const side of ['player', 'enemy']) {
    b.armies[side].food = 1000;
    b.summon(side, 'soldier');
    Object.assign(b.units.at(-1), { x: side === 'player' ? 1100 : 340, row: 1 });
  }
  window.advanceTime(0);
});
try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  await page.locator('#start').tap(); await advance(0);
  assert.equal(await page.locator('#catnip').isDisabled(), true);
  assert.equal(await page.locator('.upgrade-grid button').count(), 2);
  for (const id of ['roar', 'catnip']) {
    assert.equal((await page.locator(`#${id}`).textContent()).trim(), '');
    assert.equal(await page.locator(`#${id} .spell-art`).count(), 1);
    assert.equal(await page.locator(`#${id}`).getAttribute('title'), null);
  }
  await fixture();
  await page.locator('#catnip').tap();
  assert.equal(await page.locator('#catnip').isDisabled(), true);
  assert.match(await page.locator('.spell-notice.player').textContent(), /我方释放猫薄荷.*攻击力 \+20%.*10 秒/);
  assert.equal(await page.locator('#catnip').getAttribute('data-cooling'), 'true');
  assert.match(await page.locator('#catnip').getAttribute('aria-label'), /45 秒/);
  await page.locator('#roar').tap();
  await page.evaluate(() => { window.__catGame.battle.catnip('enemy'); window.__catGame.render(); });
  assert.equal(await page.locator('.spell-notice').count(), 2);
  assert.match(await page.locator('.spell-notice.enemy').textContent(), /敌方释放猫薄荷.*1 名敌军攻击力 \+20%/);
  await capture('both-armies');
  await page.locator('#pause').tap();
  const paused = (await read()).spells;
  await advance(10000); assert.deepEqual((await read()).spells, paused);
  await page.locator('#resume').tap(); await advance(4600);
  assert.equal(await page.locator('.spell-notice').count(), 1);
  assert.match(await page.locator('.spell-notice.player').textContent(), /我方释放震退.*移速 −55%.*3 秒/);
  await capture('roar'); await advance(4600);
  assert.equal(await page.locator('.spell-notice').count(), 0);
  await page.locator('#pause').tap(); await page.locator('#restart').tap(); await advance(0);
  assert.equal(await page.locator('.spell-notice').count(), 0);
  assert.equal(await page.locator('#roar').isDisabled(), false);
  // Inspect right-side touch targets and captions on phone, narrow and desktop boards.
  for (const [name,width,height] of [['tiny',320,568],['phone',390,844],['fold',344,882],['desktop',1440,900]]) {
    await page.setViewportSize({ width, height }); await page.waitForTimeout(180); await fixture();
    await page.locator('#catnip').tap();
    await page.evaluate(() => { const b = window.__catGame.battle; b.roar('enemy'); window.__catGame.render(); });
    const boxes = await page.evaluate(() => {
      const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height }; };
      return { frame:rect(document.querySelector('.arena-frame')), canvas:rect(document.querySelector('canvas')),
        buttons:[...document.querySelectorAll('.spell-button')].map(rect), notices:[...document.querySelectorAll('.spell-notice')].map(rect),
        copyOverflow:[...document.querySelectorAll('.spell-notice')].some(el=>el.scrollWidth>el.clientWidth),
        pointer:getComputedStyle(document.querySelector('.spell-subtitles')).pointerEvents };
    });
    assert.equal(boxes.copyOverflow, false, name); assert.equal(boxes.pointer,'none');
    for (const r of boxes.buttons) { assert.ok(r.width>=44&&r.height>=44); assert.ok(r.x>=boxes.canvas.right&&r.right<boxes.frame.right); }
    assert.ok(boxes.buttons[0].bottom < boxes.buttons[1].y);
    for (const r of boxes.notices) assert.ok(r.x>=boxes.frame.x && r.right<=boxes.canvas.right && r.y>=boxes.frame.y && r.bottom<=boxes.frame.bottom, name);
    assert.match(await page.locator('.spell-notice.enemy').textContent(), /敌方释放震退.*移速 −55%/);
    await capture(name);
  }
  await page.setViewportSize({width:390,height:844}); await page.waitForTimeout(180);
  await fixture(); await page.emulateMedia({reducedMotion:'reduce'});
  await page.keyboard.press('c'); await page.keyboard.press('Space');
  assert.equal((await read()).spells.cooldowns.catnip,45); assert.equal((await read()).spells.cooldowns.roar,45);
  assert.equal(await page.locator('.spell-notice').evaluate(el=>getComputedStyle(el).animationName),'none');
  await capture('reduced-motion');
  // End-of-battle overlay must hide all queued captions and remain operable.
  await page.evaluate(() => { const b=window.__catGame.battle; b.armies.enemy.hp=1; b.units=b.units.filter(u=>u.side==='player'); Object.assign(b.units[0],{x:1265,attackCooldown:0}); window.advanceTime(100); });
  assert.equal((await read()).phase,'ended'); assert.equal(await page.locator('.spell-notice').count(),0);
  await page.locator('#play-again').tap(); await advance(0);
  assert.equal(await page.locator('.spell-notice').count(),0);
  writeFileSync(`${output}/${engine}-state.json`,JSON.stringify(await read(),null,2));
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: icon touch controls, cooldowns, both armies, queued subtitles, pause/restart/end, keyboard and 4 layouts`);
} finally { await browser.close(); }
