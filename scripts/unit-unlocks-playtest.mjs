import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/unit-unlocks';mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const key='paw-pantry-progress-qa-v3',errors=[];
let context,page;
const profileTo=stage=>({version:4,campaign:Object.fromEntries(Array.from({length:stage-1},(_,i)=>[`campaign-${String(i+1).padStart(2,'0')}`,{stars:1,bestTime:240,ratingVersion:2}])),legacy:{},legacyRecruits:[]});
async function boot(profile=null){
  if(context)await context.close();
  context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
  if(profile)await context.addInitScript(({key,profile})=>{if(!localStorage.getItem(key))localStorage.setItem(key,JSON.stringify(profile));},{key,profile});
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.waitForFunction(()=>!document.getElementById('start').disabled);
}
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function capture(name){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});}
async function win(){await page.evaluate(()=>{const b=window.__catGame.battle;b.armies.enemy.hp=0;b.step(.01);window.__catGame.render();});await page.locator('#next-level').waitFor();}
try {
  await boot();await page.locator('#choose-level').tap();await page.locator('#level-campaign-03').tap();
  assert.equal(await page.locator('#level-start').isDisabled(),true);
  assert.match(await page.locator('#selected-unit-arrivals').textContent(),/到达本关解锁.*毛球投手/);
  assert.deepEqual((await read()).roster.permanent,['mouse','soldier']);await capture('locked-preview');
  await page.locator('#levels-back').tap();await page.locator('#start').tap();await advance(0);
  assert.deepEqual((await read()).roster.available,['mouse','soldier']);
  assert.match(await page.locator('#hire-shield').textContent(),/第 4 关/);
  assert.match(await page.locator('#upgrade-tech').getAttribute('aria-label'),/第 3 关解锁二阶科技/);
  assert.equal(await page.locator('#upgrade-tech').isDisabled(),true);
  const lockedArmy=(await read()).player;
  await page.keyboard.press('KeyT');
  assert.equal(await page.evaluate(()=>window.__catGame.battle.researchTech('player')),false);
  assert.deepEqual((await read()).player,lockedArmy,'locked research does not spend food or start a timer');
  await page.evaluate(()=>{const b=window.__catGame.battle;b.armies.player.tech=3;b.armies.player.food=5000;window.__catGame.render();});
  const before=(await read()).player;await page.keyboard.press('Digit3');await page.keyboard.press('Shift+Digit1');
  assert.equal(await page.evaluate(()=>window.__catGame.battle.summon('player','knight')),false);
  assert.deepEqual((await read()).player,before,'shortcuts and direct simulation calls respect stage locks');
  await page.evaluate(()=>{window.__catGame.battle.armies.player.tech=1;window.__catGame.render();});
  for(const [name,width,height] of [['tiny',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]){
    await page.setViewportSize({width,height});await capture(name);
    const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.unit-card')].map(e=>({w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height}))}));
    assert.ok(geometry.scroll<=geometry.width);assert.ok(geometry.cards.every(r=>r.w>=44&&r.h>=44));
  }
  await page.setViewportSize({width:390,height:844});await win();await page.locator('#next-level').tap();await advance(0);await win();
  assert.match(await page.locator('.unit-reward').textContent(),/毛球投手/);await capture('reward');
  await page.locator('#next-level').tap();await advance(0);assert.equal((await read()).roster.available.length,3);
  assert.match(await page.locator('#hire-slinger').textContent(),/需二阶/);assert.equal(await page.locator('#hire-slinger .unit-new').isVisible(),true);
  await page.locator('#upgrade-tech').tap();await advance(8100);assert.equal((await read()).player.tech,2);
  assert.equal(await page.locator('#upgrade-tech').isDisabled(),true);
  assert.match(await page.locator('#upgrade-tech').getAttribute('aria-label'),/第 11 关解锁三阶/);
  await page.locator('#hire-slinger').tap();assert.ok((await read()).units.some(u=>u.side==='player'&&u.kind==='slinger'));
  assert.equal(await page.locator('#hire-shield').isDisabled(),true);await capture('first-ranged');
  await page.locator('#pause').tap();const saved=await page.evaluate(()=>window.__catGame.battle.save());
  await page.locator('#pause-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('#start').tap();
  assert.equal((await read()).phase,'paused');assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),saved);
  await page.locator('#resume').tap();await page.locator('#pause').tap();await page.locator('#restart').tap();
  assert.equal((await read()).roster.available.length,3);assert.equal((await read()).player.tech,1);

  await boot(profileTo(8));await page.locator('#choose-level').tap();await page.locator('#level-campaign-08').tap();
  assert.match(await page.locator('#selected-unit-arrivals').textContent(),/雨伞护卫猫.*不能解除迟缓/);await capture('counter-preview');
  await page.locator('#level-start').tap();await advance(0);assert.equal((await read()).roster.available.length,6);
  await page.locator('#upgrade-tech').tap();await advance(8100);await page.keyboard.press('Shift+Digit5');
  assert.ok((await read()).units.some(u=>u.side==='player'&&u.kind==='umbrella'));await capture('umbrella-unlocked');

  // A real old-version suspended round retains its complete recruitment choices.
  const old=await page.evaluate(()=>{
    const b=window.__catGame.battle;b.reset('campaign-01',Object.keys(b.armies.player.cooldowns));b.start();b.armies.player.tech=3;b.armies.player.food=1000;b.summon('player','gunner');b.catnip('player');
    const save=b.save();save.rules='0.19.0';delete save.playerRoster;delete save.legacyRoster;
    return{version:3,campaign:{},legacy:{},achievements:{stats:{recruited:['gunner']}},run:{battle:save,speed:1,awards:[]}};
  });
  await boot(old);await page.locator('#start').tap();assert.equal((await read()).phase,'paused');
  assert.equal((await read()).roster.available.length,16);assert.equal((await read()).roster.legacyRound,true);
  assert.ok((await read()).roster.permanent.includes('gunner'));assert.ok(!(await read()).roster.permanent.includes('knight'));
  await page.locator('#resume').tap();await page.locator('#hire-knight').tap();
  assert.ok((await read()).units.some(u=>u.kind==='knight'));
  await page.locator('#pause').tap();await page.locator('#pause-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('#start').tap();
  assert.ok((await read()).roster.permanent.includes('knight'));await page.locator('#restart').tap();
  assert.equal((await read()).roster.available.length,4);assert.equal((await read()).roster.legacyRound,false);await capture('legacy-recruits');

  await boot(profileTo(24));await page.locator('#choose-level').tap();await page.locator('[data-chapter="1"]').tap();await page.locator('#level-campaign-01').tap();await page.locator('#level-start').tap();await advance(0);
  assert.equal((await read()).level,'campaign-01');assert.equal((await read()).roster.available.length,16);
  assert.match(await page.locator('#hire-knight').textContent(),/需三阶/);await capture('replay');
  await page.locator('#upgrade-tech').tap();await advance(8100);
  await page.evaluate(()=>{window.__catGame.battle.armies.player.food=500;window.__catGame.render();});
  await page.locator('#upgrade-tech').tap();await advance(12100);assert.equal((await read()).player.tech,3);
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',engine,errors,scenarios:['preview cannot unlock','simulation and keyboard gates','four screen sizes','victory before unlock encounter','real research and recruitment','pause reload restart','counter lesson and umbrella','0.19 suspended round and inherited recruits','late-progress replay keeps all partners']},null,2));
  console.log(`PASS ${engine}: permanent unlocks, research, saved rounds, migration, replay and four screen sizes`);
}finally{await browser.close();}
