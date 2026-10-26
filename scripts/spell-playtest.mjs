import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',output='test-results/spells-0.19';
mkdirSync(output,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const paint=async()=>{const f=await page.evaluate(()=>window.__catGame.getView().renderFrame);await page.waitForFunction(f=>window.__catGame.getView().renderFrame>f+1,f);};
const capture=async name=>{await paint();await page.screenshot({path:`${output}/${engine}-${name}.png`,fullPage:true});};
const fixture=()=>page.evaluate(()=>{
  const b=window.__catGame.battle;b.reset();b.start();b.aiEnabled=false;
  b.playerRoster=Object.keys(b.armies.player.cooldowns); // Isolate skill mechanics from campaign unlocks.
  b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;
  for(const side of ['player','enemy'])for(const row of [0,1,2]){
    const a=b.armies[side];a.food=1000;a.tech=3;a.cooldowns.shield=0;b.summon(side,'shield');
    Object.assign(b.units.at(-1),{x:side==='player'?650:720,row,targetRow:row,attackCooldown:1000,hp:side==='player'?300:700});
  }
  b.armies.player.energy=100;window.advanceTime(0);
});
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.locator('#start').tap();await advance(0);
  assert.equal(await page.locator('#roar').count(),0);
  for(const id of ['treat','catnip','bombard'])assert.equal(await page.locator(`#${id}`).isDisabled(),true);
  await page.locator('#hire-soldier').tap();await page.locator('#catnip').tap();
  assert.equal((await read()).player.energy,10);assert.equal((await read()).spells.costs.catnip,40);
  assert.match(await page.locator('#catnip').getAttribute('aria-label'),/能量不足/);await capture('opening-mint');
  await fixture();await page.evaluate(()=>{window.__catGame.battle.armies.player.energy=50;window.__catGame.render();});
  await page.locator('#treat').tap();assert.equal((await read()).player.energy,15);
  assert.ok((await read()).units.filter(u=>u.side==='player').every(u=>u.hp===510));
  assert.match(await page.locator('.spell-notice.player').textContent(),/急救罐头.*35.*共恢复 630/);await capture('treat');
  await fixture();await page.locator('#bombard').tap();assert.equal((await read()).player.energy,30);
  await advance(300);assert.equal((await read()).spells.pending.length,1);assert.ok((await read()).units.filter(u=>u.side==='enemy').every(u=>u.hp===700));
  await capture('bomb-warning');await page.locator('#pause').tap();const saved=await page.evaluate(()=>window.__catGame.battle.save());
  await advance(2000);assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),saved);
  await page.locator('#pause-home').tap();await page.reload({waitUntil:'networkidle'});await page.locator('#loading').waitFor({state:'detached'});
  await page.locator('#start').tap();assert.equal((await read()).phase,'paused');assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),saved);
  await page.locator('#resume').tap();await advance(400);
  assert.equal((await read()).spells.pending.length,0);assert.ok((await read()).units.filter(u=>u.side==='enemy').every(u=>u.hp===400));await capture('bomb-impact');
  await advance(900);assert.ok((await read()).units.filter(u=>u.side==='enemy').every(u=>u.hp===400));
  await fixture();await page.evaluate(()=>{const b=window.__catGame.battle;b.armies.enemy.energy=100;b.bombard('enemy');b.treat('player');window.__catGame.render();});
  assert.equal(await page.locator('.spell-notice').count(),2);await capture('two-armies');
  for(const [name,width,height] of [['tiny',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});await paint();await advance(0);
    const geometry=await page.evaluate(()=>{
      const r=e=>{const a=e.getBoundingClientRect();return{x:a.x,y:a.y,right:a.right,bottom:a.bottom,width:a.width,height:a.height};};
      return {frame:r(document.querySelector('.arena-frame')),controls:['treat','catnip','bombard'].map(id=>r(document.getElementById(id))),scroll:document.documentElement.scrollWidth,viewport:innerWidth};
    });
    assert.ok(geometry.scroll<=geometry.viewport);
    for(const r of geometry.controls){assert.ok(r.width>=44&&r.height>=44,name);assert.ok(r.y>=geometry.frame.y&&r.bottom<=geometry.frame.bottom,name);}
    await capture(name);
  }
  await page.setViewportSize({width:390,height:844});await fixture();await page.keyboard.press('h');assert.equal((await read()).player.energy,65);
  await page.keyboard.press('c');assert.equal((await read()).player.energy,25);
  await page.evaluate(()=>{window.__catGame.battle.armies.player.energy=70;window.__catGame.render();});
  await page.keyboard.press('Space');assert.equal((await read()).player.energy,0);
  await page.emulateMedia({reducedMotion:'reduce'});await advance(300);await capture('reduced-motion');
  await page.locator('#pause').tap();await page.locator('#restart').tap();await advance(0);
  assert.equal((await read()).player.energy,50);assert.equal((await read()).spells.pending.length,0);assert.equal(await page.locator('.spell-notice').count(),0);
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/${engine}-report.json`,JSON.stringify({status:'passed',engine,errors,scenarios:['normal-resource mint','three prices','actual group heal','telegraph and delayed damage','save/reload during fall','pause and single impact','enemy notices','four sizes and touch targets','keyboard','reduced motion','restart']},null,2));
  console.log(`PASS ${engine}: three spells, energy, impact, saved flight, four viewports and keyboard`);
} finally {await browser.close();}
