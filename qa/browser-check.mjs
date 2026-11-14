/* Integration checks against real Chromium. App runtime has no dependencies.
 * Supply NOEL_BROWSER_DRIVER pointing to a module exporting puppeteer/default.
 * The driver is provided by the development environment, not shipped with the app.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const driver = await import(process.env.NOEL_BROWSER_DRIVER || 'puppeteer');
const puppeteer = driver.puppeteer || driver.default;
const base = process.env.NOEL_URL || 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({
  executablePath: process.env.NOEL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const report = { checks: [], errors: [], requests: [], performance: null };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const check = (name, evidence) => { report.checks.push({ name, status: 'pass', evidence }); console.log('PASS', name); };
const pages = [];
async function newPage(width = 1440, height = 900, mobile = false) {
  const page = await browser.newPage(); pages.push(page);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => report.requests.push(request.url()));
  await page.setViewport({ width, height, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  return page;
}
async function ready(page) {
  await page.goto(base, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.noel?.getState().ready, { timeout: 15000 });
}
async function openWish(page) {
  await page.click('#letter-button');
  await page.click('#wish-button');
  await page.waitForFunction(() => document.getElementById('wish-dialog').open);
}
async function noOverflow(page, label) {
  const result = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.masthead button, .workbench button, .footer button, #letter-button')];
    const out = controls.filter(el => {
      const r = el.getBoundingClientRect();
      return r.left < 0 || r.right > innerWidth + 1 || r.top < 0 || r.bottom > Math.max(innerHeight, document.body.scrollHeight) + 1;
    }).map(el => el.id || el.textContent.trim());
    return { width: innerWidth, height: innerHeight, scrollWidth: document.documentElement.scrollWidth, out };
  });
  assert.equal(result.scrollWidth, result.width); assert.deepEqual(result.out, []);
  check(label, result);
}

try {
  const page = await newPage();
  await ready(page);
  const initial = await page.evaluate(() => noel.getState());
  assert(initial.ready && initial.points > 30000);
  assert.equal(initial.audio.enabled, false);
  await page.waitForFunction(() => noel.getState().formation === 1);
  check('Initial render, complete tree, audio opt-in', initial);
  await noOverflow(page, '1440×900 layout');
  await page.screenshot({ path: path.join(root, 'desktop.png') });

  report.performance = await page.evaluate(() => new Promise(resolve => {
    const times = []; let last;
    function sample(t) {
      if (last) times.push(t - last); last = t;
      if (times.length < 90) requestAnimationFrame(sample);
      else { times.sort((a,b) => a-b); resolve({ frames: times.length, averageMs: times.reduce((a,b)=>a+b,0)/times.length, p95Ms: times[Math.floor(times.length*.95)] }); }
    }
    requestAnimationFrame(sample);
  }));
  const glError = await page.evaluate(() => document.querySelector('canvas').getContext('webgl').getError());
  assert.equal(glError, 0); check('WebGL error state', { error: glError, ...report.performance });

  await page.click('#pause-button');
  const frozen = await page.evaluate(() => noel.getState());
  await delay(180);
  assert.equal((await page.evaluate(() => noel.getState())).rotation, frozen.rotation);
  check('Pause freezes scene', frozen.paused);
  await page.focus('#winter-canvas'); await page.keyboard.press('ArrowRight'); await delay(300);
  assert((await page.evaluate(() => noel.getState())).rotation > frozen.rotation + 0.1);
  const beforeZoom = (await page.evaluate(() => noel.getState())).zoom;
  await page.keyboard.press('+'); await delay(300);
  assert((await page.evaluate(() => noel.getState())).zoom > beforeZoom);
  await page.keyboard.press('-'); await delay(300);
  check('Keyboard orbit and zoom', 'ArrowRight, + and − change the actual renderer state while paused.');

  const beforeDrag = (await page.evaluate(() => noel.getState())).rotation;
  await page.mouse.move(1030, 440); await page.mouse.down(); await page.mouse.move(1140, 455, { steps: 8 }); await page.mouse.up(); await delay(300);
  assert((await page.evaluate(() => noel.getState())).rotation > beforeDrag + 0.5);
  check('Pointer drag', 'The camera rotated after an actual pointer drag.');
  for (const palette of [1, 2, 0]) {
    await page.click(`[data-palette="${palette}"]`);
    assert.equal((await page.evaluate(() => noel.getState())).palette, palette);
    assert.equal(await page.$eval(`[data-palette="${palette}"]`, e => e.getAttribute('aria-pressed')), 'true');
  }
  for (const mode of [1, 0]) {
    await page.click(`[data-mode="${mode}"]`);
    assert.equal((await page.evaluate(() => noel.getState())).mode, mode);
  }
  check('All palettes and both render modes', 'State and aria-pressed agree with selected controls.');

  const downloads = path.join(root, 'downloads'); await fs.mkdir(downloads, { recursive: true });
  const client = await page.createCDPSession();
  await client.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloads });
  await page.click('#save-button');
  const exportPath = path.join(downloads, 'noel-a-little-winter-wonder.png');
  let exported;
  for (let i = 0; i < 60; i++) { try { exported = await fs.readFile(exportPath); break; } catch { await delay(100); } }
  assert(exported?.length > 10000); assert.equal(exported.subarray(1, 4).toString(), 'PNG');
  check('PNG download', { bytes: exported.length, signature: 'PNG' });

  await page.click('#sound-button');
  await page.waitForFunction(() => noel.getState().audio.enabled);
  assert.equal((await page.evaluate(() => noel.getState())).audio.state, 'running');
  await page.click('#sound-button');
  await page.waitForFunction(() => !noel.getState().audio.enabled);
  check('Audio opt-in and off', 'A real button click starts AudioContext; a second click disables the score.');

  await page.click('#letter-button');
  await page.waitForFunction(() => noel.getState().letterOpen && noel.getState().heart === 1);
  const letter = await page.$eval('#letter-dialog', el => el.innerText);
  for (const phrase of ['시은이에게', '이기적으로', '상처를', '사귀어 주고', '정말 고마워', '행복하게 해 주고 싶어']) assert(letter.includes(phrase));
  await page.screenshot({ path: path.join(root, 'letter-desktop.png') });
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'letter-button');
  check('Personal letter, held heart, Escape and focus return', 'The requested apology, thanks and wish for Si-eun’s happiness appear in a native dialog.');

  await openWish(page);
  assert.equal(await page.$eval('#wish-input', e => e.checkValidity()), false);
  await page.type('#wish-input', '   '); await page.click('.submit-wish');
  assert.equal(await page.$eval('#wish-input', e => e.checkValidity()), false);
  await page.$eval('#wish-input', e => { e.value = ''; e.dispatchEvent(new Event('input', {bubbles:true})); });
  const wish = '우리의 모든 겨울이 따뜻하기를.';
  await page.type('#wish-input', wish); await page.click('.submit-wish');
  await page.waitForFunction(() => noel.getState().heart === 1);
  assert.equal(await page.evaluate(() => localStorage.getItem('noel.private-wish.v1')), wish);
  await delay(450); await page.screenshot({ path: path.join(root, 'wish-heart.png') });
  check('Empty, whitespace and saved wish', 'Empty/blank input is rejected; valid text persists and changes the tree into a heart.');
  await ready(page);
  await openWish(page);
  assert.equal(await page.$eval('#wish-input', e => e.value), wish);
  await page.click('#forget-wish');
  assert.equal(await page.evaluate(() => localStorage.getItem('noel.private-wish.v1')), null);
  check('Wish persistence and deletion', 'Reload restores the wish; the visible delete button removes the storage key.');

  await page.click('#replay-button');
  assert((await page.evaluate(() => noel.getState())).formation < 0.2);
  await page.waitForFunction(() => noel.getState().formation === 1);
  await page.click('#burst-button');
  await page.waitForFunction(() => noel.getState().burst > 0.1);
  await page.waitForFunction(() => noel.getState().burst < 0.01, { timeout: 10000 });
  check('Growth and burst recovery', 'The tree grows again, bursts, and returns to its original structure.');

  for (const [width, height, name] of [[390,844,'mobile'],[360,740,'mobile-small'],[1920,1080,'desktop-large'],[844,390,'landscape']]) {
    await page.setViewport({width, height, deviceScaleFactor:1, isMobile:width < 761, hasTouch:width < 761});
    // Changing isMobile can reload Chromium; wait for the actual final scene.
    await page.waitForFunction(() => window.noel?.getState().ready && window.noel.getState().formation === 1, {timeout:20000});
    await delay(200); await noOverflow(page, `${width}×${height} layout`);
    await page.screenshot({path:path.join(root, `${name}.png`),fullPage:true});
    if (width === 390) {
      const state = await page.evaluate(() => noel.getState());
      const cdp = await page.createCDPSession();
      await cdp.send('Input.dispatchTouchEvent', {type:'touchStart', touchPoints:[{x:155,y:440,id:0},{x:235,y:440,id:1}]});
      await cdp.send('Input.dispatchTouchEvent', {type:'touchMove', touchPoints:[{x:130,y:440,id:0},{x:260,y:440,id:1}]});
      await cdp.send('Input.dispatchTouchEvent', {type:'touchEnd', touchPoints:[]}); await delay(300);
      assert((await page.evaluate(() => noel.getState())).zoom > state.zoom + 0.1);
      check('Two-finger pinch', 'Real CDP touch events zoom the mobile tree.');
      await page.focus('#winter-canvas');
      for (let i=0;i<5;i++) await page.keyboard.press('-'); await delay(200);
      await page.click('#letter-button'); await delay(300);
      await page.screenshot({path:path.join(root, 'letter-mobile.png')}); await page.keyboard.press('Escape');
    }
  }

  const reduced = await newPage(390,844,true);
  await reduced.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await ready(reduced);
  const reducedState = await reduced.evaluate(() => noel.getState());
  assert(reducedState.paused && reducedState.reducedMotion && reducedState.formation === 1);
  await delay(200); assert.equal((await reduced.evaluate(() => noel.getState())).rotation,reducedState.rotation);
  await reduced.click('#letter-button');
  await reduced.waitForFunction(() => noel.getState().heart === 1);
  await reduced.screenshot({path:path.join(root,'reduced-motion.png')});
  check('Reduced motion', 'Initial tree stays static; the explicit letter action shows a static heart without a transition.');

  const partial = await newPage(390,844,true);
  await partial.evaluateOnNewDocument(() => { Storage.prototype.setItem = () => { throw new DOMException('Test: blocked storage','SecurityError'); }; });
  await ready(partial); await openWish(partial);
  await partial.type('#wish-input', '<b>시은아, 행복하자.</b>'); await partial.click('.submit-wish');
  await partial.waitForFunction(() => document.getElementById('toast').textContent.includes('저장은 사용할 수 없어'));
  assert.equal(await partial.$eval('#wish-floating p',e=>e.children.length),0);
  await partial.screenshot({path:path.join(root,'storage-unavailable.png')});
  check('Storage unavailable and literal input', 'Denied storage gives honest feedback; HTML-like wish text never becomes markup.');

  const recovery = await newPage(); await ready(recovery);
  assert(await recovery.evaluate(() => !!document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context')));
  await recovery.evaluate(() => { window.loss = document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context'); window.loss.loseContext(); });
  await recovery.waitForFunction(() => !document.getElementById('fallback').hidden);
  await recovery.screenshot({path:path.join(root,'context-lost.png')});
  await delay(200); await recovery.evaluate(() => window.loss.restoreContext());
  await recovery.waitForFunction(() => document.getElementById('fallback').hidden && !noel.getState().contextLost);
  check('WebGL context loss and restoration', 'The recovery notice appears on loss; GPU resources are recreated and the notice clears.');

  const unavailable = await newPage();
  await unavailable.evaluateOnNewDocument(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type,...args){ return type === 'webgl' ? null : original.call(this,type,...args); };
  });
  await unavailable.goto(base,{waitUntil:'networkidle0'});
  assert.equal(await unavailable.$eval('#fallback',e=>e.hidden),false);
  await unavailable.screenshot({path:path.join(root,'webgl-unavailable.png')});
  check('WebGL unavailable', 'A clear recovery panel and retry button replace the loading indicator.');

  assert.deepEqual(report.errors,[]);
  const remote = [...new Set(report.requests)].filter(url => !url.startsWith(base) && !url.startsWith('data:') && !url.startsWith('blob:'));
  assert.deepEqual(remote,[]); check('No uncaught errors or external requests', 'All fonts, scripts and styles are served locally.');
  report.status = 'pass';
} catch(error) {
  report.status = 'fail'; report.failure = error.stack;
  console.error(error.stack); process.exitCode = 1;
} finally {
  await fs.writeFile(path.join(root,'browser-checks.json'),JSON.stringify(report,null,2));
  await browser.close();
}
