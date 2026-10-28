import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/attack-readability';
mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const capture=async name=>{
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:`${out}/${engine}-${name}.png`});
};
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.locator('#start').click();await advance(0);
  const kinds=await page.evaluate(async()=>{const c=await import('/src/game/content.ts');return {player:c.UNIT_ORDER,enemy:c.ENEMY_ORDER};});
  for(const side of ['player','enemy'])for(const kind of kinds[side]){
    const fixture=await page.evaluate(async({side,kind})=>{
      const {UNITS,UNIT_ORDER}=await import('/src/game/content.ts');
      const b=window.__catGame.battle;b.reset('campaign-24',UNIT_ORDER);b.start();b.aiEnabled=false;
      b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=10000;
      const dir=side==='player'?1:-1,other=side==='player'?'enemy':'player';
      const add=(team,type,x)=>{
        Object.assign(b.armies[team],{food:10000,tech:3});b.armies[team].cooldowns[type]=0;
        if(!b.summon(team,type))throw new Error(`Cannot summon ${team}/${type}`);
        const u=b.units.at(-1);Object.assign(u,{x,row:1,targetRow:1,attackCooldown:10000});return u;
      };
      const a=add(side,kind,700),range=UNITS[kind].range;
      add(other,'shield',700+dir*(range<60?18:150));
      if(kind==='healer'||kind==='drummer')add(side,'soldier',700+dir*40).hp=100;
      window.advanceTime(0);
      const rest=window.__catGame.getAnimations().find(p=>p.id===a.id);
      const anchors=b.units.filter(u=>u.id!==a.id).map(u=>({id:u.id,x:u.x,row:u.row}));
      a.attackCooldown=0;
      for(let i=0;i<100&&a.attackAt<0;i++)window.advanceTime(1000/30);
      return {id:a.id,rest,at:a.attackAt,now:b.time,anchors};
    },{side,kind});
    assert.ok(fixture.at>=0,`${side}/${kind}: real attack or support event`);
    const pose=()=>page.evaluate(id=>window.__catGame.getAnimations().find(p=>p.id===id),fixture.id);
    const contact=await pose();assert.ok(contact.action.attack>.98);
    const hand=contact.parts.rightHand,rest=fixture.rest.parts.rightHand;
    assert.ok(Math.abs(hand.rotation-rest.rotation)>.3||Math.hypot(hand.x-rest.x,hand.y-rest.y)>8,`${side}/${kind}: visible hand or weapon movement`);
    await advance(150);assert.ok((await pose()).action.attack>.9,`${side}/${kind}: pose remains readable 150ms after impact`);
    if(side==='player'&&['soldier','slinger','catapult','boxer','gunner','healer'].includes(kind))await capture(`${side}-${kind}-contact`);
    await page.locator('#pause').click();const frozen=await pose();await advance(1500);assert.deepEqual(await pose(),frozen);
    await page.locator('#resume').click();await advance(400);assert.equal((await pose()).action.attack,0,'returns to rest');
    const cycles=await page.evaluate(async({id,anchors})=>{
      const {UNITS}=await import('/src/game/content.ts'),b=window.__catGame.battle;
      const samples=[],attacks=new Set();
      for(let i=0;i<180;i++){
        for(const u of b.units)if(u.id!==id){u.hp=u.side===b.units.find(u=>u.id===id).side?100:UNITS[u.kind].hp;Object.assign(u,anchors.find(p=>p.id===u.id));}
        window.advanceTime(50);
        const u=b.units.find(u=>u.id===id),p=window.__catGame.getAnimations().find(p=>p.id===id);
        attacks.add(u.attackAt);samples.push(p.action);
      }
      return {attacks:[...attacks],samples};
    },{id:fixture.id,anchors:fixture.anchors});
    assert.ok(cycles.attacks.length>=2,`${side}/${kind}: repeated real action cycles`);
    assert.ok(cycles.samples.filter(p=>p.attack>.5).length>=6,`${side}/${kind}: sustained visible poses`);
    assert.ok(cycles.samples.some(p=>p.attack===0),`${side}/${kind}: recovery between actions`);
    results.push({side,kind,cycles:cycles.attacks.length,contact:contact.parts.rightHand});
    if(engine==='chromium'&&side==='player'&&kind==='soldier'){
      mkdirSync(`${out}/duel-frames`,{recursive:true});
      writeFileSync(`${out}/duel-poses.json`,JSON.stringify(await page.evaluate(()=>window.__catGame.getAnimations())));
      for(let i=0;i<25;i++){
        await advance(100);
        await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        await page.locator('#battle-canvas canvas').screenshot({path:`${out}/duel-frames/${String(i).padStart(3,'0')}.png`});
      }
    }
  }
  // Verify motion suppression while real attacks and damage continue.
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>{window.advanceTime(0);return window.__catGame.getAnimations().every(p=>p.action.attack===0&&p.action.windup===0);});
  await advance(2000);assert.ok((await page.evaluate(()=>window.__catGame.getAnimations())).every(p=>p.action.attack===0&&p.action.windup===0));
  await capture('reduced-motion');
  // Keep one running Phaser canvas; two software-rendered WebKit pages throttle each other.
  await page.close();
  const realtime=await browser.newPage({viewport:{width:390,height:844}});
  realtime.on('pageerror',e=>errors.push(e.message));
  await realtime.bringToFront();
  await realtime.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await realtime.locator('#loading').waitFor({state:'detached'});await realtime.locator('#start').click();
  await realtime.evaluate(()=>{
    const b=window.__catGame.battle;b.reset('campaign-01',Object.keys(b.armies.player.cooldowns));b.start();b.aiEnabled=false;
    for(const side of ['player','enemy']){
      b.armies[side].tech=3;b.armies[side].food=10000;b.armies[side].cannonCooldown=10000;
      b.summon(side,side==='player'?'soldier':'shield');Object.assign(b.units.at(-1),{x:side==='player'?700:718,row:1,targetRow:1});
    }
  });
  const clockChecks=[];
  for(const speed of [1,2]){
    if(speed===2)await realtime.locator('#speed').click();
    const sample=await realtime.evaluate(async()=>{
      const b=window.__catGame.battle,start=b.time,wallStart=performance.now(),poses=[],stamps=new Set();
      for(let i=0;i<24;i++){
        await new Promise(r=>setTimeout(r,100));
        const a=b.units.find(u=>u.side==='player');stamps.add(a.attackAt);
        poses.push(window.__catGame.getAnimations().find(p=>p.id===a.id).action.attack);
      }
      return {elapsed:b.time-start,wallSeconds:(performance.now()-wallStart)/1000,cycles:stamps.size,readableSamples:poses.filter(v=>v>.5).length};
    });
    assert.ok(sample.cycles>=2&&sample.readableSamples>=3,`${speed}x: repeated visible attacks with real rendering and simultaneous incoming damage`);
    assert.ok(sample.elapsed>speed*sample.wallSeconds*.65&&sample.elapsed<speed*sample.wallSeconds*1.25,`${speed}x: game clock follows selected speed ${JSON.stringify(sample)}`);
    clockChecks.push({speed,...sample});
  }
  await realtime.close();
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',results,clockChecks,errors},null,2));
  console.log(`PASS ${engine}: ${results.length} troop types, repeated real actions, readable contact poses, recovery, pause and reduced motion`);
}catch(e){await capture('FAILURE').catch(()=>{});throw e;}finally{await browser.close();}
