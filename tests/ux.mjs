import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import sharp from 'sharp';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();
try {
 await page.goto('http://localhost:4321');
 for(const theme of ['light','dark']) {
  await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('kittysuite-theme',theme)},theme);
  await page.waitForTimeout(350);
  const face=await page.locator('.hero-mascot .kitty-face').first().evaluate(el=>getComputedStyle(el).fill);
  assert.equal(face,theme==='light'?'rgb(255, 254, 250)':'rgb(24, 39, 43)');
  await page.screenshot({path:`test-results/loki-${theme}-desktop.png`,fullPage:true,animations:'disabled'});
 }
 await page.locator('.desktop-nav a[href="/#how-it-works"]').click();
 await page.waitForTimeout(850);assert.equal(new URL(page.url()).hash,'#how-it-works');
 assert.ok(Math.abs(await page.locator('#how-it-works').evaluate(el=>el.getBoundingClientRect().top)-28)<3);
 await page.goto('http://localhost:4321');
 await page.locator('.hero-actions .button').click();
 await page.waitForURL('**/#tools');
 await page.goto('http://localhost:4321/convert-image/');
 const image=await sharp({create:{width:100,height:80,channels:4,background:'#a4d4c5'}}).png().toBuffer();
 for(const width of [320,375,768,1440]) {
  await page.setViewportSize({width,height:900});
  await page.locator('#file-input').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:image});
  await page.locator('#editor-panel').waitFor({state:'visible'});
  await page.locator('#output-format').selectOption('image/webp');
  await page.locator('#output-format').focus();
  const spacing=await page.evaluate(()=>({bottom:document.querySelector('#output-format').getBoundingClientRect().bottom,top:document.querySelector('#quality-field .side-label').getBoundingClientRect().top}));
  assert.ok(spacing.top>spacing.bottom+5,'Focus ring overlaps quality label');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.evaluate(()=>document.querySelectorAll('#converter details').forEach(d=>d.open=true));
  await page.locator('#output-name').fill('holiday / photo.png');
  await page.locator('#output-format').selectOption('image/png');
  assert.equal(await page.locator('#file-extension').innerText(),'.png');
  if(width===375) await page.screenshot({path:'test-results/rename-mobile.png',fullPage:true,animations:'disabled'});
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a11y.violations.map(v=>v.id),[]);
  await page.locator('#convert').click();await page.locator('#result-panel').waitFor({state:'visible'});
  assert.equal(await page.locator('#download').getAttribute('download'),'holiday - photo.png');
  await page.getByRole('button',{name:/Start over with a new image/}).click();
 }
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('http://localhost:4321');
 await page.locator('.hero-actions .button').click();await page.waitForURL('**/#tools');
 console.log('PASS: theme-aware Loki, smooth anchor target/focus, CTA to the toolbox and reduced-motion navigation, safe file renaming, extension handling, editor accessibility and focus spacing at four widths.');
} finally { await browser.close(); }
