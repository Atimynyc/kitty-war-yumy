import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
const engine=process.env.TEST_BROWSER || 'chromium', output='test-results/combat-stability';
mkdirSync(output,{recursive:true});
const browser=await (engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const capture=name=>page.screenshot({path:`${output}/${engine}-${name}.png`,fullPage:true});
const fixture=count=>page.evaluate(count=>{
  const b=window.__catGame.battle;b.reset();b.start();b.aiEnabled=false;
  for(const side of ['player','enemy'])for(let i=0;i<count;i++) {
    b.armies[side].food=10000;b.armies[side].cooldowns.soldier=0;b.summon(side,'soldier');
    Object.assign(b.units.at(-1),{x:(side==='player'?580:860)+(side==='player'?-1:1)*Math.floor(i/3)*12,row:count===1?1:i%3,attackCooldown:0});
  }
  window.advanceTime(0);
},count);
const sample=frames=>page.evaluate(frames=>{
  const samples=[];
  for(let i=0;i<frames;i++) {
    window.advanceTime(1000/30);
    const b=window.__catGame.battle;
    samples.push({time:b.time,units:b.units.map(u=>({id:u.id,targetId:u.targetId,attacking:u.attacking,attackAt:u.attackAt,walking:u.walking,hp:u.hp})),poses:window.__catGame.getAnimations()});
  }
  return samples;
},frames);
try {
  await page.goto(`${process.env.GAME_URL || 'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.locator('#start').click();
  const report=[];
  for(const [name,width,height] of [['phone',390,844],['tiny',320,568]]) {
    await page.setViewportSize({width,height});await page.waitForTimeout(180);await fixture(1);
    const duel=await sample(100);let stalls=0;
    writeFileSync(`${output}/${engine}-${name}-duel-trace.json`,JSON.stringify(duel));
    for(let i=1;i<duel.length;i++) {
      const u=duel[i].units[0],p=duel[i].poses[0],old=duel[i-1].poses[0];
      if(u.attackAt<0 && Math.hypot(p.x-old.x,p.y-old.y)<.01)stalls++;
    }
    assert.equal(stalls,0,`${name}: visible stop before first strike`);
    assert.ok(duel.at(-1).units.every(u=>u.attackAt>0));await capture(`${name}-duel`);
    await fixture(24);
    const unitSize=await page.evaluate(()=>window.__catGame.getView().unitSize);
    let previous=new Map(),maxJump=0,rapidTurns=0,lastTurn=new Map(),contactChecks=0;const trace=[],turns=[],deathPoints=new Map();
    for(let burst=0;burst<5;burst++) {
      const frames=await sample(60);trace.push(...frames);
      for(const frame of frames) {
        for(const unit of frame.units.filter(u=>u.attacking)) {
          const p=frame.poses.find(p=>p.id===unit.id),q=frame.poses.find(p=>p.id===unit.targetId);
          if(!q || q.state==='death')continue;
          assert.ok(Math.hypot(p.x-q.x,p.y-q.y)<=unitSize*.6+.2,`${name}: soldier attacked across a visible gap`);
          contactChecks++;
        }
        for(const pose of frame.poses.filter(p=>p.state==='death')) {
          const point={x:pose.x,y:pose.y},old=deathPoints.get(pose.id)??previous.get(pose.id);
          if(old)assert.deepEqual(point,{x:old.x,y:old.y},`${name}: a fallen unit slid with the crowd`);
          deathPoints.set(pose.id,point);
        }
        const living=frame.poses.filter(p=>p.state!=='death');
        for(const p of living) {
          const old=previous.get(p.id);if(!old)continue;
          maxJump=Math.max(maxJump,Math.hypot(p.x-old.x,p.y-old.y));
          // A new target can change the face and then the hand in consecutive
          // frames. Flicker means the same art choice switches back rapidly.
          for(const property of ['look','mirror']) if(old[property]!==p[property]) {
            const key=`${p.id}:${property}`,previousTime=lastTurn.get(key);
            if(frame.time-(previousTime??-100)<.2)rapidTurns++;
            turns.push({time:frame.time,id:p.id,property,previousTime,from:{look:old.look,mirror:old.mirror,targetId:old.targetId},to:{look:p.look,mirror:p.mirror,targetId:p.targetId}});
            lastTurn.set(key,frame.time);
          }
        }
        previous=new Map(living.map(p=>[p.id,p]));
      }
      await capture(`${name}-crowd-${burst}`);
    }
    writeFileSync(`${output}/${engine}-${name}-trace.json`,JSON.stringify(trace));
    writeFileSync(`${output}/${engine}-${name}-turns.json`,JSON.stringify(turns));
    assert.ok(maxJump<4,`${name}: ${maxJump}px frame jump`);
    assert.equal(rapidTurns,0,`${name}: body art flickered between directions`);
    assert.ok(deathPoints.size>0,`${name}: crowd fixture must include deaths`);
    await page.locator('#pause').click();
    const frozen=await page.evaluate(()=>window.__catGame.getAnimations());
    await sample(15);assert.deepEqual(await page.evaluate(()=>window.__catGame.getAnimations()),frozen);
    await page.locator('#restart').click();
    // The click resets the model; the next Phaser frame removes the old puppets.
    await page.waitForFunction(()=>window.__catGame.getAnimations().length===0);
    assert.ok(contactChecks>0);
    report.push({name,maxJump,stalls,rapidTurns,deaths:deathPoints.size,contactChecks});
  }
  await page.setViewportSize({width:390,height:844});
  const siege=await page.evaluate(()=>{
    const b=window.__catGame.battle;b.reset();b.start();b.aiEnabled=false;
    b.armies.player.cannonCooldown=b.armies.enemy.cannonCooldown=1000;
    const spawn=(side,x)=>{const a=b.armies[side];a.food=10000;a.cooldowns.soldier=0;b.summon(side,'soldier');const u=b.units.at(-1);Object.assign(u,{x,row:1,attackCooldown:0});return u;};
    const attackers=Array.from({length:10},()=>spawn('player',1265));
    const defender=spawn('enemy',1281);
    window.advanceTime(1000/30);
    const volley={killed:!b.units.includes(defender),hits:attackers.filter(u=>u.attackAt===b.time).length,baseHP:b.armies.enemy.hp};
    window.advanceTime(1000/30);
    const hp=[];
    for(let wave=0;wave<5;wave++) {
      spawn('enemy',1263);
      window.advanceTime(1100);
      hp.push(b.armies.enemy.hp);
    }
    return {volley,hp,sieging:attackers.filter(u=>u.hp>0&&u.targetId===null).length};
  });
  assert.deepEqual(siege.volley,{killed:true,hits:10,baseHP:3000});
  assert.ok(siege.hp.every((hp,i)=>hp<(i?siege.hp[i-1]:3000)),JSON.stringify(siege));
  assert.ok(siege.sieging>3);await capture('siege-reinforcements');
  report.push({scenario:'ten-versus-one-and-siege',...siege});
  assert.deepEqual(errors,[]);
  writeFileSync(`${output}/${engine}-report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
