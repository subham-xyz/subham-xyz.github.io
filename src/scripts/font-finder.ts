import { checkDimensions, size } from './image-core.mjs';
import { segmentGlyphs } from './font-score.mjs';
import { showPanel, setKittyState } from './tool-state';
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const workspace = get('font-finder'),
  input = get<HTMLInputElement>('file-input');
const canvas = get<HTMLCanvasElement>('crop-canvas'),
  ctx = canvas.getContext('2d')!;
const source = new Image();
let cancelComparison: (() => void) | undefined;
const previewFaces: FontFace[] = [];
let sourceURL = '',
  cropURL = '',
  worker: Worker | undefined,
  job = 0,
  phase = 'upload';
const keys = ['x', 'y', 'width', 'height'] as const;
const field = (key: string) => get<HTMLInputElement>('crop-' + key);
function status(text: string) {
  get('font-status').textContent = text;
}
function show(next: string, text: string) {
  phase = next;
  showPanel(
    workspace,
    next === 'upload' ? 'upload-panel' : 'font-' + next,
    next === 'results' ? 'result' : next,
  );
  status(text);
}
function release() {
  job++;
  cancelComparison?.();
  cancelComparison = undefined;
  worker?.terminate();
  worker = undefined;
  anchor = undefined;
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  if (cropURL) URL.revokeObjectURL(cropURL);
  sourceURL = cropURL = '';
  source.removeAttribute('src');
  get('crop-preview').removeAttribute('src');
  canvas.width = canvas.height = 0;
  get('font-matches').replaceChildren();
  get('glyph-controls').replaceChildren();
  for (const face of previewFaces) document.fonts.delete(face);
  previewFaces.length = 0;
}
function reset() {
  release();
  input.value = '';
  show('upload', 'Choose an image.');
  input.focus();
}
workspace
  .querySelectorAll('[data-font-reset]')
  .forEach((button) => button.addEventListener('click', reset));
function crop() {
  const values = keys.map((key) => Number(field(key).value));
  if (values.some((v, i) => !Number.isInteger(v) || v < (i < 2 ? 0 : 1)))
    throw new Error(
      'Enter whole pixel crop coordinates and positive dimensions.',
    );
  const [x, y, width, height] = values;
  if (x + width > source.naturalWidth || y + height > source.naturalHeight)
    throw new Error('The crop must stay inside the image.');
  return { x, y, width, height };
}
function paint() {
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  try {
    const c = crop(),
      sx = canvas.width / source.naturalWidth,
      sy = canvas.height / source.naturalHeight;
    ctx.fillStyle = '#0007';
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.rect(c.x * sx, c.y * sy, c.width * sx, c.height * sy);
    ctx.fill('evenodd');
    ctx.strokeStyle = '#007c70';
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x * sx, c.y * sy, c.width * sx, c.height * sy);
  } catch {}
}
function whole() {
  field('x').value = field('y').value = '0';
  field('width').value = String(source.naturalWidth);
  field('height').value = String(source.naturalHeight);
  paint();
}
get('crop-reset').addEventListener('click', whole);
keys.forEach((key) => field(key).addEventListener('input', paint));
function checkFontImage(files: FileList | File[]) {
  if (files.length !== 1) throw new Error('Choose one image at a time.');
  const file = files[0];
  if (
    !/\.(png|jpe?g|webp|gif)$/i.test(file.name) ||
    !file.size ||
    file.size > 8 * 1048576
  )
    throw new Error('Choose a PNG, JPG, WebP or GIF up to 8 MB.');
  return file;
}
function fitCanvas() {
  const scale = Math.min(
    1,
    1000 / source.naturalWidth,
    800 / source.naturalHeight,
  );
  canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
}
const imageError = (error: unknown) =>
  error instanceof Error && error.name !== 'EncodingError'
    ? error.message
    : 'This image is damaged or unsupported. Try another JPG, PNG or WebP.';
