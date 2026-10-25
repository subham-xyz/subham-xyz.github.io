// Luminance of pixel i (RGBA index / 4), composited over white.
function luminance(data, i) {
  const alpha = data[i * 4 + 3] / 255;
  return (
    (0.2126 * data[i * 4] +
      0.7152 * data[i * 4 + 1] +
      0.0722 * data[i * 4 + 2]) *
      alpha +
    255 * (1 - alpha)
  );
}
// Fraction of inked sub-samples in grid cell (x, y) of a box split into cols × rows.
function cellCoverage(ink, width, box, x, y, grid) {
  const { cols, rows, sub } = grid;
  let total = 0;
  for (let sy = 0; sy < sub; sy++)
    for (let sx = 0; sx < sub; sx++) {
      const py =
        box.y +
        Math.min(
          box.height - 1,
          Math.floor(((y + (sy + 0.5) / sub) * box.height) / rows),
        );
      const px =
        box.x +
        Math.min(
          box.width - 1,
          Math.floor(((x + (sx + 0.5) / sub) * box.width) / cols),
        );
      total += ink[py * width + px];
    }
  return total / (sub * sub);
}
function sampleGrid(ink, width, box, grid, ArrayType, toValue) {
  const values = new ArrayType(grid.cols * grid.rows);
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++)
      values[y * grid.cols + x] = toValue(
        cellCoverage(ink, width, box, x, y, grid),
      );
  return values;
}
// Bounding box of all inked pixels, or undefined when there are none.
function inkBounds(ink, width, height) {
  let x0 = width,
    y0 = height,
    x1 = -1,
    y1 = -1;
  for (let i = 0; i < ink.length; i++) {
    if (!ink[i]) continue;
    const x = i % width,
      y = (i - x) / width;
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return x1 < x0
    ? undefined
    : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
}
// Normalize a high-contrast text silhouette, allowing light or dark backgrounds.
export function silhouette(image) {
  const { width, height, data } = image;
  const gray = new Float32Array(width * height);
  let sum = 0,
    lo = 255,
    hi = 0;
  for (let i = 0; i < gray.length; i++) {
    const v = (gray[i] = luminance(data, i));
    sum += v;
    lo = Math.min(lo, v);
    hi = Math.max(hi, v);
  }
  if (hi - lo < 25)
    throw new Error(
      'No clear text silhouette found. Crop high-contrast text on a plain background.',
    );
  const threshold = (lo + hi) / 2,
    dark = sum / gray.length > threshold;
  const ink = gray.map((g) => ((dark ? g < threshold : g > threshold) ? 1 : 0));
  const box = inkBounds(ink, width, height);
  if (!box) throw new Error('No text found in this crop.');
  // Area sampling reduces sensitivity to source resolution and antialiasing.
  const values = sampleGrid(
    ink,
    width,
    box,
    { cols: 192, rows: 48, sub: 3 },
    Float32Array,
    (v) => v,
  );
  return { values, aspect: box.width / box.height };
}
export function score(a, b) {
  let difference = 0;
  for (let i = 0; i < a.values.length; i++)
    difference += Math.abs(a.values[i] - b.values[i]);
  return (
    difference / a.values.length +
    0.15 * Math.abs(Math.log(a.aspect / b.aspect))
  );
}

// Light border pixels mean dark text on a light background.
function darkTextOnLight(data, width, height) {
  let border = 0,
    count = 0;
  for (let x = 0; x < width; x++)
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4,
        a = data[i + 3] / 255;
      border += ((data[i] + data[i + 1] + data[i + 2]) / 3) * a + 255 * (1 - a);
      count++;
    }
  return border / count >= 128;
}
// Vertical extent of ink in columns [from, to).
function columnSpan(ink, width, height, from, to) {
  let y0 = height,
    y1 = 0;
  for (let x = from; x < to; x++)
    for (let y = 0; y < height; y++)
      if (ink[y * width + x]) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return { y: y0, height: y1 - y0 + 1 };
}
// Runs of inked columns become glyph boxes (tiny specks are ignored).
function glyphBoxes(ink, columns, width, height) {
  const boxes = [];
  let start = -1;
  for (let x = 0; x <= width; x++) {
    const inked = x < width && columns[x] > 0;
    if (inked && start < 0) start = x;
    if (inked || start < 0) continue;
    const span = columnSpan(ink, width, height, start, x);
    if ((x - start) * span.height > 3)
      boxes.push({
        x: start,
        y: span.y,
        width: x - start,
        height: span.height,
      });
    start = -1;
  }
  return boxes;
}
// Column projection segmentation. It locates visible glyph regions; it does not perform OCR.
export function segmentGlyphs(image, thresholdValue = 128) {
  const { width, height, data } = image;
  const dark = darkTextOnLight(data, width, height),
    ink = new Uint8Array(width * height),
    columns = new Uint32Array(width);
  for (let i = 0; i < ink.length; i++) {
    const g = luminance(data, i);
    if (!(dark ? g < thresholdValue : g > thresholdValue)) continue;
    ink[i] = 1;
    columns[i % width]++;
  }
  const grid = { cols: 12, rows: 16, sub: 4 };
  const glyphs = glyphBoxes(ink, columns, width, height).map((box) => ({
    ...box,
    values: sampleGrid(ink, width, box, grid, Uint8Array, (v) =>
      Math.round(v * 255),
    ),
    aspect: box.width / box.height,
  }));
  return {
    glyphs,
    polarity: dark
      ? 'Dark text on light background'
      : 'Light text on dark background',
  };
}
