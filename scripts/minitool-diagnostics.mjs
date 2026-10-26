// Local diagnostics only; the Xiaohongshu simulator and real devices remain required.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium, webkit } from '@playwright/test';
import postcss from 'postcss';

const root = path.resolve('dist-minitool');
const output = path.resolve('test-results/minitool');
await fs.mkdir(output, { recursive: true });
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    assert.ok(file.startsWith(root + path.sep));
    let body = await fs.readFile(file);
    if (url.searchParams.has('legacy') && file.endsWith('.css')) {
      const css = postcss.parse(body.toString());
      css.walkAtRules('supports', rule => rule.remove());
      css.walkDecls(decl => { if (/^(gap|row-gap|column-gap|aspect-ratio|backdrop-filter|-webkit-backdrop-filter)$/.test(decl.prop) || /\b(?:min|max|clamp|color-mix)\(/.test(decl.value)) decl.remove(); });
      body = Buffer.from(css.toString());
    }
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' })[path.extname(file)]);
    res.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; media-src 'self'; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'");
    res.end(body);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const reports = [];
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const legacy of [false, true]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
        const page = await context.newPage();
        const errors = [], violations = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        page.on('request', req => { if (/^https?:/.test(req.url()) && !req.url().startsWith(origin)) requests.push(req.url()); });
        if (legacy) {
          await page.route('**/*.css', route => route.continue({ url: route.request().url() + '?legacy' }));
        }
        await page.addInitScript(({ legacy }) => {
          window.__diagnostic = { blocked: [], violations: [], native: [] };
          document.addEventListener('securitypolicyviolation', event => window.__diagnostic.violations.push(event.violatedDirective));
          for (const name of ['fetch', 'XMLHttpRequest', 'Worker', 'SharedWorker', 'WebSocket', 'EventSource']) {
            window[name] = function () { window.__diagnostic.blocked.push(name); throw new Error(`Forbidden capability: ${name}`); };
          }
          if (legacy) {
            window.ResizeObserver = undefined; Object.fromEntries = undefined; Element.prototype.replaceChildren = undefined;
            const append = Node.prototype.appendChild;
            Node.prototype.appendChild = function (node) {
              if (node instanceof HTMLElement && node.style.visibility === 'hidden' && node.style.flexDirection === 'column' && node.style.rowGap === '1px') node.style.rowGap = '0px';
              return append.call(this, node);
            };
          }
          // A documented API stub tests integration paths, not the real native bridge.
          window.xhs = { launchOptions: { miniToolEnv: { buildVersion: 9510000 } }, miniTool: {
            getStorage: async ({ key }) => { window.__diagnostic.native.push('getStorage'); return { data: JSON.stringify({ sunroom: { stars: 3, bestTime: 120, ratingVersion: 2 } }) }; },
            setStorage: async () => { window.__diagnostic.native.push('setStorage'); },
            getWindowInfo: async () => { window.__diagnostic.native.push('getWindowInfo'); return { windowWidth: innerWidth, windowHeight: innerHeight, safeArea: { left: 0, top: 24, right: innerWidth, bottom: innerHeight - 16 }, menuButtons: { back: null, me: null, share: { left: innerWidth - 52, right: innerWidth - 8, top: 24, bottom: 62, width: 44, height: 38 } } }; },
          } };
        }, { legacy });
        const id = `${engine.name()}-${legacy ? 'fallback' : 'production'}`;
        try {
          await page.goto(origin, { waitUntil: 'networkidle' });
          await page.locator('#loading').waitFor({ state: 'detached', timeout: 15000 });
          assert.equal(await page.evaluate(() => document.documentElement.classList.contains('no-flex-gap')), legacy);
          assert.equal(await page.evaluate(() => typeof window.__catGame), 'undefined');
          assert.equal(await page.evaluate(() => typeof window.advanceTime), 'undefined');
          await page.screenshot({ path: path.join(output, `${id}-home.png`) });
          await page.locator('#home-cat').click();
          await page.locator('[data-cat-feature="breed"][data-cat-value="ragdoll"]').click();
          await page.locator('#cat-save').click();
          await page.waitForFunction(()=>{const s=JSON.parse(window.render_game_to_text()).catEditor;return s&&!s.busy&&!s.dirty;});
          assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).baseCats.player.appearance.breed),'ragdoll');
          await page.screenshot({path:path.join(output,`${id}-cat-editor.png`)});
          await page.locator('#cat-back').click();
          await page.locator('#choose-level').click();
          assert.match(await page.locator('#legacy-records').textContent(), /阳光客厅.*3 星/);
          await page.locator('#level-campaign-01').click();
          await page.locator('#level-start').click();
          await page.locator('#hire-soldier').click();
          await page.locator('#hire-mouse').click();
          await page.locator('#catnip').click();
          assert.equal(await page.evaluate(() => JSON.parse(window.render_game_to_text()).player.energy), 10);
          const idleBefore=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).baseCats.animation);
          await page.waitForTimeout(1100);
          const idleAfter=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).baseCats.animation);
          for(const side of ['player','enemy']) {
            assert.notDeepEqual(idleAfter[side].head,idleBefore[side].head,'camp cats animate on the real game loop');
            assert.notDeepEqual(idleAfter[side].parts.tail,idleBefore[side].parts.tail);
          }
          await page.screenshot({ path: path.join(output, `${id}-battle.png`) });
          await page.locator('#pause').click();
          const before = await page.evaluate(() => JSON.parse(window.render_game_to_text()).time);
          await page.waitForTimeout(150);
          assert.equal(await page.evaluate(() => JSON.parse(window.render_game_to_text()).time), before);
          await page.locator('#help').click();
          await page.locator('#guide-close').click();
          await page.locator('#pause-characters').click();
          assert.equal(await page.locator('.catalog-card').count(),16);
          await page.locator('[data-catalog-side="enemy"]').click();
          await page.locator('[data-character="boss"]').click();
          await page.locator('.catalog-hero-art img').evaluate(img=>img.decode());
          assert.match(await page.locator('.catalog-acquisition').textContent(),/不能招募/);
          assert.ok(await page.evaluate(()=>document.querySelector('#character-screen').scrollWidth<=document.querySelector('#character-screen').clientWidth+1));
          await page.locator('#catalog-back').click();await page.locator('#catalog-back').click();
          assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).time),before);
          await page.locator('#resume').click();
          for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 1280, height: 900 }]) {
            await page.setViewportSize(viewport);
            await page.waitForTimeout(200);
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Horizontal overflow at ${viewport.width}`);
            assert.ok(await page.evaluate(() => document.querySelector('#battle-canvas canvas').width > 0));
          }
          const nativeState = await page.evaluate(() => window.__diagnostic);
          assert.deepEqual(nativeState.blocked, []);
          assert.deepEqual(nativeState.violations, []);
          assert.deepEqual(requests, []);
          assert.deepEqual(errors, []);
          reports.push({ id, result: 'passed', nativeCalls: nativeState.native, checks: ['strict CSP', 'no network API calls', 'local image textures', 'load native saved progress', 'window safe area', 'recruit', 'cast', 'real-time camp cat motion', 'pause', 'guide', 'character catalog and boss portrait', 'custom cat editor, native save and dynamic textures', 'resize', 'no production QA hooks'], limits: 'Native API stub and modern engines; not container or Chrome 61 acceptance.' });
        } catch (error) {
          console.error(JSON.stringify({ id, errors, diagnostics: await page.evaluate(() => window.__diagnostic) }));
          await page.screenshot({ path: path.join(output, `${id}-failure.png`), fullPage: true });
          throw error;
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(reports, null, 2));
console.log(JSON.stringify(reports, null, 2));
