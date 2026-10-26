import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/cat-idle';mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}), errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const capture=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});};
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await advance(0);await page.locator('#start').click();await advance(0);
  await page.evaluate(()=>{window.__catGame.battle.aiEnabled=false;});
  const first=(await read()).baseCats.animation;await capture('opening');
  const samples=[];
  if(engine==='chromium')mkdirSync(`${out}/frames`,{recursive:true});
  for(let i=0;i<130;i++) {
    await advance(100);const state=await read();samples.push(state.baseCats.animation);
    if(engine==='chromium'&&i<65&&i%2===0)await page.locator('#battle-canvas canvas').screenshot({path:`${out}/frames/${String(i).padStart(3,'0')}.png`});
    if(i===4||i===23||i===40||i===80)await capture(`pose-${i}`);
  }
  for(const side of ['player','enemy']){
    const all=samples.map(s=>s[side]);
    assert.ok(all.every(s=>s.visible));
    for(const key of ['body','tail','eyes','leftEar','rightEar'])assert.ok(new Set(all.map(s=>JSON.stringify(s.parts[key]))).size>2,`${side}: ${key} animates`);
    assert.ok(all.some(s=>s.parts.eyes.scaleY<.2),`${side}: eyes actually close`);
    assert.ok(new Set(all.map(s=>JSON.stringify(s.head))).size>20,`${side}: head moves`);
    assert.ok(all.every(s=>JSON.stringify(s.parts.feet)===JSON.stringify(first[side].parts.feet)),`${side}: feet anchored`);
    assert.ok(all.every(s=>JSON.stringify(s.parts.shadow)===JSON.stringify(first[side].parts.shadow)),`${side}: shadow anchored`);
  }
  assert.ok(samples.some(s=>s.player.parts.eyes.scaleY<.2&&s.enemy.parts.eyes.scaleY>.9),'offset blink schedules');
  await page.locator('#pause').click();await advance(0);
  const paused=(await read()).baseCats.animation, checkpoint=await page.evaluate(()=>window.__catGame.battle.save());
  await advance(20000);await page.waitForTimeout(200);
  assert.deepEqual((await read()).baseCats.animation,paused);assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint);
  await page.locator('#pause-characters').click();await advance(5000);await page.locator('#catalog-back').click();await advance(0);
  assert.deepEqual((await read()).baseCats.animation,paused,'catalog roundtrip preserves pose');
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.locator('#start').click();await advance(0);
  await page.waitForFunction(()=>window.__catGame.getView().height===Math.round(document.getElementById('battle-canvas').getBoundingClientRect().height));await advance(0);
  assert.deepEqual((await read()).baseCats.animation,paused,'reload derives the identical paused pose');
  await page.locator('#resume').click();await advance(400);assert.notDeepEqual((await read()).baseCats.animation,paused);
  await page.emulateMedia({reducedMotion:'reduce'});await advance(0);const reduced=(await read()).baseCats.animation;
  await advance(3000);assert.deepEqual((await read()).baseCats.animation,reduced);await capture('reduced-motion');
  await page.emulateMedia({reducedMotion:'no-preference'});await advance(0);
  // Clear the persisted round through the real restart control; visual phase returns to time zero.
  await page.locator('#pause').click();await page.locator('#restart').click();await advance(0);
  assert.deepEqual((await read()).baseCats.animation,first);
  await page.evaluate(()=>{window.__catGame.battle.aiEnabled=false;});await advance(700);
  for(const [name,width,height] of [['tiny',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(160);await advance(0);await capture(name);
    const state=await read(), view=await page.evaluate(()=>window.__catGame.getView());
    for(const pose of Object.values(state.baseCats.animation)){
      const size=pose.scaleX*160;
      assert.ok(pose.x-size/2>=-1&&pose.x+size/2<=view.width+1&&pose.y<=view.height&&pose.y-size>=0,`${name}: mascot stays in canvas`);
    }
  }
  // Existing narrative expressions and final-boss handoff share the same puppet.
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);
  await page.evaluate(()=>{const b=window.__catGame.battle;b.baseDialogue.onBaseDamage(b.time,10,0);});await advance(100);
  assert.equal((await read()).baseCats.animation.enemy.mood,'happy');await capture('happy');
  await page.evaluate(()=>{const b=window.__catGame.battle;b.baseDialogue.onBaseDamage(b.time,0,10);});await advance(100);
  assert.equal((await read()).baseCats.animation.enemy.mood,'worried');await capture('worried');
  await page.evaluate(()=>{
    const b=window.__catGame.battle;b.reset('campaign-30');b.start();b.aiEnabled=false;b.armies.enemy.hp=901;b.summon('player','soldier');
    Object.assign(b.units[0],{x:1265,row:1,targetRow:1,attackCooldown:0});window.advanceTime(1000/30);
  });
  assert.equal((await read()).boss.spawned,true);assert.equal((await read()).baseCats.animation.enemy.visible,false);
  assert.equal((await read()).baseCats.animation.player.visible,true);await capture('boss-leaves-cushion');
  await page.evaluate(()=>{const b=window.__catGame.battle;b.reset('campaign-01');b.start();b.aiEnabled=false;window.advanceTime(1200);b.armies.enemy.hp=0;window.advanceTime(40);});
  assert.equal((await read()).phase,'ended');const ended=(await read()).baseCats.animation;await advance(4000);assert.deepEqual((await read()).baseCats.animation,ended);
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',engine,errors,samples,checks:['independent body head tail ear and blink motion','grounded feet and shadows','offset phases','pause and catalog freeze','exact restored pose','reduced motion','restart','four sizes','all dialogue moods','boss handoff','end freeze']},null,2));
  console.log(`PASS ${engine}: seated idle motion, pause, reload, reduced motion, resize, mood and boss handoff`);
}catch(error){await capture('FAILURE');throw error;}finally{await browser.close();}
