// Real device limits replace product caps. Run: node tests/device-limits.mjs
import assert from 'node:assert/strict';
import {
  canvasArea,
  fitsCanvas,
  isOutOfMemory,
  OUT_OF_MEMORY,
  canvasLimitMessage,
  MAX_CANVAS_SIDE,
} from '../src/scripts/device-limits.mjs';
import { friendlyError } from '../src/scripts/local-files.ts';

// Without a browser, the strictest real limit (Safari, about 16.7 MP) applies.
assert.equal(canvasArea(), 16_777_216);
assert.ok(fitsCanvas(4000, 4000));
assert.ok(!fitsCanvas(5000, 5000));
assert.ok(!fitsCanvas(MAX_CANVAS_SIDE + 1, 10));
assert.ok(!fitsCanvas(0, 10));

const setNav = (nav) =>
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true });
// Desktop Chrome with plenty of memory: up to 16384 × 16384.
setNav({ userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/130 Safari/537.36', platform: 'Win32', maxTouchPoints: 0, deviceMemory: 16 });
assert.equal(canvasArea(), 268_435_456);
assert.ok(fitsCanvas(12000, 12000));
// Low-memory Android: lower ceiling, never below the Safari limit.
setNav({ userAgent: 'Mozilla/5.0 (Linux; Android 13) Chrome/130 Mobile Safari/537.36', platform: 'Linux', maxTouchPoints: 5, deviceMemory: 2 });
assert.equal(canvasArea(), 64_000_000);
// iPhone: Safari canvas limit.
setNav({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', maxTouchPoints: 5 });
assert.equal(canvasArea(), 16_777_216);
assert.match(canvasLimitMessage(), /does not limit image size/);

// Memory failures get the honest message, not "file too large".
assert.ok(isOutOfMemory(new RangeError('Array buffer allocation failed')));
assert.ok(isOutOfMemory(new Error('Out of memory')));
assert.ok(!isOutOfMemory(new Error('This file is empty.')));
assert.equal(friendlyError(new RangeError('Invalid array length')), OUT_OF_MEMORY);
assert.equal(friendlyError(new Error('This file is empty.')), 'This file is empty.');

console.log('PASS: device limits (canvas area by browser and memory, out-of-memory messages).');
