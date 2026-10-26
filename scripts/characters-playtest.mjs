import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { catalogKinds, characterInfo } from '../src/game/character-catalog.ts';
import { UNITS } from '../src/game/content.ts';

const engine=process.env.TEST_BROWSER||'chromium', out='test-results/characters';
mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true});
const page=await context.newPage(), errors=[];
page.on('pageerror',error=>errors.push(error.message));
page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const capture=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});};
const noOverflow=async()=>assert.ok(await page.evaluate(()=>{
  const root=document.querySelector('#character-screen');return document.documentElement.scrollWidth<=innerWidth&&root.scrollWidth<=root.clientWidth+1;
}),'catalog fits the viewport');
try {
  await page.goto(`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`,{waitUntil:'networkidle'});
  await page.locator('#loading').waitFor({state:'detached'});await page.waitForFunction(()=>!document.querySelector('#start').disabled);
  await page.evaluate(()=>window.advanceTime(0));
  await capture('home');
  const initial=await page.evaluate(()=>window.__catGame.getProfile());
  await page.locator('#home-characters').tap();
  assert.equal((await read()).screen,'characters');assert.equal(await page.locator('.catalog-card').count(),16);
  assert.match(await page.locator('#catalog-summary').textContent(),/2 \/ 16/);
  const stories=new Set();
  for(const side of ['player','enemy']){
    await page.locator(`[data-catalog-side="${side}"]`).click();
    const kinds=catalogKinds(side);assert.equal(await page.locator('.catalog-card').count(),kinds.length);
    await page.locator(`[data-character="${kinds[0]}"]`).click();
    assert.equal(await page.locator('[data-catalog-step="-1"]').isDisabled(),true);
    for(let index=0;index<kinds.length;index++){
      const kind=kinds[index],info=characterInfo(kind,side);
      assert.equal((await read()).catalog.selected,kind);
      assert.equal(await page.locator('#catalog-character-name').textContent(),info.name);
      assert.equal(await page.locator('.catalog-story p').textContent(),info.story);stories.add(info.story);
      assert.ok(info.story.length>=60);assert.equal(await page.locator('.catalog-mechanics li').count(),info.mechanics.length);
      const image=page.locator('.catalog-hero-art img');await image.evaluate(img=>img.decode());
      assert.ok(await image.evaluate(img=>img.naturalWidth>0));
      for(const [i,stat] of info.stats.entries()){
        assert.equal(await page.locator('.catalog-stats dt').nth(i).textContent(),stat.label);
        assert.equal(await page.locator('.catalog-stats dd').nth(i).textContent(),stat.value);
      }
      if(kind!=='boss')assert.equal(await page.locator('.catalog-requirements dd').nth(1).textContent(),String(UNITS[kind].cost));
      else {assert.match(await page.locator('.catalog-acquisition').textContent(),/30.*30%.*不能招募/);assert.equal(await page.locator('.catalog-requirements').count(),0);}
      await noOverflow();
      if(index<kinds.length-1)await page.locator('[data-catalog-step="1"]').tap();
    }
    assert.equal(await page.locator('[data-catalog-step="1"]').isDisabled(),true);
    if(side==='enemy')await capture('boss');
    await page.keyboard.press('Escape');assert.equal((await read()).catalog.selected,null);
  }
  assert.equal(stories.size,25);
  assert.deepEqual(await page.evaluate(()=>window.__catGame.getProfile()),initial,'reading every dossier does not grant units or mutate progress');
  await page.locator('[data-catalog-side="player"]').tap();
  for(const [name,width,height] of [['tiny',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>document.querySelector('#character-screen').scrollTop=0);
    await capture(`${name}-index`);await noOverflow();
    assert.ok(await page.locator('.catalog-card').evaluateAll(cards=>cards.every(card=>{const r=card.getBoundingClientRect();return r.width>=44&&r.height>=44;})));
    await page.locator('[data-character="umbrella"]').scrollIntoViewIfNeeded();
    const scroll=await page.locator('#character-screen').evaluate(el=>el.scrollTop);
    await page.locator('[data-character="umbrella"]').tap();
    assert.match(await page.locator('.catalog-hero-tags').textContent(),/第 8 关加入/);
    await capture(`${name}-detail`);await noOverflow();
    await page.locator('.catalog-stats').scrollIntoViewIfNeeded();await capture(`${name}-stats`);await noOverflow();
    await page.locator('[data-catalog-list]').tap();
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.character),'umbrella');
    assert.ok(Math.abs(await page.locator('#character-screen').evaluate(el=>el.scrollTop)-scroll)<2);
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('[data-character="soldier"]').focus();await page.keyboard.press('Enter');
  assert.equal((await read()).catalog.selected,'soldier');
  await page.locator('#help').tap();await page.keyboard.press('Escape');assert.equal((await read()).screen,'characters');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  assert.equal((await read()).screen,'home');assert.equal(await page.evaluate(()=>document.activeElement.id),'home-characters');

  await page.locator('#start').tap();await page.locator('#hire-soldier').tap();await page.locator('#upgrade-tech').tap();
  await page.evaluate(()=>window.advanceTime(2000));await page.locator('#pause').tap();
  const checkpoint=await page.evaluate(()=>window.__catGame.battle.save());
  await page.locator('#pause-characters').tap();await page.locator('[data-character="knight"]').tap();
  for(const key of ['Digit8','KeyE','KeyT','KeyH','KeyC','Space','KeyP'])await page.keyboard.press(key);
  await page.evaluate(()=>window.advanceTime(60000));
  assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint,'reading/shortcuts leave the paused battle untouched');
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  assert.equal((await read()).screen,'battle');assert.equal((await read()).phase,'paused');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'pause-characters');await capture('pause-return');
  await page.locator('#pause-characters').tap();await page.reload({waitUntil:'networkidle'});
  await page.waitForFunction(()=>!document.querySelector('#start').disabled);await page.locator('#start').tap();
  assert.equal((await read()).phase,'paused');assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint);
  await page.locator('#resume').tap();await page.evaluate(()=>window.advanceTime(1000));assert.ok((await read()).time>checkpoint.time);
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',engine,characters:stories.size,errors,checks:['all portraits and dossiers','live config attributes','locked previews do not unlock','four sizes','keyboard focus and list scroll','paused battle preserved','reload from catalog restores checkpoint']},null,2));
  console.log(`PASS ${engine}: 25 dossiers, four viewports, readonly progression, keyboard, pause and resume`);
}catch(error){await capture('FAILURE');throw error;}finally{await browser.close();}
