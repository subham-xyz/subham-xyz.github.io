import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  bypassCSP: true,
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const base = "http://localhost:4321";
try {
  await page.goto(base);
  await page.evaluate(() => document.fonts.ready);
  assert.equal(
    (await page.locator("h1").innerText()).replace(/\s+/g, " "),
    "Free online image and PDF tools",
  );
  await page.waitForTimeout(650);
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem("kittysuite-theme", theme);
    }, theme);
    for (const route of ["/", "/convert-image/"]) {
      await page.goto(base + route);
      await page.waitForTimeout(650);
      const accessibility = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze();
      assert.deepEqual(
        accessibility.violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => n.target),
        })),
        [],
        `Accessibility: ${route} ${theme}`,
      );
      for (const width of [320, 375, 430, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          `Overflow ${route} ${width} ${theme}`,
        );
        if (width === 375)
          await page.screenshot({
            path: `test-results/${route === "/" ? "home" : "tool"}-${theme}-mobile.png`,
            fullPage: true,
            animations: "disabled",
          });
      }
    }
  }
  await page.setViewportSize({ width: 375, height: 850 });
  await page.goto(base);
  await page.getByRole("button", { name: "Open navigation" }).click();
  assert.equal(
    await page.locator("#menu-toggle").getAttribute("aria-expanded"),
    "true",
  );
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#mobile-nav").isVisible(), false);
  await page.getByRole("button", { name: /Switch to light/ }).click();
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-theme"), "light");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.equal(
    await page
      .locator(".kitty-body").first()
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(base + "/convert-image/");
  const png = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 4,
      background: { r: 24, g: 130, b: 140, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  for (const mime of ["image/jpeg", "image/png", "image/webp"]) {
    await page
      .locator("#file-input")
      .setInputFiles({
        name: "sample.png",
        mimeType: "image/png",
        buffer: png,
      });
    await page.locator("#editor-panel").waitFor({ state: "visible" });
    await page.locator("#output-format").selectOption(mime);
    await page.evaluate(() => document.querySelectorAll("#converter details").forEach((d) => (d.open = true)));
    await page.locator("#output-name").fill("my-renamed-image");
    await page.locator("#convert").click();
    await page.locator("#result-panel").waitFor({ state: "visible" });
    const info = await page.locator("#download").evaluate(async (link) => {
      const b = await (await fetch(link.href)).blob();
      const img = await createImageBitmap(b);
      return {
        type: b.type,
        width: img.width,
        height: img.height,
        size: b.size,
      };
    });
    assert.equal(info.type, mime);
    assert.equal(info.width, 120);
    assert.equal(info.height, 80);
    assert.ok(info.size > 0);
    const downloadEvent = page.waitForEvent("download");
    await page.locator("#download").click();
    const download = await downloadEvent;
    assert.ok(download.suggestedFilename().startsWith("my-renamed-image."));
    await page.screenshot({
      path: `test-results/result-${mime.split("/")[1]}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: /Start over with a new image/ }).click();
  }
  for (const file of [
    { name: "bad.png", mimeType: "image/png", buffer: Buffer.from("invalid") },
    { name: "file.txt", mimeType: "text/plain", buffer: Buffer.from("test") },
    {
      name: "large.png",
      mimeType: "image/png",
      buffer: Buffer.alloc(21 * 1024 * 1024),
    },
  ]) {
    await page.locator("#file-input").setInputFiles(file);
    await page.locator("#error-panel").waitFor({ state: "visible" });
    assert.ok((await page.locator("#error-message").innerText()).length > 15);
    await page.getByRole("button", { name: "Try another image" }).click();
  }
  await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 40;
    canvas.height = 40;
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "drop.png", { type: "image/png" }));
    document.dispatchEvent(
      new DragEvent("dragenter", { dataTransfer: transfer, bubbles: true }),
    );
    document.dispatchEvent(
      new DragEvent("drop", { dataTransfer: transfer, bubbles: true }),
    );
  });
  await page.locator("#editor-panel").waitFor({ state: "visible" });
  assert.equal(await page.locator("#file-name").innerText(), "drop.png");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: 20 responsive/theme combinations, WCAG checks, menu, theme persistence, reduced motion, all three real formats/downloads, invalid/corrupt/oversized files, and drag/drop.",
  );
} finally {
  await browser.close();
}
