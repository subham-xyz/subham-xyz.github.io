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

// Average border brightness; a light border means dark text on a light background.
function borderLevel(data, width, height) {
  let border = 0,
    count = 0;
  for (let x = 0; x < width; x++)
    for (const y of [0, height - 1]) {
      const i = (y * width + x) * 4,
        a = data[i + 3] / 255;
      border += ((data[i] + data[i + 1] + data[i + 2]) / 3) * a + 255 * (1 - a);
      count++;
    }
  return border / count;
}
// Brightness of the strongest ink: the 2nd percentile from the text side.
function inkLevel(gray, dark) {
  const histogram = new Uint32Array(256);
  for (const g of gray) histogram[Math.max(0, Math.min(255, Math.round(g)))]++;
  const limit = gray.length * 0.02;
  let seen = 0;
  for (let k = 0; k < 256; k++) {
    const level = dark ? k : 255 - k;
    seen += histogram[level];
    if (seen >= limit) return level;
  }
  return dark ? 0 : 255;
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
const GLYPH_GRID = { cols: 12, rows: 16, sub: 4 };
// Samples ink coverage (0–1 per pixel, antialiasing kept) into the 12 × 16 index grid.
const glyphFromBox = (coverage, width, box) => ({
  ...box,
  values: sampleGrid(coverage, width, box, GLYPH_GRID, Uint8Array, (v) =>
    Math.round(v * 255),
  ),
  aspect: box.width / box.height,
});
// Column projection segmentation. It locates visible glyph regions; it does not perform OCR.
// `sensitivity` is how far from the background towards the darkest ink a pixel must be
// to count as ink (0–1). Thin or soft strokes need a lower value; it adapts to contrast.
export function segmentGlyphs(image, sensitivity = 0.5) {
  const { width, height, data } = image;
  const background = borderLevel(data, width, height);
  const dark = background >= 128;
  const gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) gray[i] = luminance(data, i);
  const strongest = inkLevel(gray, dark);
  const threshold = background + sensitivity * (strongest - background);
  const ink = new Uint8Array(width * height),
    columns = new Uint32Array(width),
    coverage = new Float32Array(width * height);
  const range = strongest - background || 1;
  for (let i = 0; i < ink.length; i++) {
    coverage[i] = Math.max(0, Math.min(1, (gray[i] - background) / range));
    if (!(dark ? gray[i] < threshold : gray[i] > threshold)) continue;
    ink[i] = 1;
    columns[i % width]++;
  }
  const boxes = glyphBoxes(ink, columns, width, height);
  return {
    glyphs: boxes.map((box) => glyphFromBox(coverage, width, box)),
    polarity: dark
      ? 'Dark text on light background'
      : 'Light text on dark background',
    coverage,
    width,
    height,
  };
}

// Pairs typed letters with detected glyph boxes. Broken strokes can split one letter into
// several boxes, and touching letters can share one box, so a strict 1:1 pairing would shift
// every later letter. Dynamic programming finds the most plausible pairing from expected
// relative letter widths. Returns [{ char, glyph }] for letters that could be isolated.
export function alignGlyphs(prepared, letters, expectedWidth) {
  const boxes = prepared.glyphs,
    n = letters.length,
    m = boxes.length;
  if (!n || !m) return [];
  const expected = letters.map((c) => expectedWidth(c));
  const scale =
    boxes.reduce((t, b) => t + b.width, 0) /
    expected.reduce((t, e) => t + e, 0);
  const span = (j, k) => boxes[k].x + boxes[k].width - boxes[j].x;
  const miss = (w, e) => Math.abs(w - scale * e) / (scale * e);
  // Steps: [letters used, boxes used, extra cost]. 1 letter ↔ 1–3 boxes, 2 letters ↔ 1 box, or skip one.
  const steps = [
    [1, 1, 0],
    [1, 2, 0.35],
    [1, 3, 0.7],
    [2, 1, 0.45],
    [1, 0, 1.2],
    [0, 1, 1.2],
  ];
  const cost = Array.from({ length: n + 1 }, () =>
    new Float64Array(m + 1).fill(Infinity),
  );
  const from = Array.from({ length: n + 1 }, () => new Array(m + 1));
  cost[0][0] = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j <= m; j++) {
      if (cost[i][j] === Infinity) continue;
      for (const [dl, db, extra] of steps) {
        const ni = i + dl,
          nj = j + db;
        if (ni > n || nj > m) continue;
        let c = extra;
        if (dl && db) {
          const e = expected.slice(i, ni).reduce((t, v) => t + v, 0);
          c += miss(span(j, nj - 1), e);
        }
        if (cost[i][j] + c < cost[ni][nj]) {
          cost[ni][nj] = cost[i][j] + c;
          from[ni][nj] = [i, j, dl, db];
        }
      }
    }
  const pairs = [];
  for (let i = n, j = m; i || j;) {
    const [pi, pj, dl, db] = from[i][j];
    if (dl === 1 && db === 1)
      pairs.unshift({ char: letters[pi], glyph: boxes[pj] });
    if (dl === 1 && db > 1) {
      const first = boxes[pj],
        last = boxes[pj + db - 1];
      const top = Math.min(...boxes.slice(pj, pj + db).map((b) => b.y));
      const bottom = Math.max(
        ...boxes.slice(pj, pj + db).map((b) => b.y + b.height),
      );
      const merged = {
        x: first.x,
        y: top,
        width: last.x + last.width - first.x,
        height: bottom - top,
      };
      pairs.unshift({
        char: letters[pi],
        glyph: glyphFromBox(prepared.coverage, prepared.width, merged),
      });
    }
    [i, j] = [pi, pj];
  }
  return pairs;
}

// Style cues from the user's crop, used to decide which style indexes to search.
// slant: degrees of shear that makes vertical strokes sharpest (italics lean right, > 0).
// stroke: typical horizontal stroke thickness relative to the median letter height.
export function detectStyle(prepared) {
  const { coverage, width, glyphs } = prepared;
  if (!glyphs.length) return { slant: 0, stroke: 0 };
  const heights = glyphs.map((g) => g.height).sort((a, b) => a - b);
  const unit = heights[Math.floor(heights.length / 2)] || 1;
  const runs = [];
  const points = [];
  for (const g of glyphs)
    for (let y = g.y; y < g.y + g.height; y++) {
      let run = 0;
      for (let x = g.x; x <= g.x + g.width; x++) {
        const inked = x < g.x + g.width && coverage[y * width + x] >= 0.5;
        if (inked) {
          run++;
          points.push(x, y);
        } else if (run) {
          runs.push(run);
          run = 0;
        }
      }
    }
  runs.sort((a, b) => a - b);
  const stroke = (runs[Math.floor(runs.length / 2)] || 0) / unit;
  const middle =
    glyphs.reduce((t, g) => t + g.y + g.height / 2, 0) / glyphs.length;
  let best = 0,
    bestScore = -1;
  for (let angle = -6; angle <= 26; angle += 2) {
    const shear = Math.tan((angle * Math.PI) / 180);
    const columns = new Map();
    for (let i = 0; i < points.length; i += 2) {
      const x = Math.round(points[i] + (points[i + 1] - middle) * shear);
      columns.set(x, (columns.get(x) || 0) + 1);
    }
    let sharpness = 0;
    for (const c of columns.values()) sharpness += c * c;
    if (sharpness > bestScore) {
      bestScore = sharpness;
      best = angle;
    }
  }
  return { slant: best, stroke };
}
