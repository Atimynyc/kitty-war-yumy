import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyProfile, serializeProfile } from '../src/game/profile.ts';
import { Battle } from '../src/game/simulation.ts';
import { breedPreset } from '../src/game/cat-appearance.ts';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/chapter-world';
mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true});
const page=await context.newPage(),errors=[],checks=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const key='paw-pantry-progress-qa-v3',url=`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`;
const state=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const snap=name=>page.screenshot({path:`${out}/${engine}-${name}.png`});
const ready=async()=>{await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#start').disabled);await page.evaluate(()=>window.advanceTime(0));};
const fixture=(cleared=0,run=0,breed='british-shorthair')=>{
  const p=emptyProfile();p.cat=breedPreset(breed);
  p.progress=Object.fromEntries(Array.from({length:cleared},(_,i)=>[`campaign-${String(i+1).padStart(2,'0')}`,{stars:3,bestTime:180,ratingVersion:2}]));
  if(run){const b=new Battle();b.reset(`campaign-${String(run).padStart(2,'0')}`);b.start();b.time=37;p.run={battle:b.save(),speed:1,awards:[]};}
  return serializeProfile(p);
};
const load=async profile=>{await page.evaluate(p=>sessionStorage.setItem('world-fixture',p),profile);await page.reload({waitUntil:'networkidle'});await ready();};
const settled=()=>page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).home?.cat.reaction);
// Transform a point from the actual animated part's coordinates to the browser viewport.
const touchPoint=async(part,x,y)=>page.locator(`#home-companion-preview [data-preview-part="${part}"]`).evaluate((e,[x,y])=>{
  const p=e.ownerSVGElement.createSVGPoint();p.x=x;p.y=y;const q=p.matrixTransform(e.getScreenCTM());return{x:q.x,y:q.y};
},[x,y]);
const touch=async(part,x,y,mobile=false)=>{const p=await touchPoint(part,x,y);if(mobile)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);};
const poses=()=>page.locator('#home-companion-preview [data-preview-part]').evaluateAll(nodes=>Object.fromEntries(nodes.map(n=>[n.dataset.previewPart,n.getAttribute('transform')])));
try {
  await page.addInitScript(key=>{const f=sessionStorage.getItem('world-fixture');if(f){localStorage.setItem(key,f);sessionStorage.removeItem('world-fixture');}},key);
  await page.goto(url,{waitUntil:'networkidle'});await ready();
  const scenes=['sunroom','cardboard','kitchen','balcony','rooftop','pantry'],sources=new Set();
  for(let chapter=1;chapter<=6;chapter++){
    const stage=(chapter-1)*5+1;await load(fixture(stage-1));
    const h=(await state()).home;
    assert.equal(h.chapter,chapter);assert.equal(h.scene,scenes[chapter-1]);assert.equal(h.stage,`第 ${String(stage).padStart(2,'0')} 关`);
    sources.add(await page.locator('#home-chapter-background').getAttribute('src'));await snap(`home-${chapter}`);
    await page.locator('#choose-level').click();assert.equal(await page.locator(`[data-chapter="${chapter}"]`).getAttribute('aria-pressed'),'true');
    assert.equal(await page.locator('#chapter-art').getAttribute('data-scene'),scenes[chapter-1]);
    await snap(`map-${chapter}`);
    for(let i=0;i<5;i++){
      const id=`campaign-${String(stage+i).padStart(2,'0')}`;
      await page.locator(`[data-level="${id}"]`).click();assert.equal((await state()).selectedLevel,id);
      assert.equal(await page.locator('#level-start').isDisabled(),i>0);
    }
    checks.push(`chapter ${chapter}: correct home background, five preview nodes, locks`);
  }
  assert.equal(sources.size,6);
  // Map geometry uses the same coordinate space at every size, with no overlapping stops.
  for(const [width,height] of [[1440,900],[844,390],[390,844],[320,568]]){
    await page.setViewportSize({width,height});
    for(let chapter=1;chapter<=6;chapter++){
      await page.locator(`[data-chapter="${chapter}"]`).click();
      const geometry=await page.evaluate(()=>{
        const map=document.querySelector('.stage-map:not([hidden])'),svg=map.querySelector('svg');
        const rects=[...map.querySelectorAll('.stage-node')].map(n=>n.getBoundingClientRect().toJSON());
        const centers=[...map.querySelectorAll('.stage-medallion')].map(n=>{const r=n.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
        const points=[...map.querySelectorAll('.route-path')].flatMap((path,i)=>{
          const sample=distance=>{const p=svg.createSVGPoint(),q=path.getPointAtLength(distance);p.x=q.x;p.y=q.y;return p.matrixTransform(path.getScreenCTM());};
          return i===0?[sample(0),sample(path.getTotalLength())]:[sample(path.getTotalLength())];
        });
        return{rects,offsets:points.map((p,i)=>Math.hypot(p.x-centers[i].x,p.y-centers[i].y)),width:innerWidth,scrollWidth:document.documentElement.scrollWidth};
      });
      assert.ok(geometry.scrollWidth<=width+1);
      assert.ok(geometry.offsets.every(d=>d<2),`route/node alignment ${width}/${chapter}: ${geometry.offsets}`);
      for(const r of geometry.rects)assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.right<=width,`map button ${width}/${chapter}`);
      for(let a=0;a<5;a++)for(let b=a+1;b<5;b++){const x=geometry.rects[a],y=geometry.rects[b];assert.ok(Math.min(x.right,y.right)<=Math.max(x.x,y.x)||Math.min(x.bottom,y.bottom)<=Math.max(x.y,y.y),`overlap ${width}/${chapter}/${a}/${b}`);}
      if(width===320)await page.locator('.chapter-world').screenshot({path:`${out}/${engine}-tiny-map-${chapter}.png`});
    }
    checks.push(`all six maps: ${width}×${height}, aligned routes, reachable buttons`);
  }
  await page.setViewportSize({width:1440,height:900});await load(fixture(20,3));
  assert.equal((await state()).home.chapter,1);assert.equal((await state()).home.stage,'第 03 关');
  await page.locator('#choose-level').click();assert.equal((await state()).selectedLevel,'campaign-03');
  assert.equal(await page.locator('.stage-map:not([hidden]) .travelled').count(),4);
  assert.equal(await page.locator('[data-record="campaign-03"]').textContent(),'★★★');
  await page.locator('#levels-back').click();await page.locator('#start').click();assert.equal((await state()).phase,'paused');assert.equal((await state()).level,'campaign-03');
  checks.push('saved replay chapter/stage wins over later progress, resumes paused');
  // End chapter one through the real combat/victory path; home and selection advance together.
  await load(fixture(4));await page.locator('#start').click();
  await page.evaluate(()=>{const b=window.__catGame.battle;b.aiEnabled=false;b.armies.enemy.hp=1;b.armies.player.food=1000;b.summon('player','soldier');Object.assign(b.units.at(-1),{x:1265,row:1,attackCooldown:0});window.advanceTime(34);});
  assert.equal((await state()).winner,'player');await page.locator('#result-levels').click();await page.locator('#levels-back').click();
  assert.equal((await state()).home.chapter,2);assert.equal((await state()).home.stage,'第 06 关');
  checks.push('winning stage 5 updates home to stage 6 and chapter 2');
  await load(fixture());const initialTime=(await state()).time;
  const profileBefore=await page.evaluate(()=>window.__catGame.getProfile());
  const tests=[['head','head',80,51],['chin','headGroup',80,95],['ears','leftEar',42,32],['paws','hands',116,114],['belly','body',105,132],['tail','tail',12,120]];
  for(const [reaction,part,x,y] of tests){
    await touch(part,x,y);assert.equal((await state()).home.cat.reaction,reaction,`hit area ${reaction}`);
    await page.waitForTimeout(340);
    const delta=await page.evaluate(async()=>{
      const {baseCatMotion}=await import('/src/game/base-cat-motion.ts');
      const m=baseCatMotion(performance.now()/1000,'player','calm',0,false);
      const nums=name=>document.querySelector(`#home-companion-preview [data-preview-part="${name}"]`).getAttribute('transform').match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g).map(Number);
      return{head:nums('headGroup')[2]-m.headAngle,chin:nums('headGroup')[1]-m.headY,ears:nums('leftEar')[0]-m.leftEarAngle,paws:-nums('hands')[1]-m.pawLift,belly:1+m.breath-nums('body')[4],tail:nums('tail')[0]-m.tailAngle};
    });
    assert.ok(({head:delta.head<-7,chin:delta.chin<-8,ears:Math.abs(delta.ears)>6,paws:delta.paws>9,belly:delta.belly>.07,tail:Math.abs(delta.tail)>12})[reaction],`distinct ${reaction} animation ${JSON.stringify(delta)}`);
    await snap(`reaction-${reaction}`);await settled();assert.match(await page.locator('#home-cat-reaction').textContent(),/试着摸摸/);
  }
  assert.equal((await state()).time,initialTime);assert.deepEqual(await page.evaluate(()=>window.__catGame.getProfile()),profileBefore);
  checks.push('six real pointer hit areas produce distinct poses, settle and never change battle/profile');
  // Rapid input cannot build an animation queue. SVG keyboard targets are also operable.
  await touch('head',80,51);for(let i=0;i<6;i++)await touch('hands',116,114);
  assert.equal((await state()).home.cat.reaction,'head');await settled();await page.waitForTimeout(180);assert.equal((await state()).home.cat.reaction,null);
  const keyboard=page.locator('#home-companion-preview [data-cat-touch="chin"][tabindex="0"]');
  await keyboard.focus();await page.keyboard.press('Enter');assert.equal((await state()).home.cat.reaction,'chin');await settled();
  await keyboard.focus();await page.keyboard.press('Space');assert.equal((await state()).home.cat.reaction,'chin');
  await page.locator('#choose-level').click();const stopped=await poses();await page.waitForTimeout(180);assert.deepEqual(await poses(),stopped);
  await page.locator('#levels-back').click();assert.equal((await state()).home.cat.reaction,null);
  // Simulated browser visibility event uses the application's real lifecycle handler.
  await touch('head',80,51);
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal((await state()).home.cat.reaction,null);const hidden=await poses();await page.waitForTimeout(180);assert.deepEqual(await poses(),hidden);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);const still=await poses();
  await touch('head',80,51);assert.equal((await state()).home.cat.reaction,'head');await page.waitForTimeout(200);assert.deepEqual(await poses(),still);
  assert.match(await page.locator('#home-cat-reaction').textContent(),/眯起眼睛/);await settled();await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#home-cat').click();assert.equal(await page.locator('#cat-preview [data-cat-touch]').count(),0);await page.locator('#cat-back').click();
  checks.push('rapid taps, keyboard Enter/Space, leave/return, background, reduced motion, editor isolation');
  await page.setViewportSize({width:390,height:844});
  for(const [reaction,part,x,y] of tests){await touch(part,x,y,true);assert.equal((await state()).home.cat.reaction,reaction,`touch ${reaction}`);await settled();}
  await snap('touch-home');
  // Actual shapes, including folded ears and short tails, remain clickable after changing breed.
  for(const breed of ['siamese','persian','scottish-fold']){
    await load(fixture(0,0,breed));await touch('head',80,51,true);assert.equal((await state()).home.cat.reaction,'head');await settled();
    const visibleTail=await page.locator('#home-companion-preview [data-preview-part="tail"]').evaluate(e=>{
      const r=e.getBoundingClientRect(),hit=(x,y)=>document.elementFromPoint(x,y)?.closest('[data-cat-touch]')?.getAttribute('data-cat-touch')==='tail';
      // A chubby cat occludes part of its short tail: tap visible fur, not the body over it.
      for(let y=r.top+4;y<r.bottom-4;y+=2)for(let x=r.left+4;x<r.right-4;x+=2)
        if([[0,0],[-3,0],[3,0],[0,-3],[0,3]].every(([dx,dy])=>hit(x+dx,y+dy)))return{x,y};
      return null;
    });
    assert.ok(visibleTail,`${breed} has a visible clickable tail`);
    await page.touchscreen.tap(visibleTail.x,visibleTail.y);assert.equal((await state()).home.cat.reaction,'tail');await settled();
  }
  checks.push('mobile taps on six parts and actual long/fluffy/short tails after breed changes');
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',checks,errors},null,2));
  console.log(`PASS ${engine}: ${checks.length} map, progression and interactive cat scenarios`);
}catch(error){await snap('FAILURE');writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'failed',checks,errors,error:String(error)},null,2));throw error;}
finally{await browser.close();}
