import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const overlap=(a,b)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;
try {
 await page.goto('http://localhost:4321');await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.theme-traveler,.loki-toes,.kitty-shadow,.guardian-branches').count(),0);
 assert.equal(await page.locator('.how-card').count(),3);
 for(const theme of ['light','dark']) {
  if(await page.locator('html').getAttribute('data-theme')!==theme) {
   await page.locator('#theme-toggle').click();await page.waitForTimeout(120);
   await page.screenshot({path:`test-results/circular-${theme}.png`,animations:'allow'});
   await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-changing'));
  }
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  for(const width of [320,375,430,768,1440]) {
   await page.setViewportSize({width,height:1000});await page.waitForTimeout(100);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const mascot=await page.locator('.hero-mascot').boundingBox();const title=await page.locator('#hero-title').boundingBox();assert.ok(!overlap(mascot,title),`Loki overlaps the headline ${width}`);
   const grid=await page.locator('#popular .tool-grid').boundingBox();if(width>=768)assert.ok(grid.y<1000*1.25,`Popular tools start too low at ${width}: ${grid.y}`);
   if(width===375||width===1440) { for(const img of await page.locator('.how-card img:visible').all()) { await img.scrollIntoViewIfNeeded(); await img.evaluate(img=>img.decode()); } }
   if(width===375||width===1440) await page.screenshot({path:`test-results/comfy-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  const a11y=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(a11y.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
  await page.locator('[data-goal=dimensions]').click();assert.match(await page.locator('[data-goal-panel]:not([hidden]) .rec-card:first-child').innerText(),/Resize/);await page.locator('[data-goal=smaller]').click();assert.match(await page.locator('[data-goal-panel]:not([hidden]) .rec-card:first-child').innerText(),/Compress/);
  const height=await page.locator('#how-it-works').evaluate(el=>el.getBoundingClientRect().height);assert.ok(height<730,`Walkthrough too tall: ${height}`);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 }
 const pet=page.locator('.hero-mascot .kitty-pet');await pet.hover({position:{x:8,y:30}});await page.waitForTimeout(450);
 assert.equal(await page.locator('.hero-mascot .kitty-pupil').count(),2);
 await page.mouse.move(0,0);await page.waitForTimeout(450);assert.equal(await page.locator('.hero-mascot .kitty').evaluate(el=>el.style.getPropertyValue('--head-tilt')),'0deg');
 assert.equal(await page.locator('.hero-mascot').evaluate(el=>getComputedStyle(el,'::before').content),'none');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('class'),'');
 await page.locator('#popular .section-row .text-link').click();await page.waitForURL('**/tools/');
 assert.deepEqual(errors,[]);console.log('PASS: goal-driven guidance, circular themes without cat, readable colors, no hero overlaps at five widths, smooth hover reset, CTA to the toolbox, reduced motion and accessibility.');
} finally {await browser.close();}
