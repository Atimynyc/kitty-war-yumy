import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine = process.env.TEST_BROWSER || 'chromium', output = 'test-results/audio';
mkdirSync(output, { recursive: true });
const browser = await (engine === 'webkit' ? webkit : chromium).launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const url = `${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`;
await page.addInitScript(() => {
  const Native = window.AudioContext || window.webkitAudioContext;
  if (!Native) { window.__audioBackendError = 'Web Audio API is unavailable in this WebKit build'; return; }
  window.AudioContext = class extends Native {
    constructor(...args) {
      try { super(...args); } catch (error) { window.__audioBackendError = String(error); throw error; }
      for (const name of ['createDynamicsCompressor', 'createGain', 'createBuffer']) {
        const original = this[name].bind(this);
        this[name] = (...args) => { try { return original(...args); } catch (error) { window.__audioBackendError = `${name}: ${error}`; throw error; } };
      }
    }
    createDynamicsCompressor() {
      const node = super.createDynamicsCompressor(), analyser = this.createAnalyser();
      analyser.fftSize = 2048; node.connect(analyser);
      window.__audioProbe = { ctx: this, analyser };
      return node;
    }
  };
});
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()).audio);
const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
const capture = name => page.screenshot({ path: `${output}/${engine}-${name}.png`, fullPage: true });
const events = type => page.evaluate(type => window.__audioEvents.filter(item => item === type).length, type);
const probe = () => page.evaluate(async () => {
  let peak = 0, sum = 0, count = 0;
  const buffer = new Float32Array(2048);
  for (let i = 0; i < 16; i++) {
    window.__audioProbe.analyser.getFloatTimeDomainData(buffer);
    for (const value of buffer) { peak = Math.max(peak, Math.abs(value)); sum += value * value; count++; }
    await new Promise(resolve => setTimeout(resolve, 30));
  }
  return { peak, rms: Math.sqrt(sum / count) };
});
const instrument = () => page.evaluate(async () => {
  const { GameAudio } = await import('/src/game/audio.ts');
  const original = GameAudio.prototype.play;
  window.__audioEvents = [];
  GameAudio.prototype.play = function(type) {
    const before = this.snapshot().effectsPlayed;
    original.call(this, type);
    if (this.snapshot().effectsPlayed > before) window.__audioEvents.push(type);
  };
});
const report = { engine, signal: {}, scenarios: [] };
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.locator('#loading').waitFor({ state: 'detached' });
  assert.equal((await state()).context, 'locked');
  for (const [id, label] of [['home-achievements', '成就'], ['home-characters', '图鉴']]) {
    assert.equal((await page.locator(`#${id}`).textContent()).trim(), label);
    assert.equal(await page.locator(`#${id} svg[aria-hidden="true"]`).count(), 1);
  }
  assert.equal(await page.locator('#sound, #home-audio, #pause-audio').count(), 0);
  await instrument();
  await page.locator('#settings').tap();
  assert.equal(await page.locator('#settings-title').textContent(), '设置');
  assert.equal(await page.locator('#settings').getAttribute('aria-expanded'), 'true');
  if (engine === 'webkit' && (await state()).context === 'unavailable') {
    const reason = await page.evaluate(() => window.__audioBackendError);
    assert.ok(reason, 'Only a confirmed native constructor failure may use this fallback check');
    await page.locator('#audio-music').fill('32'); await page.locator('#audio-effects').fill('54');
    await capture('settings-no-device'); await page.locator('#settings-done').tap();
    await page.locator('#start').tap(); await page.locator('#hire-soldier').tap();
    assert.equal(await page.evaluate(() => window.__catGame.battle.armies.player.hired), 1);
    await page.locator('#pause').tap(); await page.locator('#settings').tap();
    await page.locator('#audio-enabled').uncheck(); await page.locator('#settings-done').tap();
    await page.reload({ waitUntil: 'networkidle' }); await page.locator('#loading').waitFor({ state: 'detached' });
    assert.equal((await state()).enabled, false); assert.equal((await state()).music, .32);
    await page.locator('#start').tap(); await page.locator('#resume').tap();
    await page.locator('#hire-mouse').tap(); await capture('fallback-battle');
    assert.deepEqual(errors, []);
    writeFileSync(`${output}/${engine}-report.json`, JSON.stringify({ engine, status: 'fallback-passed', limitation: reason, signalVerified: false, scenarios: ['settings', 'recruitment without audio device', 'pause', 'persistence', 'resume'], errors }, null, 2));
    console.log(`PASS WebKit silent fallback; audio signal not tested: ${reason}`);
    await browser.close(); process.exit(0);
  }
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.context === 'running', null, { timeout: 5000 }).catch(async error => { console.log({ audio: await state(), errors }); throw error; });
  assert.equal((await state()).scene, 'menu');
  report.signal.menu = await probe(); assert.ok(report.signal.menu.rms > .001);
  for (const [width, height] of [[320,568], [390,844], [844,390], [1440,900]]) {
    await page.setViewportSize({ width, height });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('#audio-effects').scrollIntoViewIfNeeded();
    await capture(`settings-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#audio-music').fill('0');
  await page.waitForTimeout(350);
  assert.equal((await state()).musicPlaying, false);
  report.signal.musicOff = await probe(); assert.ok(report.signal.musicOff.peak < .0001);
  await page.locator('#audio-preview').tap();
  report.signal.effect = await probe(); assert.ok(report.signal.effect.peak > .01);
  await page.locator('#audio-music').fill('32');
  await page.locator('#audio-effects').fill('54');
  await page.locator('#settings-done').tap();
  await capture('home');
  await page.locator('#home-characters').tap(); await page.locator('#catalog-back').tap();
  await page.locator('#home-achievements').tap(); await page.locator('#achievements-back').tap();
  await page.locator('#start').tap(); await advance(0);
  assert.equal((await state()).scene, 'battle');
  await page.locator('#settings').tap();
  const pausedState = await page.evaluate(() => JSON.stringify(window.__catGame.battle.save()));
  await advance(1500); await page.keyboard.press('1');
  assert.equal(await page.evaluate(() => window.__catGame.battle.phase), 'paused');
  assert.equal(await page.evaluate(() => JSON.stringify(window.__catGame.battle.save())), pausedState);
  await page.locator('#settings-close').tap();
  await page.waitForFunction(() => window.__catGame.battle.phase === 'playing');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'settings');
  assert.equal(await page.locator('#settings').getAttribute('aria-expanded'), 'false');
  report.signal.battle = await probe(); assert.ok(report.signal.battle.rms > .001);
  await page.locator('#hire-soldier').tap(); assert.equal(await events('hire'), 2); // preview + recruit
  await page.evaluate(() => {
    const b = window.__catGame.battle; b.aiEnabled = false;
    b.armies.player.cannonCooldown = b.armies.enemy.cannonCooldown = 999;
    b.summon('enemy', 'soldier');
    for (const unit of b.units) { unit.x = unit.side === 'player' ? 680 : 720; unit.row = unit.targetRow = 1; unit.attackCooldown = 0; }
  });
  await advance(400); assert.ok(await events('hit') > 0);
  const hitCount = await events('hit');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__catGame.render(); });
  assert.equal(await events('hit'), hitCount);
  await page.evaluate(() => { const b = window.__catGame.battle; b.armies.player.energy = 100; window.__catGame.render(); });
  await page.locator('#bombard').tap();
  const impactCount = await events('impact');
  assert.equal(await events('bombard'), 1);
  await page.locator('#pause').tap(); await advance(2000);
  assert.equal((await page.locator('#pause-achievements').textContent()).trim(), '成就');
  assert.equal((await page.locator('#pause-characters').textContent()).trim(), '图鉴');
  assert.equal(await events('impact'), impactCount); assert.equal((await state()).musicPlaying, false);
  await page.waitForTimeout(350); report.signal.paused = await probe(); assert.ok(report.signal.paused.peak < .0001);
  await page.setViewportSize({ width: 320, height: 568 }); await capture('pause-320');
  await page.locator('#settings').tap(); assert.equal((await state()).scene, 'menu');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.scene === 'silent');
  await page.locator('#resume').tap(); await advance(700);
  assert.equal(await events('impact'), impactCount + 1);
  await page.locator('#help').tap(); await page.keyboard.press('m');
  assert.equal((await state()).enabled, false);
  await page.keyboard.press('m'); await page.locator('#guide-close').tap();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.scene === 'battle');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__catGame.render(); });
  assert.equal(await events('impact'), impactCount + 1);
  await page.locator('#speed').tap(); assert.equal((await state()).scene, 'battle');
  await page.keyboard.press('m'); assert.equal((await state()).enabled, false);
  await page.waitForTimeout(350); report.signal.muted = await probe(); assert.ok(report.signal.muted.peak < .0001);
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#loading').waitFor({ state: 'detached' });
  assert.deepEqual(await page.evaluate(() => { const a = JSON.parse(window.render_game_to_text()).audio; return [a.enabled,a.music,a.effects,a.context]; }), [false,.32,.54,'locked']);
  await page.locator('#start').tap(); assert.equal((await state()).scene, 'silent');
  await page.keyboard.press('m'); await page.locator('#resume').tap();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.context === 'running');
  await instrument(); await advance(0);
  assert.equal(await events('impact'), 0);
  await page.evaluate(() => {
    const b = window.__catGame.battle; b.reset('campaign-01'); b.start(); b.aiEnabled = false;
    b.playerRoster = Object.keys(b.armies.player.cooldowns); // Isolate sound from campaign research gates.
    b.armies.player.food = 1000; b.armies.enemy.food = 1000; b.armies.enemy.tech = 2;
    b.summon('enemy', 'shield'); b.units.at(-1).x = 210;
    window.advanceTime(0);
  });
  await page.locator('#upgrade-tech').tap(); await advance(100);
  assert.equal(await events('cannon'), 1);
  await advance(8000); assert.equal(await events('research'), 1);
  await page.locator('#hire-soldier').tap();
  await page.evaluate(() => { const b = window.__catGame.battle; b.units.find(u => u.side === 'player').hp = 100; b.armies.player.energy = 100; window.__catGame.render(); });
  await page.locator('#treat').tap(); assert.equal(await events('treat'), 1);
  await page.locator('#catnip').tap(); assert.equal(await events('catnip'), 1);
  const baseHitsBefore = await events('baseHit');
  await page.waitForTimeout(700); // Separate the new hit from earlier simulated siege damage.
  await page.evaluate(() => { const b = window.__catGame.battle; b.armies.player.hp -= 28; window.__catGame.render(); });
  assert.equal(await events('baseHit'), baseHitsBefore + 1);
  // A dense cluster at full volume must remain bounded and below digital clipping.
  await page.evaluate(async () => {
    const { GameAudio } = await import('/src/game/audio.ts');
    window.__audioMainProbe = window.__audioProbe;
    window.__audioStress = new GameAudio(); window.__audioStress.configure({ music: 0, effects: 1 }); window.__audioStress.unlock();
  });
  // User gesture starts the isolated stress voice pool as required by autoplay policy.
  await page.keyboard.press('m');
  await page.evaluate(() => { window.__audioStress.unlock(); for (let i = 0; i < 200; i++) window.__audioStress.play(['hit','shot','magic','cannon','baseHit','sweep','impact'][i % 7]); });
  assert.ok(await page.evaluate(() => window.__audioStress.snapshot().voices < 48));
  report.signal.crowd = await probe(); assert.ok(report.signal.crowd.peak > .01 && report.signal.crowd.peak < 1);
  await page.evaluate(() => { window.__audioStress.dispose(); window.__audioProbe = window.__audioMainProbe; }); await page.keyboard.press('m');
  await page.locator('#settings').tap();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.equal((await state()).hidden, true); assert.equal((await state()).musicPlaying, false);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.locator('#settings-done').tap();
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).audio.scene === 'silent');
  assert.equal((await state()).scene, 'silent');
  await page.locator('#resume').tap();
  await page.evaluate(() => {
    const b = window.__catGame.battle; b.reset('campaign-30'); b.start(); b.aiEnabled = false;
    b.armies.enemy.hp = 850; window.advanceTime(0); window.advanceTime(100);
  });
  assert.equal((await state()).scene, 'boss'); assert.equal(await events('boss'), 1);
  report.signal.boss = await probe(); assert.ok(report.signal.boss.rms > .001);
  await capture('boss');
  await page.evaluate(() => { const b = window.__catGame.battle; b.armies.enemy.hp = 0; window.advanceTime(100); });
  assert.equal((await state()).scene, 'silent'); assert.equal(await events('win'), 1);
  assert.equal((await page.locator('#result-achievements').textContent()).trim(), '成就');
  await page.evaluate(() => { for (let i = 0; i < 20; i++) window.__catGame.render(); });
  assert.equal(await events('win'), 1);
  await page.waitForTimeout(1800); assert.equal((await state()).voices, 0);
  // Hardware failure must leave recruitment, menus and the mute control usable.
  await page.addInitScript(() => { window.AudioContext = class { constructor() { throw new Error('No audio device'); } }; });
  await page.reload({ waitUntil: 'networkidle' }); await page.locator('#loading').waitFor({ state: 'detached' });
  await page.locator('#choose-level').tap(); await page.locator('#level-campaign-01').tap(); await page.locator('#level-start').tap();
  await page.locator('#hire-soldier').tap();
  assert.equal((await state()).context, 'unavailable');
  assert.ok(await page.evaluate(() => window.__catGame.battle.armies.player.hired > 0));
  assert.deepEqual(errors, []);
  report.scenarios = ['gesture unlock', 'real output signal for three scores and SFX', 'independent volumes', 'four sizes', 'recruit/attack', 'event deduplication', 'delayed impact and pause', 'settings preview', '2x', 'mute silence', 'persistent preferences', 'restored battle', 'cannon/research/treat/catnip/base hit', 'bounded crowd polyphony', 'background pause', 'boss entry', 'single victory jingle', 'voice cleanup', 'no audio device fallback'];
  report.status = 'passed'; report.errors = errors;
  writeFileSync(`${output}/${engine}-report.json`, JSON.stringify(report,null,2));
  console.log(`PASS ${engine}: audio output, silence, persistence, battle cues and four sizes`);
} finally { await browser.close(); }
