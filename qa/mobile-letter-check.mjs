/* Focused mobile regression: the real WebGL heart must stay visible while reading. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const driver = await import(process.env.NOEL_BROWSER_DRIVER || 'puppeteer');
const browser = await (driver.puppeteer || driver.default).launch({
  executablePath: process.env.NOEL_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const base = process.env.NOEL_URL || 'http://127.0.0.1:4173';
const results = { url: base, environment: 'Chromium mobile viewport/touch emulation on macOS; not a physical iOS/Android test.', checks: [], errors: [] };
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
function pass(name, evidence) { results.checks.push({ name, status: 'pass', evidence }); console.log('PASS', name); }
async function inspect(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('winter-canvas');
    const paper = document.getElementById('letter-paper');
    const stage = document.getElementById('letter-visual');
    const rect = el => el.getBoundingClientRect().toJSON();
    const gl = canvas.getContext('webgl');
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0,0,canvas.width,canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    let brightPixels = 0;
    for (let i=0;i<pixels.length;i+=4) if(pixels[i]>95 && pixels[i+1]>40 && pixels[i]>pixels[i+2]*1.15) brightPixels++;
    return {
      state: noel.getState(), viewport: [innerWidth,innerHeight],
      dialog: rect(document.getElementById('letter-dialog')), stage: rect(stage), canvas: rect(canvas), paper: rect(paper),
      close: rect(document.querySelector('#letter-dialog .dialog-close')),
      font: parseFloat(getComputedStyle(paper.querySelector('.letter-body p')).fontSize),
      scroll: { top:paper.scrollTop,height:paper.scrollHeight,client:paper.clientHeight,width:paper.scrollWidth,clientWidth:paper.clientWidth },
      canvasParent:canvas.parentElement.id, canvasCount:document.querySelectorAll('canvas').length,
      moreVisible:!document.getElementById('letter-more-button').hidden,
      glError:gl.getError(),brightPixels,
    };
  });
}
async function readyLetter(page) {
  await page.waitForFunction(()=>window.noel?.getState().ready);
  await page.tap('#letter-button');
  await page.waitForFunction(()=>noel.getState().letterOpen && noel.getState().heart>.999 && noel.getState().letterPresentation);
}
try {
  const page=await browser.newPage();
  page.on('pageerror',error=>results.errors.push(error.message));
  for(const [width,height] of [[320,568],[360,640],[375,667],[390,844],[412,915],[430,932],[852,393]]) {
    await page.setViewport({width,height,deviceScaleFactor:2,isMobile:true,hasTouch:true});
    await page.goto(base,{waitUntil:'networkidle0'});
    await readyLetter(page);
    const before=await inspect(page);
    assert(before.state.letterOpen && before.state.letterPresentation);
    assert.equal(before.canvasParent,'letter-visual'); assert.equal(before.canvasCount,1);
    assert.equal(before.glError,0); assert(before.brightPixels>300,'The stage must contain real illuminated heart pixels.');
    assert(before.font>=15); assert(before.scroll.width<=before.scroll.clientWidth+1);
    assert(before.dialog.left>=0 && before.dialog.right<=width+1 && before.dialog.top>=0 && before.dialog.bottom<=height+1);
    assert(before.close.width>=44 && before.close.height>=44 && before.close.top>=0 && before.close.bottom<=height);
    const separated=before.canvas.bottom<=before.paper.top+1 || before.canvas.right<=before.paper.left+1;
    assert(separated,'The heart and letter must occupy separate visible areas.');
    assert(Math.abs(before.canvas.width-before.stage.width)<1 && Math.abs(before.canvas.height-before.stage.height)<1);
    const name=width===390?'letter-mobile':width===375?'letter-mobile-small':width===852?'letter-landscape':`mobile-letter-${width}`;
    await page.screenshot({path:path.join(out,`${name}.png`)});
    if(before.scroll.height>before.scroll.client+28) {
      assert(before.moreVisible);
      // Swipe the actual scroll surface, leaving the heart untouched.
      const cdp=await page.createCDPSession();
      const x=before.paper.x+before.paper.width*.35, start=before.paper.bottom-80;
      const distance=Math.min(260,before.paper.height-150);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:start,id:0}]});
      for(let i=1;i<=8;i++) {
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:start-distance*i/8,id:0}]});
        await wait(20);
      }
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      await page.waitForFunction(()=>document.getElementById('letter-paper').scrollTop>5);
      const after=await inspect(page);
      assert.equal(after.canvas.top,before.canvas.top); assert.equal(after.canvas.height,before.canvas.height);
      assert(after.brightPixels>300); assert(after.state.heart>.999);
      if(after.moreVisible) {
        await page.tap('#letter-more-button');
        await page.waitForFunction(()=>document.getElementById('letter-more-button').hidden);
      }
      await page.$eval('#wish-button',el=>el.scrollIntoView({block:'nearest'}));
      const wishBounds=await page.$eval('#wish-button',el=>el.getBoundingClientRect().toJSON());
      assert(wishBounds.top>=before.paper.top && wishBounds.bottom<=before.paper.bottom+1);
    }
    await page.tap('#letter-dialog .dialog-close');
    await page.waitForFunction(()=>!noel.getState().letterOpen && !noel.getState().letterPresentation && document.getElementById('winter-canvas').parentElement.id==='experience');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'letter-button');
    await readyLetter(page);
    assert.equal(await page.$eval('#letter-paper',el=>el.scrollTop),0);
    await page.tap('#letter-dialog .dialog-close');
    await page.waitForFunction(()=>!noel.getState().letterPresentation);
    pass(`${width}x${height}: visible heart, legible letter, swipe, close and reopen`,before);
  }

  // Rotating an already-open letter must not reload, lose text, or create a canvas.
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.goto(base,{waitUntil:'networkidle0'}); await readyLetter(page);
  await page.setViewport({width:844,height:390,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.waitForFunction(()=>noel.getState().letterOpen && document.querySelector('.letter-paper').getBoundingClientRect().left>300);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('canvas').length),1);
  await page.setViewport({width:1440,height:900,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  await page.waitForFunction(()=>noel.getState().letterOpen && !noel.getState().letterPresentation && document.getElementById('winter-canvas').parentElement.id==='experience');
  await page.screenshot({path:path.join(out,'letter-desktop.png')});
  await page.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await page.waitForFunction(()=>noel.getState().letterPresentation);
  await page.tap('#wish-button');
  await page.waitForFunction(()=>noel.getState().wishOpen && !noel.getState().letterPresentation);
  assert.equal(await page.$eval('#wish-input',el=>parseFloat(getComputedStyle(el).fontSize)),16);
  await page.type('#wish-input','시은아, 우리 행복하자.'); await page.tap('.submit-wish');
  await page.waitForFunction(()=>!noel.getState().wishOpen && noel.getState().heart>.99);
  assert.equal(await page.evaluate(()=>document.getElementById('winter-canvas').parentElement.id),'experience');
  pass('Live orientation, desktop transition, and wish handoff','The same canvas moves with the presentation; the wish dialog and normal scene recover correctly.');

  await page.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
  await page.goto(base,{waitUntil:'networkidle0'}); await readyLetter(page);
  const reduced=await inspect(page); assert(reduced.state.paused && reduced.state.heart===1);
  assert(reduced.brightPixels>300);
  await wait(180); assert.equal((await inspect(page)).state.rotation,reduced.state.rotation);
  await page.tap('#letter-dialog .dialog-close');
  await page.waitForFunction(()=>!noel.getState().letterPresentation && noel.getState().heart===0);
  assert.equal(await page.evaluate(()=>noel.getState().heart),0);
  pass('Reduced motion','The compact heart renders without animation, and closing restores the static tree.');

  assert.deepEqual(results.errors,[]);
  results.status='pass';
} catch(error) {
  results.status='fail';results.failure=error.stack;console.error(error.stack);process.exitCode=1;
} finally {
  await fs.writeFile(path.join(out,'mobile-letter-checks.json'),JSON.stringify(results,null,2));
  await browser.close();
}