async function select(files: FileList | File[]) {
  if (phase === 'processing') return;
  release();
  const current = job;
  try {
    const file = checkFontImage(files);
    show('processing', 'Reading image locally.');
    sourceURL = URL.createObjectURL(file);
    source.src = sourceURL;
    await source.decode();
    if (current !== job) return;
    checkDimensions(source.naturalWidth, source.naturalHeight);
    fitCanvas();
    whole();
    get('font-file').textContent =
      `${file.name} · ${size(file.size)} · ${source.naturalWidth} × ${source.naturalHeight} px`;
    get<HTMLInputElement>('sample-text').value = '';
    show('editor', 'Crop a line and type its words.');
    field('x').focus();
  } catch (error) {
    if (current !== job) return;
    release();
    show('error', 'Could not read image.');
    get('font-error-message').textContent = imageError(error);
  }
}
input.addEventListener('change', () => {
  if (input.files?.length) void select(input.files);
});
for (const event of ['dragenter', 'dragover'])
  document.addEventListener(event, (e) => {
    const drag = e as DragEvent;
    if (!drag.dataTransfer?.types.includes('Files')) return;
    e.preventDefault();
    if (phase === 'upload') {
      get('dropzone').classList.add('dragging');
      setKittyState(workspace, 'upload');
    }
  });
document.addEventListener('dragleave', () => {
  get('dropzone').classList.remove('dragging');
  if (phase === 'upload') setKittyState(workspace, 'idle');
});
document.addEventListener('drop', (e) => {
  if (!e.dataTransfer?.types.includes('Files')) return;
  e.preventDefault();
  get('dropzone').classList.remove('dragging');
  if (e.dataTransfer.files.length) void select(e.dataTransfer.files);
});
let anchor: { x: number; y: number } | undefined;
function point(event: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(
        source.naturalWidth - 1,
        Math.round(
          ((event.clientX - rect.left) / rect.width) * source.naturalWidth,
        ),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        source.naturalHeight - 1,
        Math.round(
          ((event.clientY - rect.top) / rect.height) * source.naturalHeight,
        ),
      ),
    ),
  };
}
canvas.addEventListener('pointerdown', (event) => {
  anchor = point(event);
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (!anchor) return;
  const end = point(event);
  field('x').value = String(Math.min(anchor.x, end.x));
  field('y').value = String(Math.min(anchor.y, end.y));
  field('width').value = String(Math.max(1, Math.abs(anchor.x - end.x)));
  field('height').value = String(Math.max(1, Math.abs(anchor.y - end.y)));
  paint();
});
for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
  canvas.addEventListener(name, () => {
    anchor = undefined;
  });
get('font-back').addEventListener('click', () => {
  show('editor', 'Adjust crop or text.');
  get('sample-text').focus();
});
// Ink sensitivity slider: percent of the way from background to the strongest ink.
const sensitivity = () =>
  Number(get<HTMLInputElement>('glyph-threshold').value) / 100;
