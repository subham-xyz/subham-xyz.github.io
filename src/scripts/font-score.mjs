// Normalize a high-contrast text silhouette, allowing light or dark backgrounds.
export function silhouette(image) {
  const { width, height, data } = image;
  const gray = new Float32Array(width * height);
  let sum = 0, lo = 255, hi = 0;
  for (let i = 0; i < gray.length; i++) {
    const alpha = data[i * 4 + 3] / 255;
    const v = (.2126 * data[i * 4] + .7152 * data[i * 4 + 1] + .0722 * data[i * 4 + 2]) * alpha + 255 * (1 - alpha);
    gray[i] = v; sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  if (hi - lo < 25) throw new Error('No clear text silhouette found. Crop high-contrast text on a plain background.');
  const threshold = (lo + hi) / 2, dark = sum / gray.length > threshold;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  const ink = new Uint8Array(gray.length);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = y * width + x;
    if (dark ? gray[i] < threshold : gray[i] > threshold) { ink[i] = 1; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  if (x1 < x0 || y1 < y0) throw new Error('No text found in this crop.');
  const w = x1 - x0 + 1, h = y1 - y0 + 1, values = new Float32Array(192 * 48);
  // Area sampling reduces sensitivity to source resolution and antialiasing.
  for (let y = 0; y < 48; y++) for (let x = 0; x < 192; x++) {
    let total = 0;
    for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++) total += ink[(y0 + Math.min(h - 1, Math.floor((y + (sy + .5) / 3) * h / 48))) * width + x0 + Math.min(w - 1, Math.floor((x + (sx + .5) / 3) * w / 192))];
    values[y * 192 + x] = total / 9;
  }
  return { values, aspect: w / h };
}
export function score(a, b) {
  let difference = 0;
  for (let i = 0; i < a.values.length; i++) difference += Math.abs(a.values[i] - b.values[i]);
  return difference / a.values.length + .15 * Math.abs(Math.log(a.aspect / b.aspect));
}
