import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
 await page.goto('http://localhost:4321');await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('.kitty-smile,.kitty-nose').count(),0);
 for(const theme of ['light','dark']) {
  if(await page.locator('html').getAttribute('data-theme')!==theme) {
   await page.locator('#theme-toggle').click();
   await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-changing'));
  }
  assert.equal(await page.locator('html').getAttribute('data-theme'),theme);
  assert.equal(await page.locator('.hero-scene .loki-fur').first().evaluate(el=>getComputedStyle(el).fill),theme==='light'?'rgb(16, 17, 18)':'rgb(217, 245, 235)');
  for(let i=0;i<3;i++) {
   await page.locator(`[data-lesson-tab="${i}"]`).click();
   assert.equal(await page.locator('[data-lesson-panel]:visible').count(),1);
   assert.equal(await page.locator(`[data-lesson-panel="${i}"]`).isVisible(),true);
   const img=page.locator(`[data-lesson-panel="${i}"] .lesson-${theme}`);await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());assert.ok(await img.evaluate(img=>img.naturalWidth===900));
  }
  await page.locator('[data-lesson-tab="0"]').focus();await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('[data-lesson-tab="1"]').getAttribute('aria-selected'),'true');
  await page.locator('[data-lesson-tab="0"]').click();
  const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();assert.deepEqual(results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  for(const width of [320,375,430,768,1440]) {
   await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===375||width===1440) await page.screenshot({path:`test-results/new-loki-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 }
 await page.locator('#theme-toggle').click();await page.waitForTimeout(180);
 await page.screenshot({path:'test-results/theme-reveal.png',animations:'allow'});
 await page.waitForFunction(()=>!document.documentElement.classList.contains('theme-changing'));
 assert.equal(await page.locator('.theme-traveler').evaluate(el=>getComputedStyle(el).visibility),'hidden');
 await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#theme-toggle').click();assert.equal(await page.locator('html').getAttribute('class'),'');
 assert.deepEqual(errors,[]);console.log('PASS: logo palette, no mouth/nose, real screenshot lesson, keyboard tabs, theme sweep both directions, reduced motion, accessibility and responsive widths.');
} finally {await browser.close();}
