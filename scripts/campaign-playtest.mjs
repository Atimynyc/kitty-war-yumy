import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine = process.env.TEST_BROWSER || 'chromium';
const output = path.resolve('test-results/campaign'); mkdirSync(output,{recursive:true});
const browser = await (engine === 'webkit' ? webkit : chromium).launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors = [];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
const advance = ms => page.evaluate(ms=>window.advanceTime(ms),ms);
const capture = name=>page.screenshot({path:path.join(output,`${engine}-${name}.png`),fullPage:true});
const finish = (hp, winner='player') => page.evaluate(({hp,winner})=>{
  const b=window.__catGame.battle; b.aiEnabled=false; b.units=[]; b.effects=[]; b.projectiles=[];
  b.time=90; b.armies.player.hp=hp;
  if(winner==='player') {
    b.armies.enemy.hp=1; b.armies.player.food=1000; b.armies.player.cooldowns.soldier=0;
    b.summon('player','soldier'); Object.assign(b.units.at(-1),{x:1260,row:1,attackCooldown:0});
  } else { b.armies.player.hp=0; b.armies.enemy.hp=winner==='draw'?0:3000; }
  window.advanceTime(1000/30);
}, {hp,winner});

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});
  // Old clearance/time survives, but its old 70% three-star score is not reused.
  await page.evaluate(()=>localStorage.setItem('paw-pantry-progress-v1',JSON.stringify({sunroom:{stars:3,bestTime:60}})));
  await page.reload({waitUntil:'networkidle'}); await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('#choose-level').click();
  assert.match(await page.locator('[data-record="sunroom"]').textContent(),/再次挑战评星/);
  for(const [id,grace] of [['sunroom',8],['cardboard',4],['pantry',2]]) {
    assert.match(await page.locator(`#level-${id} .level-rule`).textContent(),new RegExp(`${grace} 秒`));
    await page.locator(`#level-${id}`).click(); await page.locator('#level-start').click(); await advance(0);
    await page.evaluate(id=>{const b=window.__catGame.battle;b.reset(id);b.start();},id);
    await advance((grace-.1)*1000); assert.equal(await page.evaluate(()=>window.__catGame.battle.armies.enemy.hired),0);
    await advance(200); assert.ok(await page.evaluate(()=>window.__catGame.battle.armies.enemy.hired)>0);
    await capture(`first-wave-${id}`);
    await page.locator('#pause').click(); await page.locator('#pause-levels').click();
  }
  await page.locator('#level-sunroom').click(); await page.locator('#level-start').click(); await advance(0);
  let best=0;
  for(const [hp,stars] of [[1500,2],[1499,1],[2999.9,2],[3000,3],[1,1],[1500.01,2]]) {
    await finish(hp); best=Math.max(best,stars);
    assert.equal(await page.locator('.result-stars').getAttribute('data-stars'),String(stars));
    assert.equal(await page.locator('.result-star.earned').count(),stars);
    const state = await page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    assert.equal(state.phase,'ended'); assert.equal(state.result.stars,stars);
    const record=await page.evaluate(()=>JSON.parse(localStorage.getItem('paw-pantry-progress-v1')).sunroom);
    assert.equal(record.stars,best); assert.equal(record.ratingVersion,2); assert.equal(record.bestTime,60);
    await capture(`result-${hp}-${stars}-stars`);
    if(hp===3000) {
      await page.setViewportSize({width:320,height:568}); await page.waitForTimeout(150);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.ok(await page.evaluate(()=>{const el=document.querySelector('#battle-overlay');return el.scrollWidth<=el.clientWidth+1;}));
      assert.ok(await page.evaluate(()=>['.result-stars','#play-again','#next-level','#result-levels'].every(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;})),'small phone must show stars and every result action without scrolling');
      await capture('small-phone-three-stars');
      await page.locator('#next-level').scrollIntoViewIfNeeded(); await page.locator('#next-level').click();
      assert.equal(await page.evaluate(()=>window.__catGame.battle.level.id),'cardboard');
      await page.locator('#pause').click(); await page.locator('#pause-levels').click();
      await page.locator('#level-sunroom').click(); await page.locator('#level-start').click();
      await page.setViewportSize({width:390,height:844}); await advance(0);
    } else await page.locator('#play-again').click();
  }
  const saved=await page.evaluate(()=>localStorage.getItem('paw-pantry-progress-v1'));
  for(const winner of ['enemy','draw']) {
    await finish(0,winner);
    assert.equal(await page.locator('.result-star.earned').count(),0);
    assert.equal(await page.locator('#next-level').count(),0);
    assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).result.stars),0);
    assert.equal(await page.evaluate(()=>localStorage.getItem('paw-pantry-progress-v1')),saved);
    await capture(`result-${winner}`); await page.locator('#play-again').click();
  }
  await page.reload({waitUntil:'networkidle'}); await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('#choose-level').click();
  assert.match(await page.locator('[data-record="sunroom"]').textContent(),/★★★ 已通关 · 最快 60 秒/);
  await capture('saved-stars'); assert.deepEqual(errors,[]);
  writeFileSync(path.join(output,`${engine}-report.json`),JSON.stringify({status:'passed',engine,scenarios:['first waves 8/4/2 seconds','full health and 50% rating boundaries','one/two/three stars','legacy save migration','best stars and time persist','defeat/draw award no stars','320px result scrolling and next level','reload saved score'],errors},null,2));
  console.log(`PASS ${engine}: campaign pacing, result stars and saved progress`);
} finally {await browser.close();}
