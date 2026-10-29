import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { ACHIEVEMENTS, emptyAchievements } from '../src/game/achievements.ts';
const root='test-results/achievements';mkdirSync(root,{recursive:true});
const url=`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`, key='paw-pantry-progress-qa-v3';
const reports=[];
for(const engine of [chromium,webkit]) {
  const browser=await engine.launch({headless:true});
  try {
    for(const native of [false,true]) {
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
      await context.addInitScript(({native,key})=>{
        window.__storageCalls=[];
        const fixture=sessionStorage.getItem('next-profile');if(fixture){localStorage.setItem(native?`native:${key}`:key,fixture);sessionStorage.removeItem('next-profile');}
        if(!localStorage.getItem('real-key-sentinel')) {localStorage.setItem('paw-pantry-progress-v1','{"production":"untouched"}');localStorage.setItem('real-key-sentinel','1');}
        if(native) window.xhs={launchOptions:{miniToolEnv:{buildVersion:9510000}},miniTool:{
          getStorage:async ({key})=>{window.__storageCalls.push('get');return {data:localStorage.getItem(`native:${key}`)};},
          setStorage:async ({key,data})=>{window.__storageCalls.push('set');if(window.__failSave)throw Error('quota');localStorage.setItem(`native:${key}`,data);},
        }};
        else {const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&window.__failSave)throw Error('quota');return set.call(this,k,v);};}
      },{native,key});
      let page=await context.newPage();const errors=[];
      const observe=()=>{page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});};observe();
      const id=`${engine.name()}-${native?'native-stub':'browser'}`;
      const persistedKey=native?`native:${key}`:key;
      const ready=async()=>{await page.locator('#loading').waitFor({state:'detached'});await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#start').disabled);await page.evaluate(()=>window.advanceTime(0));};
      const reload=async()=>{await page.reload({waitUntil:'networkidle'});await ready();};
      const snap=async name=>page.screenshot({path:`${root}/${id}-${name}.png`,fullPage:true});
      const saved=async()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),persistedKey);
      const bootWith=async value=>{await page.evaluate(value=>sessionStorage.setItem('next-profile',JSON.stringify(value)),value);await reload();};
      try {
        await page.goto(url,{waitUntil:'networkidle'});await ready();
        await page.locator('#home-achievements').click();assert.equal(await page.locator('.honor-card').count(),24);
        await page.locator('#achievement-category').selectOption('2');assert.equal(await page.locator('.honor-card').count(),2);
        await page.locator('.honor-card details').first().locator('summary').click();assert.match(await page.locator('.honor-card details').first().textContent(),/猫咪/);
        await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__catGame.getScreen()),'home');
        // Research is available from stage three; keep this resume fixture eligible.
        await bootWith({version:2,campaign:Object.fromEntries([1,2].map(n=>[`campaign-0${n}`,{stars:3,bestTime:100,ratingVersion:2}]))});
        await page.locator('#start').click();await page.locator('#upgrade-economy').click();await page.locator('#hire-soldier').click();
        await page.evaluate(()=>window.__catGame.advance(16));await page.locator('#upgrade-tech').click();await page.evaluate(()=>window.__catGame.advance(3));
        await page.locator('#speed').click();await page.locator('#pause').click();
        const checkpoint=await page.evaluate(()=>window.__catGame.battle.save());
        assert.ok(checkpoint.armies.player.researching);assert.ok(checkpoint.units.length);
        const totals=await page.evaluate(()=>window.__catGame.getProfile().achievements);
        await page.locator('#pause-home').click();await page.waitForFunction(k=>Math.abs(JSON.parse(localStorage.getItem(k)).run?.battle.time-19)<.1,persistedKey);
        await snap('resume-home');assert.match(await page.locator('#start').textContent(),/继续/);
        assert.equal(await page.locator('#home-achievements .achievement-dot').count(),1);
        // Closing the page and reopening within the same browser context retains persisted storage.
        await page.close();page=await context.newPage();observe();await page.goto(url,{waitUntil:'networkidle'});await ready();await page.locator('#start').click();
        assert.equal(await page.evaluate(()=>window.__catGame.battle.phase),'paused');assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint);
        assert.equal(await page.locator('#speed').textContent(),'2×');
        await page.evaluate(()=>{for(let i=0;i<10;i++)window.__catGame.render();window.__catGame.advance(60);});
        assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint);assert.deepEqual(await page.evaluate(()=>window.__catGame.getProfile().achievements),totals);
        await snap('restored');await page.locator('#pause-achievements').click();
        assert.equal(await page.locator('[data-achievement="growth.first-feeder"] .achievement-dot').count(),1);
        await snap('new-achievement');
        await page.locator('#achievement-category').selectOption('all');assert.equal(await page.locator('.honor-card').count(),24);
        await page.locator('#achievement-status').selectOption('unlocked');assert.equal(await page.locator('.honor-card').count(),1);
        await page.locator('#achievements-back').click();assert.equal(await page.evaluate(()=>window.__catGame.battle.phase),'paused');
        assert.equal(await page.locator('#pause-achievements .achievement-dot').count(),0);
        assert.deepEqual((await page.evaluate(()=>window.__catGame.getProfile())).achievements.unseenIds,[]);
        await page.evaluate(()=>window.__catGame.saveProfile());await reload();
        assert.equal(await page.locator('#home-achievements .achievement-dot').count(),0);
        await page.locator('#home-achievements').click();
        assert.equal(await page.locator('.honor-card .achievement-dot').count(),0);
        await page.keyboard.press('Escape');await page.locator('#start').click();
        await page.locator('#resume').click();await page.evaluate(()=>window.__catGame.advance(15));await page.locator('#pause').click();
        assert.equal(await page.evaluate(()=>window.__catGame.battle.armies.player.tech),2);
        assert.ok((await page.evaluate(()=>window.__catGame.getProfile())).achievements.unlocked['growth.first-research']);
        assert.equal(await page.locator('#pause-achievements .achievement-dot').count(),1,'a later achievement restores the red dot');
        await page.locator('#pause-home').click();await page.locator('#new-battle').click();await page.locator('#replace-cancel').click();
        assert.ok((await page.evaluate(()=>window.__catGame.getProfile())).run);
        await page.locator('#new-battle').click();await page.locator('#keep-run').click();assert.equal(await page.evaluate(()=>window.__catGame.battle.phase),'paused');
        await page.locator('#pause-home').click();await page.locator('#new-battle').click();await page.locator('#replace-confirm').click();
        assert.equal(await page.evaluate(()=>window.__catGame.battle.time),0);assert.equal(await page.evaluate(()=>window.__catGame.battle.armies.player.economy),0);
        // A completed loss clears only the unfinished round, keeping earned cumulative achievements.
        await page.evaluate(()=>window.__catGame.advance(480));assert.equal(await page.evaluate(()=>window.__catGame.battle.winner),'enemy');
        assert.equal((await saved()).run,null);assert.ok((await saved()).achievements.unlocked['growth.first-feeder']);
        assert.equal(await page.locator('#result-achievements .achievement-dot').count(),1);
        await page.locator('#result-achievements').click();
        assert.equal(await page.locator('[data-achievement="growth.first-research"] .achievement-dot').count(),1);
        assert.equal(await page.locator('[data-achievement="growth.first-feeder"] .achievement-dot').count(),0);
        await page.locator('#achievements-back').click();
        assert.equal(await page.locator('#result-achievements .achievement-dot').count(),0);
        await page.locator('#play-again').click();
        // Failure is explicit and cannot overwrite the last good checkpoint.
        await page.locator('#pause').click();const prior=await saved();
        await page.evaluate(()=>{window.__failSave=true;window.__catGame.battle.togglePause();window.__catGame.advance(1);window.__catGame.saveProfile();});
        await page.waitForFunction(()=>document.querySelector('#profile-notice').dataset.state==='failed');
        assert.equal(await page.locator('#profile-notice').isVisible(),true);assert.deepEqual(await saved(),prior);await snap('save-failure');
        await page.evaluate(()=>{window.__failSave=false;});await reload();
        // Legacy chapter migration, title persistence and every viewport use injected UI fixtures only.
        const campaign=Object.fromEntries(Array.from({length:30},(_,i)=>[`campaign-${String(i+1).padStart(2,'0')}`,{stars:2,bestTime:200,ratingVersion:2}]));
        await bootWith({version:2,campaign,legacy:{sunroom:{stars:3,bestTime:120,ratingVersion:2}}});
        assert.equal(Object.keys((await page.evaluate(()=>window.__catGame.getProfile())).achievements.unlocked).length,6);
        await page.locator('#home-achievements').click();await page.locator('#equipped-title').selectOption('apprentice');
        await page.locator('#achievement-category').selectOption('all');await page.locator('#achievement-status').selectOption('all');
        for(const [name,width,height] of [['small',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,1000]]) {
          await page.setViewportSize({width,height});await page.waitForTimeout(120);
          assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${id}/${name}: horizontal overflow`);
          for(const sel of ['#achievements-back','#equipped-title','#achievement-category','#achievement-status']) {
            await page.locator(sel).scrollIntoViewIfNeeded();const rect=await page.locator(sel).boundingBox();assert.ok(rect.height>=44&&rect.width>=44,`${name}: ${sel} touch size`);
          }
          await page.locator('.honor-card').last().scrollIntoViewIfNeeded();assert.equal(await page.locator('.honor-card').last().isVisible(),true);
          await page.locator('#achievement-title').scrollIntoViewIfNeeded();await snap(`cabinet-${name}`);
        }
        await reload();assert.match(await page.locator('#home-equipped-title').textContent(),/见习守护喵/);
        const future={version:99,precious:'future-progress'};await bootWith(future);await page.locator('#start').click();await page.locator('#upgrade-economy').click();assert.deepEqual(await saved(),future);
        assert.match(await page.locator('#profile-notice').textContent(),/不会覆盖/);
        const full=emptyAchievements();for(const a of ACHIEVEMENTS)full.unlocked[a.id]={unlockedAt:1,source:'play'};full.equippedTitle='legend';
        await bootWith({version:3,campaign,legacy:{},achievements:full,run:{battle:{version:1,rules:'old'},speed:1,awards:[]}});
        assert.equal((await page.evaluate(()=>window.__catGame.getProfile())).run,null);assert.match(await page.locator('#profile-notice').textContent(),/无法续玩/);
        assert.equal(await page.locator('#profile-notice').isVisible(),true);
        await page.locator('#home-achievements').click();assert.equal(await page.locator('.honor-card.earned').count(),24);await snap('all-medals');
        await page.locator('#achievements-back').click();await page.locator('#start').click();
        // Result UI fixture: no injected progress is ever written to the production key.
        await page.evaluate(()=>{const b=window.__catGame.battle;b.armies.enemy.hp=0;b.phase='ended';b.winner='player';window.__catGame.render();});
        assert.equal((await saved()).run,null);assert.match(await page.locator('.result-honors').textContent(),/传奇冻干守护者/);await snap('result-title');
        assert.equal(await page.locator('.result-rating-rules').count(),0);
        assert.doesNotMatch(await page.locator('.result-card').textContent(),/本局新成就|即将获得|满血获胜/);
        assert.equal(await page.evaluate(()=>localStorage.getItem('paw-pantry-progress-v1')),'{"production":"untouched"}');
        if(native)assert.ok((await page.evaluate(()=>window.__storageCalls)).includes('set'));
        assert.deepEqual(errors,[]);reports.push({id,status:'passed',checkpointBytes:JSON.stringify(checkpoint).length,errors});
        console.log(`${id}: passed`);
      } catch(error) {await snap('FAILURE');throw error;} finally {await context.close();}
    }
  } finally {await browser.close();}
}
writeFileSync(`${root}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
