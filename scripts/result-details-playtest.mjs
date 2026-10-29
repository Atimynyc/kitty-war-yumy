import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/result-details';
mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
const errors=[],report=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const snap=name=>page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});
const ready=async()=>{await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#start').disabled);await page.evaluate(()=>window.advanceTime(0));};
const finish=async(winner='player',hp=1800)=>{
  await page.evaluate(({winner,hp})=>{const b=window.__catGame.battle;b.time=187;b.armies.player.hp=hp;b.armies.enemy.hp=winner==='enemy'?3000:0;b.phase='ended';b.winner=winner;window.__catGame.render();},{winner,hp});
  await page.locator('#result-detail').waitFor();
  assert.equal(await page.locator('.result-rating,.result-stats').count(),0);
  assert.doesNotMatch(await page.locator('.result-card').textContent(),/三星|二星|一星|本次未通关|战斗时长|招募伙伴|我方基地剩余|剩余耐久/);
  const aligned=await page.evaluate(()=>{const a=document.querySelector('#result-achievements').getBoundingClientRect(),b=document.querySelector('#result-detail').getBoundingClientRect();return Math.abs(a.y-b.y)<1&&b.x>=a.right;});
  assert.ok(aligned,'details sits beside achievements');
};
const checkDetails=async(label,expected)=>{
  assert.equal((await read()).screen,'details');
  const rows=await page.locator('.recruit-report-row').evaluateAll(es=>es.map(e=>({kind:e.dataset.kind,count:Number(e.dataset.count)})));
  assert.deepEqual(rows,expected);
  assert.deepEqual(rows,(await read()).result.details.recruits,'visible report matches text state');
  assert.ok(await page.locator('.recruit-report-row img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0)),'portraits loaded');
  const geometry=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const body=document.querySelector('#result-detail-body');
    return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,
      back:rect(document.querySelector('#result-detail-back')),body:rect(body),bodyWidth:body.scrollWidth,bodyClient:body.clientWidth,
      stats:[...document.querySelectorAll('.battle-report-stats dd')].map(e=>({scroll:e.scrollWidth,client:e.clientWidth}))};
  });
  assert.ok(geometry.scrollWidth<=geometry.width&&geometry.scrollHeight<=geometry.height,`${label}: page fits`);
  assert.ok(geometry.back.width>=44&&geometry.back.height>=44&&geometry.back.y>=0&&geometry.back.bottom<=geometry.height,`${label}: back is visible`);
  assert.ok(geometry.back.x<geometry.width/2,`${label}: back is on the left`);
  assert.ok(geometry.bodyWidth<=geometry.bodyClient+1&&geometry.stats.every(s=>s.scroll<=s.client+1),`${label}: no clipped text`);
  const last=page.locator('.recruit-report-row').last();
  if(await last.count()) {await last.scrollIntoViewIfNeeded();assert.ok(await last.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'last recruit is reachable');}
  assert.ok(await page.locator('#result-detail-back').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'back stays visible after scrolling');
  await page.locator('#result-detail-body').evaluate(e=>e.scrollTop=0);
  await snap(label);report.push({label,rows,geometry});
};
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});await ready();
  await page.locator('#start').click();await page.evaluate(()=>window.__catGame.battle.aiEnabled=false);
  // Real buttons, normal starting resources and income; include a departed partner.
  await page.locator('#hire-soldier').click();await page.locator('#hire-mouse').click();
  await page.evaluate(()=>window.advanceTime(6000));await page.locator('#hire-soldier').click();await page.locator('#hire-mouse').click();
  await page.evaluate(()=>window.advanceTime(6000));await page.locator('#hire-soldier').click();
  await page.evaluate(()=>{const b=window.__catGame.battle;b.units.find(u=>u.side==='player'&&u.kind==='soldier').hp=0;window.advanceTime(20);});
  assert.equal((await read()).player.hired,5);
  assert.equal((await read()).units.filter(u=>u.side==='player').length,4);
  await page.locator('#pause').click();await page.locator('#pause-home').click();await page.reload({waitUntil:'networkidle'});await ready();
  await page.locator('#start').click();assert.equal((await read()).phase,'paused');await page.locator('#resume').click();
  await page.evaluate(()=>window.advanceTime(6000));await page.locator('#hire-soldier').click();await finish();
  const expected=[{kind:'soldier',count:4},{kind:'mouse',count:2}];
  const before=(await read()).result;
  await snap('result-clean');await page.locator('#result-detail').click();
  await checkDetails('normal-report',expected);
  assert.equal(await page.locator('#detail-duration').textContent(),'03:07');
  assert.equal(await page.locator('#detail-total').textContent(),'6 位');
  assert.equal(await page.locator('#detail-hp').textContent(),'1800 / 3000');
  await page.waitForTimeout(150);assert.equal((await read()).time,187,'details never advances the battle');
  await page.locator('#result-detail-back').click();assert.equal((await read()).screen,'battle');
  assert.deepEqual((await read()).result,before);assert.equal(await page.locator('.result-confetti').count(),0,'back does not restart confetti');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'result-detail');
  await page.locator('#result-achievements').click();await page.locator('#achievements-back').click();
  await page.locator('#result-detail').click();await page.keyboard.press('Escape');assert.equal((await read()).screen,'battle');
  await page.locator('#next-level').click();assert.equal((await read()).phase,'playing');
  await finish('enemy',0);assert.equal(await page.locator('.result-star.earned').count(),0);
  await page.locator('#result-detail').click();await checkDetails('no-recruits',[]);
  assert.match(await page.locator('.recruit-report-empty').textContent(),/没有招募/);assert.equal(await page.locator('#detail-hp').textContent(),'0 / 3000');
  await page.keyboard.press('Escape');await page.locator('#play-again').click();
  // Dense visual fixture exercises all 16 portraits and sorting; the preceding scenario used real controls.
  const dense=await page.evaluate(()=>{
    const b=window.__catGame.battle,kinds=Object.keys(b.armies.player.cooldowns);
    b.armies.player.recruitCounts=Object.fromEntries(kinds.map((k,i)=>[k,i+1]));b.armies.player.hired=kinds.length*(kinds.length+1)/2;
    return kinds.map((kind,i)=>({kind,count:i+1})).reverse();
  });
  await finish('player',3000);
  for(const [label,width,height] of [['desktop',1440,900],['laptop',1366,768],['phone',390,844],['tiny',320,568],['landscape',844,390],['small-landscape',667,375],['tiny-landscape',568,320]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(100);
    await page.locator('#result-detail').click();await checkDetails(label,dense);
    if(label==='tiny') {await page.locator('#result-detail-body').focus();await page.keyboard.press('End');await page.waitForTimeout(120);assert.ok(await page.locator('#result-detail-body').evaluate(e=>e.scrollTop>0),'keyboard scrolls long list');}
    await page.locator('#result-detail-back').click();assert.equal((await read()).screen,'battle');
  }
  await page.setViewportSize({width:390,height:844});await page.locator('#play-again').click();
  // Real legacy checkpoint: prior hires remain unknown rather than being reconstructed from survivors.
  await page.evaluate(()=>{
    const b=window.__catGame.battle;b.aiEnabled=false;b.summon('player','soldier');const s=b.save();delete s.armies.player.recruitCounts;delete s.armies.enemy.recruitCounts;
    if(!b.restore(s))throw Error('legacy restore failed');b.togglePause();b.summon('player','mouse');window.__catGame.render();
  });
  await finish('player',1);assert.equal(await page.locator('.result-star.earned').count(),1);
  await page.locator('#result-detail').click();await checkDetails('legacy-partial',[{kind:'mouse',count:1}]);
  assert.match(await page.locator('.recruit-report-unrecorded').textContent(),/1 位/);assert.equal(await page.locator('#detail-total').textContent(),'2 位');
  await page.keyboard.press('Escape');await page.locator('#play-again').click();await finish('draw',0);
  await page.locator('#result-detail').click();await checkDetails('draw-report',[]);await page.locator('#result-detail-back').click();
  await page.locator('#result-levels').click();assert.equal((await read()).screen,'levels');
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',errors,report},null,2));
  console.log(`PASS ${engine}: successful hires, deaths, reload, sorted portraits, old saves, empty/dense reports, seven viewports, return/Escape and result actions`);
} catch(error) {await snap('FAILURE');throw error;} finally {await browser.close();}
