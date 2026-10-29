import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { emptyProfile, serializeProfile } from '../src/game/profile.ts';
import { ACHIEVEMENTS } from '../src/game/achievements.ts';
import { Battle } from '../src/game/simulation.ts';
import { breedPreset } from '../src/game/cat-appearance.ts';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/home-layout';mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
const errors=[],report=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const key='paw-pantry-progress-qa-v3',url=`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`;
const sizes=[['desktop',1440,900],['full-hd',1920,1080],['laptop',1366,768],['small-laptop',1280,720],['short-window',1024,600],['window',800,600],['zoom-window',640,480],['tablet',768,1024],['column-boundary',700,900],['portrait-boundary',699,900],['square-window',700,700],['phone',390,844],['small-phone',375,667],['tiny-phone',320,568],['landscape',844,390],['small-landscape',667,375],['narrow-landscape',568,375],['tiny-landscape',568,320]];
const ready=async()=>{await page.waitForFunction(()=>window.__catGame&&!document.querySelector('#start').disabled);await page.evaluate(()=>window.advanceTime(0));};
const snap=name=>page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});
const inspect=async label=>{
  const geometry=await page.evaluate(()=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
    const selectors=['#help','#settings','.home-main','.home-identity','#home-progress','#home-companion-preview','#start','#choose-level','#home-cat','#home-characters','#home-achievements','.home-details','#home-guide','#home-equipped-title','#resume-summary','#new-battle','#profile-notice'];
    const visible=e=>!!(e.offsetWidth||e.offsetHeight)&&getComputedStyle(e).visibility!=='hidden';
    return {width:innerWidth,height:innerHeight,document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight},
      screen:{top:document.querySelector('#home-screen').getBoundingClientRect().top,height:document.querySelector('#home-screen').clientHeight,scroll:document.querySelector('#home-screen').scrollHeight},
      elements:selectors.map(selector=>[selector,document.querySelector(selector)]).filter(([,e])=>visible(e)).map(([selector,e])=>({selector,...rect(e),scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,button:e.tagName==='BUTTON'}))};
  });
  report.push({label,...geometry});
  await snap(label);
  assert.ok(geometry.document.width<=geometry.width+1,`${label}: page horizontal scroll`);
  assert.ok(geometry.document.height<=geometry.height+1,`${label}: page vertical scroll`);
  assert.ok(geometry.screen.scroll<=geometry.screen.height+1,`${label}: home has internal scroll ${JSON.stringify(geometry)}`);
  for(const e of geometry.elements) {
    assert.ok(e.x>=-1&&e.y>=-1&&e.right<=geometry.width+1&&e.bottom<=geometry.height+1,`${label}: clipped ${JSON.stringify(e)}`);
    if(e.button)assert.ok(e.height>=44&&e.width>=44,`${label}: small button ${e.selector}`);
    if(!['#help','#settings','#profile-notice'].includes(e.selector))assert.ok(e.y>=geometry.screen.top-1,`${label}: overlaps header ${e.selector}`);
    if(e.selector!=='#home-companion-preview')assert.ok(e.scrollWidth<=e.clientWidth+1,`${label}: overflowing contents in ${e.selector}`);
  }
  const buttons=geometry.elements.filter(e=>e.button);
  for(let a=0;a<buttons.length;a++)for(let b=a+1;b<buttons.length;b++) {
    const x=buttons[a],y=buttons[b];assert.ok(!(Math.min(x.right,y.right)-Math.max(x.x,y.x)>1&&Math.min(x.bottom,y.bottom)-Math.max(x.y,y.y)>1),`${label}: buttons overlap ${x.selector}/${y.selector}`);
  }
  const cat=geometry.elements.find(e=>e.selector==='#home-companion-preview');assert.ok(cat.height>=55,`${label}: cat collapsed ${cat.height}`);
  for(const id of ['#start','#choose-level'])assert.ok(geometry.elements.find(e=>e.selector===id).y>=cat.bottom,`${label}: ${id} belongs below the cat`);
};
try {
  await page.addInitScript(key=>{const fixture=sessionStorage.getItem('home-layout-profile');if(fixture){localStorage.setItem(key,fixture);sessionStorage.removeItem('home-layout-profile');}},key);
  await page.goto(url,{waitUntil:'networkidle'});await ready();
  assert.equal(await page.locator('#home-screen .home-art,#home-screen .home-lead').count(),0);
  assert.doesNotMatch(await page.locator('#home-screen').innerText(),/一粒也不能少|一粒都不能少|带上你的猫咪|召集小队|一起守住|今天也很热闹/);
  const motion=()=>page.locator('#home-companion-preview [data-preview-part="tail"]').getAttribute('transform');
  const before=await motion();await page.waitForTimeout(220);assert.notEqual(await motion(),before,'home cat animates');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('#home-companion-preview [data-preview-part="tail"]').getAttribute('transform')==='rotate(0 38 132)');
  const still=await motion();await page.waitForTimeout(160);assert.equal(await motion(),still,'reduced motion stays still');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.waitForFunction(()=>document.querySelector('#home-companion-preview [data-preview-part="tail"]').getAttribute('transform')!=='rotate(0 38 132)');
  for(const [name,width,height] of sizes) {await page.setViewportSize({width,height});await page.waitForTimeout(100);await inspect(`new-${name}`);}
  const p=emptyProfile();p.cat=breedPreset('siamese');
  p.progress=Object.fromEntries(Array.from({length:30},(_,i)=>[`campaign-${String(i+1).padStart(2,'0')}`,{stars:3,bestTime:180,ratingVersion:2}]));
  for(const a of ACHIEVEMENTS)p.achievements.unlocked[a.id]={unlockedAt:1,source:'play'};
  p.achievements.equippedTitle='legend';p.achievements.unseenIds=[ACHIEVEMENTS[0].id];
  const battle=new Battle();battle.reset('campaign-30');battle.start();battle.time=187;
  p.run={battle:battle.save(),speed:2,awards:[]};
  await page.evaluate(profile=>sessionStorage.setItem('home-layout-profile',profile),serializeProfile(p));
  await page.reload({waitUntil:'networkidle'});await ready();
  assert.equal(await page.locator('#home-achievements .achievement-dot').count(),1);
  assert.match(await page.locator('#home-cat-description').textContent(),/暹罗猫/);
  for(const [name,width,height] of sizes) {await page.setViewportSize({width,height});await page.waitForTimeout(100);await inspect(`saved-${name}`);}
  // Status notices must take real layout space, including a storage failure.
  await page.setViewportSize({width:320,height:568});await page.evaluate(()=>{const e=document.querySelector('#profile-notice');e.hidden=false;e.textContent='保存失败，请检查设备存储后重试。';e.dataset.state='failed';});await page.waitForTimeout(100);await inspect('tiny-save-warning');
  await page.evaluate(()=>document.querySelector('#profile-notice').hidden=true);
  await page.setViewportSize({width:1280,height:720});await page.waitForTimeout(100);
  await page.locator('#new-battle').click();await page.locator('#replace-cancel').click();
  await page.locator('#home-achievements').click();await page.locator('#achievements-back').click();assert.equal(await page.locator('#home-achievements .achievement-dot').count(),0);
  await page.locator('#home-characters').click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__catGame.getScreen()),'home');
  await page.locator('#home-guide').click();await page.locator('#guide-close').click();
  await page.locator('#settings').click();await page.keyboard.press('Escape');
  await page.locator('#home-cat').click();
  const hidden=await motion();await page.waitForTimeout(160);assert.equal(await motion(),hidden,'home animation stops in the editor');
  const editorMotion=()=>page.locator('#cat-preview [data-preview-part="tail"]').getAttribute('transform');
  const editorBefore=await editorMotion();await page.waitForTimeout(180);assert.notEqual(await editorMotion(),editorBefore,'editor retains its animation');
  await page.locator('[data-cat-feature="breed"][data-cat-value="persian"]').click();await page.locator('#cat-save').click();
  await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).catEditor.dirty);await page.locator('#cat-back').click();
  assert.match(await page.locator('#home-cat-description').textContent(),/波斯猫/);
  assert.ok(await page.locator('#home-companion-preview').innerHTML().then(html=>html.includes('#faf4e9')),'large cat updates after saving');
  await page.locator('#home-cat').click();await page.locator('[data-cat-feature="breed"][data-cat-value="ragdoll"]').click();
  await page.locator('#cat-back').click();await page.locator('#cat-leave').click();
  assert.match(await page.locator('#home-cat-description').textContent(),/波斯猫/);
  assert.ok(await page.locator('#home-companion-preview').innerHTML().then(html=>html.includes('#faf4e9')),'discarded draft does not change home cat');
  await page.locator('#choose-level').click();assert.ok(await page.locator('#level-screen').evaluate(e=>e.scrollHeight>e.clientHeight),'level list remains scrollable');
  const levelsMotion=await motion();await page.waitForTimeout(160);assert.equal(await motion(),levelsMotion,'animation stops on other menus');
  await page.locator('#levels-back').click();const resumed=await motion();await page.waitForTimeout(160);assert.notEqual(await motion(),resumed,'animation resumes on return');
  await page.locator('#start').click();assert.equal(await page.evaluate(()=>window.__catGame.battle.phase),'paused');
  assert.ok(await page.locator('.game-shell').evaluate(e=>e.getBoundingClientRect().width<=520),'battle retains its own width');
  await page.locator('#resume').click();await page.locator('#pause').click();await page.locator('#pause-home').click();await inspect('return-home');
  await page.locator('body').click({position:{x:1,y:1}});
  for(let i=0;i<12;i++) {await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>{const r=document.activeElement.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'keyboard focus remains visible');}
  assert.deepEqual(errors,[]);writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',errors,report},null,2));
  console.log(`PASS ${engine}: ${report.length} home layouts, all content fits, saved run, title, red dot, custom cat, keyboard and every entry`);
} catch(error) {writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'failed',errors,report},null,2));await snap('FAILURE');throw error;} finally {await browser.close();}
