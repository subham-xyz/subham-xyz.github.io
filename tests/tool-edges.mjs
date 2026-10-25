import {chromium} from '@playwright/test';
import sharp from 'sharp';
import assert from 'node:assert/strict';
const browser = await chromium.launch(); const context = await browser.newContext({reducedMotion:'reduce',hasTouch:true}); const page = await context.newPage();
await page.addInitScript(() => {
  const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
  window.liveURLs = new Set(); URL.createObjectURL = blob => { const url = create(blob); window.liveURLs.add(url); return url; };
  URL.revokeObjectURL = url => { window.liveURLs.delete(url); revoke(url); };
});
try {
  await page.goto('http://localhost:4321/image-converter/');
  const pixels = {create:{width:90,height:60,channels:3,background:'#cc4466'}};
  for (const format of ['gif','avif']) {
    const buffer = await sharp(pixels)[format]().toBuffer();
    await page.locator('#file-input').setInputFiles({name:`sample.${format}`,mimeType:`image/${format}`,buffer});
    await page.locator('#editor-panel').waitFor({state:'visible'});
    await page.locator('#output-format').selectOption('image/png'); await page.locator('#convert').click(); await page.locator('#result-panel').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.liveURLs.size),2);
    await page.locator('#back-settings').click(); await page.locator('#convert').click(); await page.locator('#result-panel').waitFor({state:'visible'});
    assert.equal(await page.evaluate(()=>window.liveURLs.size),2,'Previous output URL released');
    await page.locator('#result-panel [data-reset]').click(); assert.equal(await page.evaluate(()=>window.liveURLs.size),0);
  }
  // Minimal valid 2x2, 24-bit BMP, including row padding.
  const bmp = Buffer.alloc(70,255); bmp.write('BM');bmp.writeUInt32LE(70,2);bmp.writeUInt32LE(0,6);bmp.writeUInt32LE(54,10);bmp.writeUInt32LE(40,14);bmp.writeInt32LE(2,18);bmp.writeInt32LE(2,22);bmp.writeUInt16LE(1,26);bmp.writeUInt16LE(24,28);bmp.fill(0,30,54);
  await page.locator('#file-input').setInputFiles({name:'image.bmp',mimeType:'image/bmp',buffer:bmp}); await page.locator('#editor-panel').waitFor({state:'visible'});
  await page.locator('#editor-panel [data-reset]').click();
  await page.locator('#file-input').setInputFiles({name:'image.heic',mimeType:'image/heic',buffer:Buffer.from('unsupported')}); await page.locator('#error-panel').waitFor({state:'visible'}); assert.match(await page.locator('#error-message').innerText(),/Export HEIC/); assert.equal(await page.evaluate(()=>window.liveURLs.size),0);
  // Simulate a browser that silently falls back to PNG for all lossy encoders.
  await page.addInitScript(() => { const encode = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = function(callback) { encode.call(this,callback,'image/png'); }; });
  await page.reload(); await page.waitForFunction(()=>document.querySelector('option[value="image/avif"]').disabled);
  for (const mime of ['jpeg','webp','avif']) assert.equal(await page.locator(`option[value="image/${mime}"]`).isDisabled(),true);
  await page.goto('http://localhost:4321/font-finder/');
  await page.locator('#file-input').setInputFiles({name:'image.png',mimeType:'image/png',buffer:await sharp(pixels).png().toBuffer()}); await page.locator('#font-editor').waitFor({state:'visible'});
  const canvas = page.locator('#crop-canvas'), box = await canvas.boundingBox();
  await canvas.dispatchEvent('pointerdown',{pointerId:1,pointerType:'touch',clientX:box.x+10,clientY:box.y+10});
  await canvas.dispatchEvent('pointermove',{pointerId:1,pointerType:'touch',clientX:box.x+box.width*.6,clientY:box.y+box.height*.6});
  await canvas.dispatchEvent('pointerup',{pointerId:1,pointerType:'touch'});
  assert.ok(Number(await page.locator('#crop-width').inputValue())<90);
  await page.locator('#sample-text').fill('नमस्ते'); await page.locator('#find-fonts').click(); assert.match(await page.locator('#font-status').innerText(),/not supported/);
  await page.locator('#font-editor [data-font-reset]').click(); assert.equal(await page.evaluate(()=>window.liveURLs.size),0);
  console.log('PASS: native GIF/AVIF/BMP decoding, repeated-run URL cleanup, actionable HEIC error, MIME fallback capability gates, touch crop and unsupported-script guidance.');
} finally { await browser.close(); }
