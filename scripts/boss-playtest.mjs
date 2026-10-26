import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const engine=process.env.TEST_BROWSER||'chromium';
const output=path.resolve('test-results/boss');mkdirSync(output,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const report=[];
try {
  for(const size of [{width:390,height:844},{width:320,height:568}]) {
    const page=await browser.newPage({viewport:size,deviceScaleFactor:2}),errors=[];
    await page.addInitScript(() => localStorage.setItem('paw-pantry-progress-qa-v3', JSON.stringify({ version: 2, legacy: {}, campaign: Object.fromEntries(Array.from({ length: 29 }, (_, i) => [`campaign-${String(i + 1).padStart(2, '0')}`, { stars: 1, bestTime: 200, ratingVersion: 2 }])) })));
    page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
    const read=()=>page.evaluate(()=>({text:JSON.parse(window.render_game_to_text()),poses:window.__catGame.getAnimations()}));
    const capture=async name=>{
      await page.screenshot({path:path.join(output,`${engine}-${size.width}-${name}.png`),fullPage:true});
      const state=await read();writeFileSync(path.join(output,`${engine}-${size.width}-${name}.json`),JSON.stringify(state,null,2));return state;
    };
    await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
    await page.locator('#loading').waitFor({state:'detached'});await page.locator('#start').click();await advance(0);
    // Trigger through real damage crossing 30%, preserving the same entry path as live play.
    await page.evaluate(()=>{
      const b=window.__catGame.battle;b.reset('campaign-30');b.start();b.aiEnabled=false;
      b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;
      b.armies.enemy.hp=901;b.summon('player','soldier');
      Object.assign(b.units[0],{x:1265,row:1,targetRow:1,attackCooldown:0});
      window.advanceTime(1000/30);b.units=b.units.filter(u=>u.kind==='boss');window.advanceTime(0);
    });
    // The newly visible header resizes the canvas via ResizeObserver; settle that
    // independent layout change before asserting that pause freezes the puppet.
    await page.waitForFunction(()=>window.__catGame.getView().height===Math.round(document.getElementById('battle-canvas').getBoundingClientRect().height));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    await advance(0);
    const entry=await capture('entry');assert.equal(entry.text.boss.state,'entering');
    assert.equal(await page.locator('#boss-status').isVisible(),true);assert.equal(entry.text.baseCats.enemy.speechVisible,false);
    const before=entry.poses.find(p=>p.kind==='boss');
    await page.evaluate(()=>window.__catGame.battle.togglePause());await advance(500);
    assert.deepEqual((await read()).poses.find(p=>p.kind==='boss'),before);
    await page.evaluate(()=>window.__catGame.battle.togglePause());await advance(600);
    assert.notEqual((await read()).poses.find(p=>p.kind==='boss').x,before.x);await advance(650);
    // A three-soldier front line and a rear soldier make the sweep/knockback legible.
    await page.evaluate(()=>{
      const b=window.__catGame.battle,boss=b.units.find(u=>u.kind==='boss');
      Object.assign(boss,{x:700,row:1,attackCooldown:0});
      const spawn=(kind,x,row)=>{
        b.armies.player.food=10000;b.armies.player.tech=3;b.armies.player.cooldowns[kind]=0;
        b.summon('player',kind);Object.assign(b.units.at(-1),{x,row,targetRow:row,attackCooldown:100});
      };
      for(const row of [1,0,2])spawn('shield',680,row);
      spawn('soldier',720,1);spawn('mouse',400,1);
      window.advanceTime(0);
    });
    const rest=await capture('rest');await advance(1000/30);await advance(550);
    const half=await capture('half-lift'),halfPaw=half.poses.find(p=>p.kind==='boss').parts.rightHand;
    assert.ok(halfPaw.scaleX>1.4 && halfPaw.scaleX<1.7);
    await advance(550);const raised=await capture('full-lift'),raisedPose=raised.poses.find(p=>p.kind==='boss');
    assert.equal(raisedPose.charge.holding,true);assert.equal(raisedPose.parts.rightHand.scaleX,2.1);
    assert.ok(raised.text.units.filter(u=>u.kind==='shield').every(u=>u.hp===700));
    await advance(250);const hold=await read();
    const heldPaw=hold.poses.find(p=>p.kind==='boss').parts.rightHand;
    for(const key of Object.keys(heldPaw))assert.ok(Math.abs(heldPaw[key]-raisedPose.parts.rightHand[key])<1e-8,`hold ${key}`);
    await advance(110);const midSwing=await capture('mid-swing');
    assert.ok(midSwing.text.units.filter(u=>u.kind==='shield').every(u=>u.hp===700));
    assert.ok(midSwing.poses.find(p=>p.kind==='boss').charge.swipe>.45);
    await advance(50);const beforeHit=(await read()).text.units.filter(u=>u.kind==='shield');
    await advance(10);const hit=await read();
    const victims=hit.text.units.filter(u=>u.kind==='shield');
    assert.ok(victims.every(u=>u.hp===520));
    assert.ok(victims.every(u=>beforeHit.find(v=>v.id===u.id).x-u.x>=79));
    assert.equal(hit.text.units.find(u=>u.kind==='soldier').hp,230);
    const swipe=await capture('sweep');
    assert.ok(swipe.poses.find(p=>p.kind==='boss').parts.rightHand.x<raisedPose.parts.rightHand.x-25);
    assert.ok(swipe.poses.some(p=>p.kind==='shield' && p.state==='hurt'));
    const panel=await page.locator('#boss-status').boundingBox(),rail=await page.locator('#bombard').boundingBox();
    assert.ok(panel.x>=0 && panel.x+panel.width<size.width);
    if(rail)assert.ok(panel.x+panel.width<=rail.x,'boss status must leave skill rail clear');
    await advance(400);const recovered=await capture('recovered');
    assert.equal(recovered.poses.find(p=>p.kind==='boss').parts.rightHand.scaleX,1);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.evaluate(()=>{const b=window.__catGame.battle,u=b.units.find(u=>u.kind==='boss');u.sweep={remaining:.2,forwardX:-1,forwardY:0};window.advanceTime(0);});
    await page.waitForFunction(()=>{
      window.advanceTime(0);const p=window.__catGame.getAnimations().find(u=>u.kind==='boss');
      return Math.abs(p.parts.rightHand.rotation-p.aimRotation)<1e-8 && p.body.rotation===0;
    });
    await capture('reduced-motion');await page.emulateMedia({reducedMotion:'no-preference'});
    await page.evaluate(()=>{const b=window.__catGame.battle;b.units.find(u=>u.kind==='boss').hp=0;window.advanceTime(1000/30);});
    assert.equal((await read()).text.boss.state,'defeated');await capture('defeated');await advance(900);
    assert.equal((await read()).poses.some(p=>p.kind==='boss'),false);
    await page.evaluate(()=>{const b=window.__catGame.battle;b.reset('campaign-30');b.start();window.advanceTime(0);});
    assert.equal(await page.locator('#boss-status').isVisible(),false);assert.equal((await read()).text.boss.spawned,false);
    await capture('reset');
    if(size.width===390) {
      const natural=await page.evaluate(()=>{
        const b=window.__catGame.battle;b.reset('campaign-30');b.start();b.aiEnabled=true;b.upgradeEconomy('player');
        for(let frame=0;frame<30*600 && b.phase==='playing';frame++) {
          if(frame%15===0) {
            const a=b.armies.player,allies=b.units.filter(u=>u.side==='player'),count=kind=>allies.filter(u=>u.kind===kind).length;
            if(b.units.some(u=>u.side==='enemy' && u.x<430))b.bombard('player');
            if(allies.filter(u=>u.attacking && u.catnip<=2).length>=5)b.catnip('player');
            let saving=false;
            if(allies.length>=2 && a.hp>1500) {
              if(a.economy<3 && b.time>=[0,22,48][a.economy])saving=!b.upgradeEconomy('player');
              else if(a.tech<3 && !a.researching && b.time>=[12,45][a.tech-1])saving=!b.researchTech('player');
            }
            if(!saving)b.summon('player',a.tech===1?'soldier':count('shield')<1?'shield':count('mage')<1?'mage':a.tech===3 && count('knight')<1?'knight':a.tech===3 && count('catapult')<2?'catapult':a.tech===3 && count('healer')<1?'healer':count('slinger')<4?'slinger':'soldier');
          }
          b.step(1/30);
          if(b.units.some(u=>u.kind==='boss' && u.sweep))break;
        }
        window.advanceTime(0);return {time:b.time,phase:b.phase,winner:b.winner,playerHp:b.armies.player.hp,enemyHp:b.armies.enemy.hp,spawned:b.boss.spawned,charging:b.units.some(u=>u.kind==='boss' && u.sweep)};
      });
      // This strategy is a playthrough, not a win guarantee across floating-point engines.
      // The fixtures above enforce identical boss damage/timing/knockback on both engines.
      if(natural.charging) {
        assert.equal(natural.spawned,true);await capture('natural-encounter');await advance(1100);await capture('natural-charge');
      } else {
        await capture('natural-result');
        assert.equal(natural.phase,'ended',JSON.stringify(natural));assert.equal(natural.winner,'enemy',JSON.stringify(natural));
        assert.equal(natural.spawned,false);assert.equal(natural.enemyHp,3000);
      }
      report.push({engine,natural});
    }
    report.push({size,engine,phases:['entry','half-lift','full-lift','hold','sweep','recovery','death','reset'],targetsHit:victims.length,damagePerTarget:180,minimumPush:Math.min(...victims.map(u=>beforeHit.find(v=>v.id===u.id).x-u.x)),errors});
    assert.deepEqual(errors,[]);await page.close();
  }
  writeFileSync(path.join(output,`${engine}-report.json`),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
} finally {await browser.close();}