function checkSample(text: string) {
  const ok =
    text && text.length <= 60 && /^[ -~]+$/.test(text) && /[A-Za-z]/.test(text);
  if (!ok)
    throw new Error(
      'Type a single line of basic Latin words exactly as shown (up to 60 characters). Other scripts are not supported.',
    );
}
// The crop scaled to at most 1600 × 400, plus its pixels for the worker.
function cropCanvas() {
  const c = crop();
  const cropped = document.createElement('canvas');
  const scale = Math.min(1, 1600 / c.width, 400 / c.height);
  cropped.width = Math.max(1, Math.round(c.width * scale));
  cropped.height = Math.max(1, Math.round(c.height * scale));
  const context = cropped.getContext('2d')!;
  context.drawImage(
    source,
    c.x,
    c.y,
    c.width,
    c.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );
  return {
    cropped,
    image: context.getImageData(0, 0, cropped.width, cropped.height),
  };
}
async function showCropPreview(cropped: HTMLCanvasElement) {
  const blob = await new Promise<Blob | null>((resolve) =>
    cropped.toBlob(resolve),
  );
  if (cropURL) URL.revokeObjectURL(cropURL);
  if (!blob) return;
  cropURL = URL.createObjectURL(blob);
  get<HTMLImageElement>('crop-preview').src = cropURL;
}
function compareInWorker(text: string, image: ImageData): Promise<any[]> {
  worker ||= new Worker(new URL('./font-worker.ts', import.meta.url), {
    type: 'module',
  });
  return new Promise((resolve, reject) => {
    const stop = (error?: Error) => {
      clearTimeout(timer);
      cancelComparison = undefined;
      if (error) reject(error);
    };
    const drop = () => {
      worker?.terminate();
      worker = undefined;
    };
    cancelComparison = () => stop(new Error('Comparison cancelled.'));
    const timer = window.setTimeout(() => {
      drop();
      reject(new Error('Comparison timed out. Try a smaller, clearer crop.'));
    }, 120000);
    worker!.onmessage = (event) => {
      if (event.data.progress) return void status(event.data.progress);
      stop(event.data.error ? new Error(event.data.error) : undefined);
      if (!event.data.error) resolve(event.data.results);
    };
    worker!.onerror = () => {
      drop();
      stop(new Error('Font comparison could not start. Try another browser.'));
    };
    worker!.postMessage({ text, image, sensitivity: sensitivity() }, [
      image.data.buffer,
    ]);
  });
}
// Loads each match as a preview font; false if a newer job started meanwhile.
async function loadPreviewFaces(results: any[], current: number) {
  for (const face of previewFaces) document.fonts.delete(face);
  previewFaces.length = 0;
  for (const font of results) {
    // Real bold/italic files are declared as such so the browser does not fake them again.
    const face = new FontFace('KittyMatch-' + font.id, `url(${font.url})`, {
      weight: font.style === 'bold' ? String(font.weight) : 'normal',
      style: font.style === 'italic' ? 'italic' : 'normal',
    });
    await face.load();
    if (current !== job) return false;
    document.fonts.add(face);
    previewFaces.push(face);
  }
  return true;
}
function copyButton(
  label: string,
  value: string,
  copied: string,
  fallback: string,
) {
  const button = document.createElement('button');
  button.className = 'text-link';
  button.textContent = label;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(value);
      status(copied);
    } catch {
      status(fallback);
    }
  });
  return button;
}
const link = (href: string, text: string) =>
  Object.assign(document.createElement('a'), { href, textContent: text });
const level = (n: number) =>
  n < 0.12 ? 'Close' : n < 0.3 ? 'Moderate' : 'Loose';
function matchCard(font: any, index: number, text: string) {
  const card = document.createElement('article');
  card.className = 'font-match';
  const title = document.createElement('h3');
  title.textContent = `${index === 0 ? 'Closest in collection' : `Similarity rank ${index + 1}`} · ${font.name}`;
  const preview = document.createElement('p');
  preview.textContent = text;
  preview.style.fontFamily = `"KittyMatch-${font.id}"`;
  preview.style.fontWeight = String(font.weight);
  if (font.style === 'italic') preview.style.fontStyle = 'italic';
  preview.dataset.liveFont = 'true';
  const family = font.name.replace(/ (Bold|Italic)$/, '');
  const css = `font-family: "${family}", sans-serif; font-weight: ${font.weight};${font.style === 'italic' ? ' font-style: italic;' : ''}`;
  const evidence = document.createElement('p');
  evidence.className = 'field-hint';
  evidence.textContent = `Overall: ${level(font.score)} · Glyph shape: ${level(font.glyphScore)} · Proportions: ${level(font.proportion)} · Spacing: ${level(font.spacing)}. These are similarities, not confidence.`;
  card.append(
    title,
    preview,
    evidence,
    copyButton(
      'Copy name',
      family,
      `Copied ${family}.`,
      `Copy unavailable. Select this name: ${family}`,
    ),
    copyButton(
      'Copy CSS',
      css,
      'Copied CSS. Install or load the font separately.',
      css,
    ),
    link(font.source, 'Font source'),
    link(font.license, 'SIL Open Font License'),
  );
  return card;
}
get('find-fonts').addEventListener('click', async () => {
  if (phase !== 'editor') return;
  let cropped: HTMLCanvasElement | undefined;
  const current = job;
  try {
    const text = get<HTMLInputElement>('sample-text').value.trim();
    checkSample(text);
    const prepared = cropCanvas();
    cropped = prepared.cropped;
    show('processing', 'Preparing your crop locally.');
    await showCropPreview(cropped);
    if (current !== job) return;
    show(
      'processing',
      'Loading the self-hosted index and comparing glyph shapes.',
    );
    const results = await compareInWorker(text, prepared.image);
    if (current !== job || !(await loadPreviewFaces(results, current))) return;
    get('font-matches').replaceChildren(
      ...results.map((font, index) => matchCard(font, index, text)),
    );
    show('results', 'Font suggestions ready.');
    get('font-results-title').focus();
    get<HTMLInputElement>('live-preview-text').value = text;
  } catch (error) {
    if (current !== job) return;
    show('editor', (error as Error).message);
    get('sample-text').focus();
  } finally {
    if (cropped) cropped.width = cropped.height = 0;
  }
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) release();
});

