import { chromium, webkit } from 'playwright';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';

const engine=process.env.TEST_BROWSER||'chromium',out='test-results/cat-editor';mkdirSync(out,{recursive:true});
const browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const url=`${process.env.GAME_URL||'http://127.0.0.1:5186'}/?qa`;
const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
const advance=ms=>page.evaluate(ms=>window.advanceTime(ms),ms);
const ready=()=>page.waitForFunction(()=>window.__catGame&&!document.querySelector('#home-cat').disabled);
const capture=async name=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:`${out}/${engine}-${name}.png`,fullPage:true});};
const tab=id=>page.locator(`[data-cat-tab="${id}"]`).click();
const select=(key,value)=>page.locator(`[data-cat-feature="${key}"][data-cat-value="${value}"]`).click();
const save=async()=>{await page.locator('#cat-save').click();await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text()).catEditor;return s&&!s.busy&&!s.dirty;});};
try {
  await page.goto(url,{waitUntil:'networkidle'});await ready();await advance(0);
  const original=(await read()).baseCats.player.appearance;
  await page.locator('#home-cat').click();assert.equal((await read()).screen,'cat');
  await capture('editor-phone');
  for(const breed of ['british-shorthair','domestic-shorthair','ragdoll','siamese','persian','scottish-fold']){
    await select('breed',breed);assert.equal((await read()).catEditor.draft.breed,breed);
    await capture(`breed-${breed}`);
  }
  await page.locator('#cat-reset').click();assert.deepEqual((await read()).catEditor.draft,original);
  await page.locator('#cat-undo').click();assert.equal((await read()).catEditor.draft.breed,'scottish-fold');
  await select('breed','ragdoll');
  await tab('coat');await page.locator('[data-cat-palette="1"]').click();await select('pattern','calico');
  await page.locator('#cat-region').selectOption('paws');await page.locator('[data-cat-swatch="#fff6e3"]').click();
  await tab('shape');await select('face','pointed');await select('body','chubby');
  await tab('face');await select('eyeShape','round');await select('mouth','smile');await select('nose','heart');
  await page.locator('[data-cat-color="eyes"]').fill('#78a4bf');
  await page.locator('[data-cat-color="noseColor"]').fill('#b85b49');
  assert.equal((await read()).catEditor.draft.eyes,'#78a4bf');
  assert.equal((await read()).catEditor.draft.noseColor,'#b85b49', await page.locator('[data-cat-color="noseColor"]').evaluate(el=>JSON.stringify({type:el.type,attr:el.getAttribute('type'),value:el.value})));
  await tab('parts');await select('ears','folded');await select('tail','fluffy');await select('paws','round');
  const customized=(await read()).catEditor.draft;
  assert.deepEqual((await read()).baseCats.player.appearance,original,'draft never changes the battle');
  assert.equal(await page.evaluate(()=>window.__catGame.getProfile().cat.breed),'british-shorthair');
  await page.locator('#cat-size').click();assert.equal(await page.locator('#cat-preview svg').evaluate(el=>Math.round(el.getBoundingClientRect().width)),64);
  await capture('battle-size');await page.locator('#cat-size').click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.waitForFunction(()=>document.querySelector('[data-preview-part="headGroup"]').getAttribute('transform')==='translate(0 0) rotate(0 80 92)');
  const still=await page.locator('[data-preview-part="headGroup"]').getAttribute('transform');await page.waitForTimeout(120);
  assert.equal(await page.locator('[data-preview-part="headGroup"]').getAttribute('transform'),still);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.keyboard.press('Escape');await page.locator('#cat-stay').click();assert.deepEqual((await read()).catEditor.draft,customized);
  await save();assert.deepEqual((await read()).baseCats.player.appearance,customized);await capture('customized');
  await page.locator('#cat-back').click();await page.locator('#start').click();await advance(0);
  assert.deepEqual((await read()).baseCats.player.appearance,customized);assert.equal((await read()).baseCats.animation.player.visible,true);
  await page.locator('#hire-soldier').click();await advance(1100);await capture('battle-customized');await page.locator('#pause').click();
  const checkpoint=await page.evaluate(()=>window.__catGame.battle.save());
  await page.locator('#pause-cat').click();await advance(3000);await page.keyboard.press('Digit1');
  assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint,'editing freezes the original round');
  await page.locator('#cat-random').click();await page.locator('#cat-back').click();await page.locator('#cat-leave').click();
  assert.deepEqual((await read()).baseCats.player.appearance,customized);assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint);
  await page.reload({waitUntil:'networkidle'});await ready();await advance(0);await page.locator('#start').click();await advance(0);
  assert.deepEqual((await read()).baseCats.player.appearance,customized);
  assert.deepEqual(await page.evaluate(()=>window.__catGame.battle.save()),checkpoint,'reload restores full battle and customized cat');
  await page.locator('#restart').click();await advance(0);assert.deepEqual((await read()).baseCats.player.appearance,customized);
  assert.equal((await read()).time,0);await page.locator('#pause').click();await page.locator('#pause-cat').click();
  for(const [name,width,height] of [['tiny',320,568],['phone',390,844],['landscape',844,390],['desktop',1440,900]]){
    await page.setViewportSize({width,height});await page.waitForTimeout(120);
    for(const id of ['breed','coat','shape','face','parts']){
      await tab(id);
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name}/${id}: no horizontal overflow`);
      assert.ok(await page.locator('#cat-options').evaluate(el=>el.clientHeight>=65),`${name}/${id}: scrollable options remain usable`);
      const bounds=await page.locator('#cat-save').boundingBox();assert.ok(bounds&&bounds.y>=0&&bounds.y+bounds.height<=Math.max(height,560)+1,`${name}: save is reachable`);
    }
    await capture(name);
  }
  await page.setViewportSize({width:390,height:844});
  // Repeated applied presets must release previous custom textures.
  await tab('breed');
  for(const breed of ['siamese','persian','british-shorthair','scottish-fold']){await select('breed',breed);await save();assert.equal(await page.evaluate(()=>window.__catGame.getCatTextureKeys().length),11,'old appearance textures are released');}
  // Storage failure is visible, retains the previous persisted appearance, and can be retried.
  const savedRaw=await page.evaluate(()=>localStorage.getItem(window.__catGame.storageKey));
  await select('breed','domestic-shorthair');
  await page.evaluate(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new Error('quota');};});
  await page.locator('#cat-save').click();await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).catEditor.busy);
  assert.match(await page.locator('#cat-status').textContent(),/保存失败/);
  assert.equal(await page.evaluate(()=>localStorage.getItem(window.__catGame.storageKey)),savedRaw);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem;});await save();
  await page.locator('#cat-back').click();await page.locator('#resume').click();await advance(300);
  assert.equal((await read()).baseCats.player.appearance.breed,'domestic-shorthair');
  // Future-version protection disables saving but still allows previews.
  const protectedPage=await browser.newPage();
  await protectedPage.addInitScript(()=>localStorage.setItem('paw-pantry-progress-qa-v3','{"version":99,"keep":"original"}'));
  await protectedPage.goto(url,{waitUntil:'networkidle'});await protectedPage.waitForFunction(()=>!document.querySelector('#home-cat').disabled);
  await protectedPage.locator('#home-cat').click();await protectedPage.locator('[data-cat-value="ragdoll"]').click();
  assert.equal(await protectedPage.locator('#cat-save').isDisabled(),true);
  assert.equal(await protectedPage.evaluate(()=>localStorage.getItem('paw-pantry-progress-qa-v3')),'{"version":99,"keep":"original"}');
  await protectedPage.close();
  assert.deepEqual(errors,[]);
  writeFileSync(`${out}/${engine}-report.json`,JSON.stringify({status:'passed',engine,customized,errors,checks:['all ten appearance fields','six presets','preview / undo / reset / random','draft isolation / discard','save / actual battle / reload / restart','paused battle unchanged','four viewports and five tabs','reduced motion','storage failure and retry','future-version protection']},null,2));
  console.log(`PASS ${engine}: custom cat editor, storage, battle integration and responsive UI`);
}catch(error){await capture('FAILURE');throw error;}finally{await browser.close();}
