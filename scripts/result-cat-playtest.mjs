import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/result-cat';
mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const snap=name=>page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});
const frame=async time=>{
  await page.evaluate(time=>document.getAnimations().filter(a=>a.effect?.target?.closest('.result-mascot')).forEach(a=>{a.pause();a.currentTime=time;}),time);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
};
const finish=async(winner='player',hp=3000)=>{
  await page.evaluate(({winner,hp})=>{
    const b=window.__catGame.battle;
    b.armies.player.hp=winner==='player'?hp:0;b.armies.enemy.hp=winner==='enemy'?3000:0;
    b.phase='ended';b.winner=winner;window.__catGame.render();
  },{winner,hp});
  await page.locator('.result-cat').waitFor();
};
const fit=async label=>{
  const geometry=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    return {width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,
      cat:box(document.querySelector('.result-mascot')),stars:box(document.querySelector('.result-stars')),
      buttons:[...document.querySelectorAll('.result-card button')].map(e=>({id:e.id,...box(e),enabled:!e.disabled}))};
  });
  assert.ok(geometry.scroll<=geometry.width,`${label}: horizontal overflow`);
  assert.ok(geometry.cat.bottom<=geometry.stars.y+1,`${label}: cat belongs above stars`);
  for(const b of geometry.buttons) {
    assert.ok(b.enabled&&b.height>=44,`${label}/${b.id}: button ready and touch sized`);
    assert.ok(b.y>=0&&b.bottom<=geometry.height&&b.x>=0&&b.right<=geometry.width,`${label}/${b.id}: button on screen ${JSON.stringify(geometry)}`);
  }
  report.push({label,geometry});
};
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#home-cat').disabled);
  await page.evaluate(()=>window.advanceTime(0));
  // Save through the real editor so the result must use the player's applied appearance.
  await page.locator('#home-cat').click();
  await page.locator('[data-cat-feature="breed"][data-cat-value="ragdoll"]').click();
  await page.locator('[data-cat-tab="coat"]').click();await page.locator('[data-cat-palette="3"]').click();
  await page.locator('#cat-save').click();
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).catEditor.dirty&&!JSON.parse(window.render_game_to_text()).catEditor.busy);
  const cat=await page.evaluate(()=>window.__catGame.getProfile().cat);
  await page.locator('#cat-back').click();await page.locator('#start').click();await finish();
  assert.equal((await read()).result.catMood,'happy');
  assert.equal(await page.locator('.result-cat-head path').first().getAttribute('fill'),cat.coat.head);
  assert.equal(await page.locator('.result-star.earned').count(),3);
  assert.equal(await page.locator('.result-confetti i').count(),22);
  assert.doesNotMatch(await page.locator('.result-card').textContent(),/本局新成就|即将获得|满血获胜/);
  const transform=()=>page.locator('.result-cat-hands').evaluate(e=>getComputedStyle(e).transform);
  const before=await transform();await page.waitForTimeout(180);assert.notEqual(await transform(),before,'celebration moves while battle time is stopped');
  const battleTime=(await read()).time;
  for(const t of [0,350,800,1300,2200]) {await frame(t);await snap(`happy-frame-${t}`);}
  assert.equal((await read()).time,battleTime,'presentation never advances combat');
  await frame(3000);
  assert.ok(await page.locator('.result-confetti i').evaluateAll(es=>es.every(e=>Number(getComputedStyle(e).opacity)===0)),'confetti finishes');
  await page.locator('#result-achievements').click();await page.locator('#achievements-back').click();
  assert.equal(await page.locator('.result-confetti').count(),0,'returning does not replay the celebration');
  await page.locator('#next-level').click();assert.equal((await read()).phase,'playing');
  await finish('enemy');assert.equal((await read()).result.catMood,'sad');
  assert.equal(await page.locator('.result-confetti').count(),0);
  assert.match(await page.locator('.result-card').textContent(),/差一点，再陪我试一次吧/);
  assert.equal(await page.locator('.result-cat-head path').first().getAttribute('fill'),cat.coat.head);
  for(const t of [0,1500,1900,2400]) {await frame(t);await snap(`sad-frame-${t}`);}
  await page.locator('#play-again').click();assert.equal((await read()).phase,'playing');
  assert.equal(await page.locator('.result-mascot').count(),0);
  for(const [label,width,height] of [['tiny',320,568],['phone',390,844],['short',360,640],['landscape',844,390],['small-landscape',667,375],['desktop',1440,900]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(120);
    for(const winner of ['player','enemy']) {
      await finish(winner,1800);await frame(800);await fit(`${label}-${winner}`);await snap(`${label}-${winner}`);
      assert.equal(await page.locator('.result-star.earned').count(),winner==='player'?2:0,'real rating preserved');
      await page.locator('#play-again').click();
    }
  }
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(120);await finish();
  assert.equal(await page.locator('.result-confetti').isVisible(),false);
  assert.equal(await page.locator('.result-cat-hop').evaluate(e=>getComputedStyle(e).animationName),'none');
  await snap('reduced-happy');await page.locator('#play-again').click();await finish('enemy');
  assert.equal(await page.locator('.result-cat-tears').isVisible(),false);
  const still=await page.locator('.result-cat-head-group').evaluate(e=>getComputedStyle(e).transform);
  await page.waitForTimeout(150);assert.equal(await page.locator('.result-cat-head-group').evaluate(e=>getComputedStyle(e).transform),still);
  await snap('reduced-sad');await page.locator('#play-again').click();
  await page.emulateMedia({reducedMotion:'no-preference'});await finish('draw');
  assert.equal((await read()).result.catMood,'calm');assert.equal(await page.locator('.result-confetti,.result-cat-tears').count(),0);
  await page.locator('#result-levels').click();await page.locator('#levels-back').click();
  await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#start').disabled);
  await page.evaluate(()=>window.advanceTime(0));await page.locator('#start').click();await finish();
  assert.equal(await page.locator('.result-cat-head path').first().getAttribute('fill'),cat.coat.head,'saved appearance survives reload');
  // A chapter finale adds both chapter and partner rewards: verify the longest small-screen result.
  while ((await read()).level!=='campaign-05') {await page.locator('#next-level').click();await finish();}
  assert.equal(await page.locator('.chapter-reward,.unit-reward').count(),2);
  for(const [label,width,height] of [['chapter-tiny',320,568],['chapter-landscape',667,375]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(120);await frame(800);await fit(label);await snap(label);
  }
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',errors,report},null,2));
  console.log(`PASS ${engine}: custom cat, happy/sad animation, confetti duration, rating, immediate actions, navigation, reload, six viewports and reduced motion`);
} catch(error) {await snap('FAILURE');throw error;} finally {await browser.close();}
