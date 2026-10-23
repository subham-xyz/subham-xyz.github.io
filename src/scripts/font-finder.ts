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
async function select(files: FileList | File[]) {
  if (phase === 'processing') return;
  release();
  const current = job;
  try {
    if (files.length !== 1) throw new Error('Choose one image at a time.');
    if (
      !/\.(png|jpe?g|webp|gif)$/i.test(files[0].name) ||
      !files[0].size ||
      files[0].size > 8 * 1048576
    )
      throw new Error('Choose a PNG, JPG, WebP or GIF up to 8 MB.');
    show('processing', 'Reading image locally.');
    sourceURL = URL.createObjectURL(files[0]);
    source.src = sourceURL;
    await source.decode();
    if (current !== job) return;
    checkDimensions(source.naturalWidth, source.naturalHeight);
    const scale = Math.min(
      1,
      1000 / source.naturalWidth,
      800 / source.naturalHeight,
    );
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    whole();
    get('font-file').textContent =
      `${files[0].name} · ${size(files[0].size)} · ${source.naturalWidth} × ${source.naturalHeight} px`;
    get<HTMLInputElement>('sample-text').value = '';
    show('editor', 'Crop a line and type its words.');
    field('x').focus();
  } catch (error) {
    if (current !== job) return;
    release();
    show('error', 'Could not read image.');
    get('font-error-message').textContent =
      error instanceof Error && error.name !== 'EncodingError'
        ? error.message
        : 'This image is damaged or unsupported. Try another JPG, PNG or WebP.';
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
get('find-fonts').addEventListener('click', async () => {
  if (phase !== 'editor') return;
  let cropped: HTMLCanvasElement | undefined;
  const current = job;
  try {
    const text = get<HTMLInputElement>('sample-text').value.trim();
    if (
      !text ||
      text.length > 60 ||
      !/^[\u0020-\u007e]+$/.test(text) ||
      !/[A-Za-z]/.test(text)
    )
      throw new Error(
        'Type a single line of basic Latin words exactly as shown (up to 60 characters). Other scripts are not supported.',
      );
    const c = crop();
    show('processing', 'Preparing your crop locally.');
    cropped = document.createElement('canvas');
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
    const image = context.getImageData(0, 0, cropped.width, cropped.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      cropped!.toBlob(resolve),
    );
    if (current !== job) return;
    if (cropURL) URL.revokeObjectURL(cropURL);
    if (blob) {
      cropURL = URL.createObjectURL(blob);
      get<HTMLImageElement>('crop-preview').src = cropURL;
    }
    show(
      'processing',
      'Loading the self-hosted index and comparing glyph shapes.',
    );
    if (current !== job) return;
    worker ||= new Worker(new URL('./font-worker.ts', import.meta.url), {
      type: 'module',
    });
    const results: any[] = await new Promise((resolve, reject) => {
      cancelComparison = () => {
        clearTimeout(timer);
        reject(new Error('Comparison cancelled.'));
      };
      const timer = window.setTimeout(() => {
        worker?.terminate();
        worker = undefined;
        reject(new Error('Comparison timed out. Try a smaller, clearer crop.'));
      }, 120000);
      worker!.onmessage = (event) => {
        if (event.data.progress) {
          status(event.data.progress);
          return;
        }
        clearTimeout(timer);
        cancelComparison = undefined;
        if (event.data.error) reject(new Error(event.data.error));
        else resolve(event.data.results);
      };
      worker!.onerror = () => {
        clearTimeout(timer);
        cancelComparison = undefined;
        worker?.terminate();
        worker = undefined;
        reject(
          new Error('Font comparison could not start. Try another browser.'),
        );
      };
      worker!.postMessage(
        {
          text,
          image,
          threshold: Number(get<HTMLInputElement>('glyph-threshold').value),
        },
        [image.data.buffer],
      );
    });
    if (current !== job) return;
    for (const face of previewFaces) document.fonts.delete(face);
    previewFaces.length = 0;
    for (const font of results) {
      const face = new FontFace('KittyMatch-' + font.id, `url(${font.url})`);
      await face.load();
      if (current !== job) return;
      document.fonts.add(face);
      previewFaces.push(face);
    }
    get('font-matches').replaceChildren(
      ...results.map((font, index) => {
        const card = document.createElement('article');
        card.className = 'font-match';
        const title = document.createElement('h3');
        title.textContent = `${index === 0 ? 'Closest in collection' : `Similarity rank ${index + 1}`} · ${font.name}`;
        const preview = document.createElement('p');
        preview.textContent = text;
        preview.style.fontFamily = `"KittyMatch-${font.id}"`;
        preview.style.fontWeight = String(font.weight);
        const copy = document.createElement('button');
        copy.className = 'text-link';
        copy.textContent = 'Copy name';
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(font.name);
            status(`Copied ${font.name}.`);
          } catch {
            status(`Copy unavailable. Select this name: ${font.name}`);
          }
        });
        const sourceLink = document.createElement('a');
        sourceLink.href = font.source;
        sourceLink.textContent = 'Font source';
        const css = document.createElement('button');
        css.className = 'text-link';
        css.textContent = 'Copy CSS';
        css.addEventListener('click', async () => {
          const value = `font-family: "${font.name}", sans-serif; font-weight: ${font.weight};`;
          try {
            await navigator.clipboard.writeText(value);
            status('Copied CSS. Install or load the font separately.');
          } catch {
            status(value);
          }
        });
        const evidence = document.createElement('p');
        evidence.className = 'field-hint';
        const level = (n: number) =>
          n < 0.12 ? 'Close' : n < 0.3 ? 'Moderate' : 'Loose';
        evidence.textContent = `Overall: ${level(font.score)} ? Glyph shape: ${level(font.glyphScore)} ? Proportions: ${level(font.proportion)} ? Spacing: ${level(font.spacing)}. These are similarities, not confidence.`;
        const license = document.createElement('a');
        license.href = font.license;
        license.textContent = 'SIL Open Font License';
        preview.dataset.liveFont = 'true';
        card.append(title, preview, evidence, copy, css, sourceLink, license);
        return card;
      }),
    );
    show('results', 'Font suggestions ready.');
    get('font-results-title').focus();
    get<HTMLInputElement>('live-preview-text').value = text;
  } catch (error) {
    if (current === job) {
      show('editor', (error as Error).message);
      get('sample-text').focus();
    }
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
      Number(get<HTMLInputElement>('glyph-threshold').value),
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