document.addEventListener('paste', (event) => {
  const files = [...(event.clipboardData?.files || [])];
  if (files.length) {
    event.preventDefault();
    void select(files);
  }
});
get('font-example').addEventListener('click', async () => {
  const c = document.createElement('canvas');
  c.width = 850;
  c.height = 160;
  const context = c.getContext('2d')!;
  const face = new FontFace('KittyExample', 'url(/fonts/inconsolata.ttf)');
  await face.load();
  document.fonts.add(face);
  context.fillStyle = 'white';
  context.fillRect(0, 0, c.width, c.height);
  context.fillStyle = 'black';
  context.font = '80px KittyExample';
  context.fillText('Hamburgefonts', 12, 120);
  const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve));
  c.width = c.height = 0;
  document.fonts.delete(face);
  if (blob) {
    await select([new File([blob], 'example.png', { type: 'image/png' })]);
    get<HTMLInputElement>('sample-text').value = 'Hamburgefonts';
  }
});
function prepareGlyphs() {
  try {
    const r = crop(),
      c = document.createElement('canvas');
    c.width = r.width;
    c.height = r.height;
    const context = c.getContext('2d')!;
    context.drawImage(
      source,
      r.x,
      r.y,
      r.width,
      r.height,
      0,
      0,
      r.width,
      r.height,
    );
    const prepared = segmentGlyphs(
      context.getImageData(0, 0, c.width, c.height),
      sensitivity(),
    );
    const text = get<HTMLInputElement>('sample-text').value,
      positions = [...text]
        .map((char, index) => ({ char, index }))
        .filter((item) => !/\s/.test(item.char));
    get('glyph-controls').replaceChildren(
      ...prepared.glyphs.slice(0, 60).map((glyph: any, i: number) => {
        const label = document.createElement('label');
        label.textContent = `Glyph ${i + 1}`;
        const sample = document.createElement('canvas');
        sample.width = 48;
        sample.height = 60;
        sample
          .getContext('2d')!
          .drawImage(
            c,
            glyph.x,
            glyph.y,
            glyph.width,
            glyph.height,
            0,
            0,
            48,
            60,
          );
        sample.setAttribute('aria-label', `Detected glyph ${i + 1}`);
        const input = document.createElement('input');
        input.maxLength = 1;
        input.value = positions[i]?.char || '';
        input.addEventListener('input', () => {
          const current = [...get<HTMLInputElement>('sample-text').value];
          if (positions[i]) current[positions[i].index] = input.value || '?';
          else current.push(input.value);
          get<HTMLInputElement>('sample-text').value = current.join('');
        });
        label.append(sample, input);
        return label;
      }),
    );
    c.width = c.height = 0;
    status(
      `${prepared.polarity}. ${prepared.glyphs.length} glyph regions detected. ${prepared.glyphs.length !== positions.length ? 'Count differs from typed text; adjust the crop or threshold. Joined lettering can remain inseparable.' : 'Check each character before comparing.'}`,
    );
  } catch (error) {
    status((error as Error).message);
  }
}
get('prepare-glyphs').addEventListener('click', prepareGlyphs);
get('live-preview-text').addEventListener('input', () => {
  document
    .querySelectorAll('[data-live-font]')
    .forEach(
      (el) =>
        (el.textContent = get<HTMLInputElement>('live-preview-text').value),
    );
});
