import { chromium } from '@playwright/test';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
await mkdir('public/guide',{recursive:true});
const sample = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#d9f5eb"/><circle cx="440" cy="105" r="46" fill="#fff3cc"/><path d="M0 300Q130 100 310 290T600 240V400H0Z" fill="#6cc7bd"/><path d="M0 350Q200 230 350 320T600 280V400H0Z" fill="#187b83"/></svg>`)).png().toBuffer();
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1100,height:1100},reducedMotion:'reduce'});
 await page.goto('http://localhost:4321/convert-image/');
 for(const theme of ['light','dark']) {
  await page.evaluate(theme=>{localStorage.setItem('kittysuite-theme',theme)},theme);
  await page.reload();await page.evaluate(()=>document.fonts.ready);
  async function capture(name) {
   await page.locator('#theme-toggle').focus();
   const png=await page.locator('#converter').screenshot({animations:'disabled'});
   await sharp(png).resize(900,650,{fit:'contain',background:theme==='light'?'#e9eee5':'#152327'}).webp({quality:85}).toFile(`public/guide/${name}-${theme}.webp`);
  }
  await capture('select');
  await page.locator('#file-input').setInputFiles({name:'little-landscape.png',mimeType:'image/png',buffer:sample});
  await page.locator('#editor-panel').waitFor({state:'visible'});
  await page.locator('#output-name').fill('little-landscape');await capture('convert');
  await page.locator('#convert').click();await page.locator('#result-panel').waitFor({state:'visible'});
  await page.locator('#output-preview').evaluate(img=>img.decode());await capture('download');
 }
 console.log('Captured six optimized screenshots from the working converter.');
} finally {await browser.close();}
