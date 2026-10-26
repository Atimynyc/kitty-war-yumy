import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine = process.env.TEST_BROWSER || 'chromium';
const output = 'test-results/story'; mkdirSync(output,{recursive:true});
const browser = await (engine==='webkit' ? webkit : chromium).launch({headless:true});
const page = await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors = [];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
const advance = ms => page.evaluate(ms=>window.advanceTime(ms),ms);
const read = () => page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const capture = name=>page.screenshot({path:`${output}/${engine}-${name}.png`,fullPage:true});
const bubble = page.locator('#enemy-cat-speech');
const damage = side => page.evaluate(side=>{
  const b=window.__catGame.battle; b.units=[]; b.effects=[]; b.projectiles=[];
  b.armies[side].food=1000;b.armies[side].cooldowns.soldier=0;
  b.summon(side,'soldier');
  Object.assign(b.units.at(-1),{x:side==='enemy'?175:1265,row:1,targetRow:1,attackCooldown:0});
  window.advanceTime(1000/30);
},side);

try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});
  assert.match(await page.locator('.home-lead').textContent(),/大胖橘/);
  await page.locator('#start').click(); await advance(0);
  await page.evaluate(()=>{window.__catGame.battle.aiEnabled=false;});
  assert.equal(await bubble.textContent(),'我要吃冻干！快给我！');
  assert.equal((await read()).baseCats.enemy.mood,'hungry');
  await capture('opening');
  await page.locator('.arena-frame').screenshot({path:`${output}/${engine}-battle-preview.png`});
  await page.locator('#pause').click();const paused=(await read()).baseCats;
  await advance(10000);assert.deepEqual((await read()).baseCats,paused);
  await page.locator('#resume').click(); await advance(5500);
  assert.equal(await bubble.isVisible(),false);
  await damage('enemy'); assert.equal(await bubble.textContent(),'真好吃！');
  assert.ok((await read()).player.hp<3000); await capture('feast');
  const startedAt=(await read()).baseCats.enemy.startedAt;
  await advance(1700); assert.equal((await read()).baseCats.enemy.startedAt,startedAt);
  await damage('player'); assert.equal(await bubble.textContent(),'不！我自己都不够吃。');
  assert.ok((await read()).enemy.hp<3000); await capture('protect');
  await advance(4400); assert.equal(await bubble.isVisible(),false);
  await page.locator('#pause').click(); await page.locator('#restart').click(); await advance(0);
  assert.equal(await bubble.textContent(),'我要吃冻干！快给我！');
  assert.equal((await read()).player.hp,3000);
  // Speech never claims a click or hides the recruitment controls, including small viewports.
  for(const [name,width,height] of [['tiny',320,568],['fold',344,882],['rotated',844,390],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(180);await advance(0);
    const within = await page.evaluate(()=>{
      const r=document.querySelector('#enemy-cat-speech').getBoundingClientRect(),f=document.querySelector('.arena-frame').getBoundingClientRect();
      return {inside:r.x>=f.x&&r.right<=f.right&&r.y>=f.y&&r.bottom<=f.bottom,pointer:getComputedStyle(document.querySelector('#enemy-cat-speech')).pointerEvents};
    });
    assert.equal(within.inside,true,name);assert.equal(within.pointer,'none');
    await capture(name);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(180);
  await page.locator('#hire-soldier').click();assert.equal((await read()).player.hired,1);
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(150);await advance(0);
  await capture('reduced-motion');
  await page.locator('#pause').click();await page.locator('#pause-home').click();
  await page.locator('#start').click();await advance(0);
  assert.equal(await bubble.textContent(),'我要吃冻干！快给我！');
  // Saved battles resume paused; exercise the real resume action before damage.
  await page.locator('#resume').click();await advance(0);
  await page.evaluate(()=>{window.__catGame.battle.armies.enemy.hp=1;});
  await damage('player');
  assert.equal((await read()).phase,'ended');assert.equal(await bubble.isVisible(),false);
  assert.equal((await read()).baseCats.enemy.speechVisible,false);
  await page.locator('#play-again').click();await advance(0);
  assert.equal(await bubble.textContent(),'我要吃冻干！快给我！');
  writeFileSync(`${output}/${engine}-state.json`,JSON.stringify(await read(),null,2));
  assert.deepEqual(errors,[]);
  console.log(`PASS ${engine}: story cues, damage, pause, restart, expiry and four viewport layouts`);
} finally {await browser.close();}
