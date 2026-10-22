import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.env.TEST_BROWSER || 'chromium';
const output = path.resolve('test-results/animations'); mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const inspect = () => page.evaluate(() => window.__catGame.getAnimations());
const capture = name => page.screenshot({ path: path.join(output, `${engine}-${name}.png`), fullPage: true });
const reduceMotion = async () => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // WebKit updates existing MediaQueryList objects on a later rendering turn.
  await page.waitForFunction(() => {
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    window.advanceTime(0);
    return window.__catGame.getAnimations().every(pose => pose.body.rotation === 0 && Object.values(pose.parts).every(part => part.rotation === 0));
  });
};
const fixture = async (kind, pair = true) => page.evaluate(({kind, pair}) => {
  const b = window.__catGame.battle; b.reset(); b.start(); b.aiEnabled = false;
  const spawn = (side, type, x) => {
    b.armies[side].food = 10000; b.armies[side].tech = 3; b.armies[side].cooldowns[type] = 0;
    b.summon(side, type); const unit = b.units.at(-1); unit.x = x; unit.attackCooldown = 0; return unit;
  };
  const a = spawn('player', kind, kind === 'slinger' || kind === 'mage' || kind === 'catapult' ? 600 : pair ? 700 : 500);
  if (pair) {
    const b = spawn('enemy', 'shield', kind === 'slinger' || kind === 'mage' || kind === 'catapult' ? 800 : 735); b.attackCooldown = 10;
  }
  if (kind === 'healer') { const ally = spawn('player', 'soldier', 730); ally.hp = 100; }
  window.advanceTime(0); window.__catGame.render();
  return a.id;
}, {kind, pair});

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5173'}/?qa`, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({state:'detached'}); await page.locator('#start').click(); await advance(0);
  await fixture('soldier', false); await advance(100);
  const walking = (await inspect())[0];
  assert.equal(walking.state, 'walk'); assert.notEqual(walking.parts.leftFoot.y, walking.parts.rightFoot.y);
  assert.notEqual(walking.parts.leftHand.y, walking.parts.rightHand.y);
  await capture('phone-walk');
  await advance(100); assert.notDeepEqual((await inspect())[0].parts, walking.parts);

  for (const kind of ['mouse', 'soldier', 'shield', 'slinger', 'mage', 'catapult', 'healer', 'knight']) {
    const id = await fixture(kind); await advance(1000 / 30);
    const poses = await inspect(), attacker = poses.find(p => p.id === id);
    assert.equal(attacker.state, 'attack', kind);
    assert.ok(Object.values(attacker.parts).every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.rotation)), kind);
    if (kind !== 'healer' && kind !== 'mage') assert.ok(poses.some(p => p.side === 'enemy' && p.state === 'hurt'), kind);
    await capture(`phone-${kind}-attack`);
    if (kind === 'mage') {
      assert.equal(await page.evaluate(() => window.__catGame.battle.projectiles.length), 1);
      await advance(150); await capture('phone-star-flight');
      await advance(190); assert.ok((await inspect()).some(p => p.side === 'enemy' && p.state === 'hurt'));
      assert.ok(await page.evaluate(() => window.__catGame.battle.units.some(u => u.side === 'enemy' && u.starSlow > 2.9)));
      await capture('phone-star-slow');
    }
  }
  // Mounted units keep four distinct paws and an independent rider through their lifecycle.
  const riderId = await fixture('knight', false); await advance(100);
  const riding = (await inspect()).find(p => p.id === riderId);
  assert.equal(riding.state, 'walk'); assert.equal(Object.keys(riding.parts).length, 8);
  assert.notEqual(riding.parts.leftFoot.rotation, 0);
  assert.equal(riding.parts.leftFoot.rotation, riding.parts.rearRightFoot.rotation);
  assert.equal(riding.parts.rightFoot.rotation, riding.parts.rearLeftFoot.rotation);
  assert.equal(riding.parts.leftFoot.rotation, -riding.parts.rightFoot.rotation);
  await capture('phone-knight-walk'); await advance(100);
  assert.notDeepEqual((await inspect()).find(p => p.id === riderId).parts, riding.parts);
  await page.locator('#pause').click(); const restingMount = await inspect();
  await advance(1500); assert.deepEqual(await inspect(), restingMount); await page.locator('#resume').click();
  await reduceMotion();
  const stillMount = (await inspect()).find(p => p.id === riderId);
  for (const name of ['leftFoot', 'rightFoot', 'rearLeftFoot', 'rearRightFoot']) assert.equal(stillMount.parts[name].rotation, 0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  await fixture('knight');
  await page.evaluate(() => { const b = window.__catGame.battle; b.units.find(u => u.side === 'enemy').attackCooldown = 0; });
  await advance(1000 / 30); assert.ok((await inspect()).some(p => p.kind === 'knight' && p.state === 'hurt'));
  await capture('phone-knight-hurt');
  await page.evaluate(() => { const b = window.__catGame.battle; b.units.find(u => u.kind === 'knight').hp = 1; b.units.find(u => u.side === 'enemy').attackCooldown = 0; });
  await advance(1000 / 30); await advance(200);
  assert.equal(await page.evaluate(() => window.__catGame.battle.population('player')), 0);
  assert.ok((await inspect()).some(p => p.kind === 'knight' && p.state === 'death' && Object.keys(p.parts).length === 8));
  await capture('phone-knight-death'); await advance(650);
  assert.ok((await inspect()).every(p => p.kind !== 'knight'));
  await page.evaluate(() => { const b = window.__catGame.battle; b.armies.player.cooldowns.knight = 0; b.armies.player.food = 500; window.__catGame.render(); });
  await page.keyboard.press('8');
  assert.equal(await page.evaluate(() => window.__catGame.battle.units.at(-1).kind), 'knight');
  assert.equal(await page.evaluate(() => window.__catGame.battle.population('player')), 6);
  // Cast through real controls, then recruit: only the roster present at cast receives the buff.
  await fixture('mage');
  await page.locator('#catnip').click();
  assert.ok(await page.evaluate(() => window.__catGame.battle.units.filter(u => u.side === 'player').every(u => u.catnip === 10)));
  assert.equal(await page.locator('#catnip').isDisabled(), true);
  await page.locator('#hire-soldier').click();
  assert.equal(await page.evaluate(() => window.__catGame.battle.units.at(-1).catnip), 0);
  await advance(170); await capture('phone-catnip-and-star');
  const spellState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.ok(spellState.units.some(u => u.kind === 'mage' && u.catnipSeconds > 9));
  assert.ok(spellState.units.some(u => u.kind === 'soldier' && u.catnipSeconds === 0));
  assert.ok(spellState.projectiles.length > 0);
  await page.locator('#pause').click();
  const pausedSpell = await page.evaluate(() => window.render_game_to_text());
  await advance(2000); assert.equal(await page.evaluate(() => window.render_game_to_text()), pausedSpell);
  await page.locator('#resume').click();
  await page.evaluate(() => { const b = window.__catGame.battle; b.units = b.units.filter(u => u.side === 'player'); b.projectiles = []; });
  await advance(10000);
  assert.ok(await page.evaluate(() => window.__catGame.battle.units.every(u => u.catnip === 0)));
  assert.equal(await page.locator('#catnip').isDisabled(), true);
  // The C shortcut follows the same guarded action and works when cooldown expires.
  await page.evaluate(() => { window.__catGame.battle.armies.player.catnipCooldown = 0; window.__catGame.render(); });
  await page.keyboard.press('c');
  assert.equal(await page.evaluate(() => window.__catGame.battle.armies.player.catnipCooldown), 45);
  await page.keyboard.press('7');
  assert.equal(await page.evaluate(() => window.__catGame.battle.units.at(-1).kind), 'healer');
  assert.equal(await page.evaluate(() => window.__catGame.battle.units.at(-1).catnip), 0);
  const id = await fixture('soldier'); await advance(1000 / 30);
  const strike = (await inspect()).find(p => p.id === id).parts.rightHand.rotation;
  await advance(900);
  const anticipation = (await inspect()).find(p => p.id === id).parts.rightHand.rotation;
  assert.ok(strike * anticipation < 0, 'windup and swing must point in different directions');
  await capture('phone-windup');
  await page.evaluate(() => window.__catGame.battle.togglePause());
  const frozen = await inspect(); await advance(1500); assert.deepEqual(await inspect(), frozen);
  await page.evaluate(() => window.__catGame.battle.togglePause());
  await page.evaluate(() => { const b = window.__catGame.battle; b.units.find(u => u.side === 'enemy').hp = 1; b.units.find(u => u.side === 'player').attackCooldown = 0; });
  await advance(1000 / 30); await advance(200);
  assert.ok((await inspect()).some(p => p.state === 'death'));
  assert.equal(await page.evaluate(() => window.__catGame.battle.population('enemy')), 0);
  await capture('phone-death');
  await advance(400); assert.ok((await inspect()).some(p => p.state === 'death' && p.alpha < 1));
  await advance(250); assert.ok((await inspect()).every(p => p.state !== 'death'));

  // Rotation only resizes the same vertical board and never changes gameplay or pose phase.
  await fixture('soldier', false); await advance(100);
  const before = await page.evaluate(() => JSON.stringify(window.__catGame.battle.units));
  for (const [name, width, height] of [['phone-rotated',844,390], ['desktop',1440,900], ['small-phone',320,568]]) {
    await page.setViewportSize({width,height}); await page.waitForTimeout(150); await advance(0);
    assert.equal(await page.evaluate(() => window.__catGame.getView().orientation), 'vertical');
    assert.equal(await page.evaluate(() => JSON.stringify(window.__catGame.battle.units)), before);
    await capture(name);
  }
  await reduceMotion();
  const quiet = (await inspect())[0];
  assert.equal(quiet.body.rotation, 0); assert.equal(quiet.parts.leftFoot.y, quiet.parts.rightFoot.y);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(() => { window.__catGame.battle.reset(); window.__catGame.battle.start(); }); await advance(0);
  assert.deepEqual(await inspect(), []);
  assert.equal(await page.locator('#catnip').isDisabled(), true);
  assert.equal(await page.evaluate(() => window.__catGame.battle.projectiles.length), 0);
  assert.deepEqual(errors, []);
  writeFileSync(path.join(output, `${engine}-report.json`), JSON.stringify({status:'passed', engine, scenarios:['distance-based feet and hands','eight attack types','mounted diagonal trot, rider, hurt, death and key 8','star flight and impact slow','catnip roster snapshot and UI','catnip pause, expiry and keyboard shortcuts','damage reaction','windup','pause','death and population','rotation and desktop','reduced motion','reset cleanup'], errors}, null, 2));
  console.log(`PASS ${engine}: vertical unit animations and lifecycle`);
} finally { await browser.close(); }
