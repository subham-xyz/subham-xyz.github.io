import {chromium} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser = await chromium.launch({headless:true});
const context = await browser.newContext({reducedMotion:'reduce',bypassCSP:true}); const page = await context.newPage();
const errors = []; page.on('pageerror', e => errors.push(e.message));
const base = 'http://localhost:4321';
const image = await sharp({create:{width:240,height:160,channels:4,background:{r:20,g:100,b:200,alpha:.5}}}).png().toBuffer();
const upload = async (buffer = image, name = 'sample.png', mimeType = 'image/png') => page.locator('#file-input').setInputFiles({name,mimeType,buffer});
const openAll = async () => { await page.evaluate(()=>document.querySelectorAll('#converter details').forEach(d=>d.open=true)); const custom = page.locator('label.chip:has(input[value=custom])'); if (await custom.count() && await custom.isVisible()) await custom.click(); };
const process = async () => { await page.locator('#convert').click(); await page.locator('#result-panel').waitFor({state:'visible'}); };
const info = () => page.locator('#download').evaluate(async link => {
  const blob = await (await fetch(link.href)).blob(); const bitmap = await createImageBitmap(blob);
  const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height; const ctx = c.getContext('2d'); ctx.drawImage(bitmap,0,0);
  const pixel = [...ctx.getImageData(0,0,1,1).data]; const result = {width:bitmap.width,height:bitmap.height,type:blob.type,size:blob.size,pixel}; bitmap.close(); return result;
});
try {
  for (const tool of ['image-converter','image-compressor','image-resizer','font-finder']) {
    await page.goto(`${base}/${tool}/`);
    assert.equal(await page.locator('h1').count(),1);
    assert.ok((await page.locator('link[rel=canonical]').getAttribute('href')).endsWith(`/${tool}/`));
    const resources = await page.evaluate(() => performance.getEntriesByType('resource').map(r=>r.name));
    assert.ok(!resources.some(url=>url.includes('/fonts/')), 'Font collection must remain lazy');
    for (const theme of ['light','dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme=theme,theme);
      for (const width of [320,375,1440]) {
        await page.setViewportSize({width,height:950});
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth), `${tool} overflow`);
      }
      const a11y = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      assert.deepEqual(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${tool} ${theme}`);
    }
    await upload(); await page.locator(tool === 'font-finder' ? '#font-editor' : '#editor-panel').waitFor({state:'visible'}); if (tool !== 'font-finder') await openAll();
    await page.setViewportSize({width:375,height:900});
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth));
    const a11y = await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    assert.deepEqual(a11y.violations.map(v=>v.id),[],tool+' editor');
    await page.screenshot({path:`test-results/${tool}-editor.png`,fullPage:true});
    if (tool === 'font-finder') continue;
    if (tool === 'image-resizer') { await page.locator('label.chip:has(input[value=percent])').click(); await page.locator('#percent').fill('50'); }
    await page.locator('#output-format').selectOption('image/png'); await process();
    const result = await info(); assert.equal(result.type,'image/png'); assert.equal(result.width,tool === 'image-resizer'?120:240); assert.ok(result.pixel[3]<255,'PNG transparency');
    const event = page.waitForEvent('download'); await page.locator('#download').click(); const download = await event;
    assert.equal((await sharp(await readFile(await download.path())).metadata()).width,result.width);
    await page.locator('#back-settings').click(); await openAll();
    if (tool === 'image-converter') {
      await page.locator('#output-format').selectOption('image/jpeg'); await page.locator('#background').fill('#ff0000'); await process();
      const jpg = await info(); assert.equal(jpg.type,'image/jpeg'); assert.equal(jpg.pixel[3],255); assert.ok(jpg.pixel[0]>100);
    } else {
      await page.locator('#application').selectOption('signature'); await page.locator('#fit').selectOption('pad');
      await page.locator('#minimum').fill('0'); await page.locator('#maximum').fill('0.01'); await process();
      const fixed = await info(); assert.equal(fixed.width,300); assert.equal(fixed.height,100); assert.match(await page.locator('#constraint-results').innerText(),/unreachable/);
      await page.locator('#back-settings').click(); await openAll(); await page.locator('#maximum').fill('0'); await page.locator('#minimum').fill('1000'); await process();
      assert.match(await page.locator('#constraint-results').innerText(),/Below minimum/);
      await page.locator('#back-settings').click(); await openAll(); await page.locator('#minimum').fill('0'); await page.locator('#maximum').fill('100'); await process();
      assert.match(await page.locator('#constraint-results').innerText(),/Meets requirement/);
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('#result-panel .result-kitty .kitty-body').evaluate(el=>getComputedStyle(el).animationName),'none');
    assert.equal(await page.locator('#result-panel .result-kitty [data-kitty]').getAttribute('data-state'),'success');
  }
  // Real noisy encoded bytes exercise quality search and PNG dimension refinement.
  await page.goto(base+'/image-compressor/');
  const noisy = Buffer.from(await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width=640; canvas.height=480;
    const ctx=canvas.getContext('2d'), pixels=ctx.createImageData(640,480);
    let seed=12345;
    for(let i=0;i<pixels.data.length;i+=4) {
      for(let channel=0;channel<3;channel++) { seed=(Math.imul(seed,1664525)+1013904223)>>>0; pixels.data[i+channel]=seed>>>24; }
      pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    return [...new Uint8Array(await (await new Promise(resolve=>canvas.toBlob(resolve))).arrayBuffer())];
  }));
  await upload(noisy); await page.locator('#editor-panel').waitFor({state:'visible'}); await openAll();
  await page.locator('#output-format').selectOption('image/jpeg');
  await page.locator('#maximum').fill('80'); await process();
  let measured=await info(); assert.ok(measured.size<=80*1024 && measured.size>60*1024); assert.equal(measured.width,640);
  await page.locator('#back-settings').click(); await openAll(); await page.locator('#output-format').selectOption('image/png');
  await page.locator('#downscale').check(); await process(); measured=await info();
  assert.ok(measured.size<=80*1024 && measured.size>60*1024); assert.ok(measured.width<640);
  assert.match(await page.locator('#constraint-results').innerText(),/Meets requirement/);
  // Solid background is explicit even for transparency-capable formats.
  await page.goto(base+'/image-converter/'); await upload(); await page.locator('#editor-panel').waitFor({state:'visible'}); await openAll();
  await page.locator('#output-format').selectOption('image/png'); await page.locator('#transparent-background').uncheck(); await process();
  assert.equal((await info()).pixel[3],255);
  // Render known font fixtures, then rank through the actual crop/worker workflow.
  await page.goto(base+'/font-finder/');
  for (const [family,id] of [['Lato','lato'],['Oswald','oswald'],['Inconsolata','inconsolata']]) {
    const buffer = Buffer.from(await page.evaluate(async ({family,id}) => {
      const font = new FontFace(family,`url(/fonts/${id}.ttf)`); await font.load(); document.fonts.add(font);
      const canvas=document.createElement('canvas'); canvas.width=1000;canvas.height=160; const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,160);ctx.fillStyle='black';ctx.font=`80px "${family}"`;ctx.fillText('Hamburgefonts',12,120);
      return [...new Uint8Array(await (await new Promise(r=>canvas.toBlob(r))).arrayBuffer())];
    },{family,id}));
    await upload(buffer); await page.locator('#font-editor').waitFor({state:'visible'});
    await page.locator('#crop-x').focus(); await page.keyboard.press('ArrowUp'); assert.equal(await page.locator('#crop-x').inputValue(),'1'); await page.locator('#crop-reset').click();
    await page.locator('#sample-text').fill('Hamburgefonts'); await page.locator('#find-fonts').click(); await page.locator('#font-results').waitFor({state:'visible',timeout:60000});
    assert.match(await page.locator('.font-match h3').first().innerText(),new RegExp(family));
    assert.equal(await page.locator('.font-match').count(),6);
    assert.equal(await page.locator('#font-results [data-kitty]').getAttribute('data-state'),'success');
    await page.screenshot({path:`test-results/font-${id}-results.png`,fullPage:true});
    await page.locator('#font-results [data-font-reset]').click();
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: four routes, lazy assets, themes, responsive layouts, accessibility, real downloads, PNG transparency, JPEG backgrounds, resizing, all constraint outcomes, keyboard crop and three actual font-ranking fixtures.');
} finally { await browser.close(); }

