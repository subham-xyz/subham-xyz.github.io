import { setKittyState, showPanel } from './tool-state';
import { bindSidebar } from './sidebar-ui';
import { imagePresets, presetSpec } from '../data/india';
import { readToolParams, describeIntent } from './search-intent.mjs';
import {
  size,
  normalizeFilename,
  checkFile,
  checkDimensions,
  capabilities,
  draw,
  encode,
  searchOutput,
  inspectOutput,
  validate,
} from './image-core.mjs';
import { fitsCanvas, canvasLimitMessage } from './device-limits.mjs';
const workspace = document.querySelector<HTMLElement>('#converter')!;
const get = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const input = get<HTMLInputElement>('file-input');
const format = get<HTMLSelectElement>('output-format');
const outputName = get<HTMLInputElement>('output-name');
outputName.addEventListener('blur', () => {
  outputName.value = normalizeFilename(outputName.value.trim());
});
const quality = get<HTMLInputElement>('quality');
const dropzone = get<HTMLDivElement>('dropzone');
const preview = get<HTMLImageElement>('input-preview');
const resultPreview = get<HTMLImageElement>('output-preview');
let original: File | null = null;
let sourceURL = '';
let outputURL = '';
let job = 0;
let phase = 'upload';
let dragDepth = 0;
function kittyState(state: string) {
  setKittyState(workspace, state);
}
function announce(message: string) {
  get('tool-status').textContent = message;
}
function show(next: string, message: string) {
  phase = next;
  showPanel(workspace, `${next}-panel`, next);
  workspace
    .querySelectorAll<HTMLElement>('[data-step]')
    .forEach((step) =>
      step.classList.toggle(
        'active',
        step.dataset.step === next ||
          (next === 'processing' && step.dataset.step === 'editor'),
      ),
    );
  announce(message);
}
function release() {
  preview.removeAttribute('src');
  resultPreview.removeAttribute('src');
  if (sourceURL) URL.revokeObjectURL(sourceURL);
  if (outputURL) URL.revokeObjectURL(outputURL);
  sourceURL = '';
  outputURL = '';
  original = null;
  get<HTMLAnchorElement>('download').removeAttribute('href');
}
function fail(message: string) {
  release();
  show('error', message);
  get('error-message').textContent = message;
  get('error-title').focus();
}
function reset() {
  job++;
  release();
  input.value = '';
  show('upload', 'Ready for another image.');
  input.focus();
}
workspace
  .querySelectorAll<HTMLButtonElement>('[data-reset]')
  .forEach((button) => button.addEventListener('click', reset));
function updateOptions() {
  get('file-extension').textContent =
    format.value === 'image/jpeg' ? '.jpg' : `.${format.value.split('/')[1]}`;
  get('quality-field').hidden = format.value === 'image/png';
  if (get('quality-preset')) {
    get<HTMLSelectElement>('quality-preset').disabled =
      format.value === 'image/png';
  }
  get('format-hint').textContent =
    format.value === 'image/jpeg'
      ? 'Transparent areas use your chosen background. Animation becomes a still image; source metadata is removed.'
      : 'Transparency follows your background choice. Animation becomes a still image; source metadata is removed.';
}
format.addEventListener('change', updateOptions);
quality.addEventListener('input', () => {
  get('quality-value').textContent = `${quality.value}%`;
});
const supportReady = capabilities().then((supported) => {
  for (const option of format.options)
    option.disabled = !supported.includes(option.value);
  if (format.selectedOptions[0].disabled)
    format.value = supported[0] || 'image/png';
  updateOptions();
});
const advanced = workspace.dataset.mode !== 'converter';
bindSidebar(workspace, () => {});
// Keep chip groups and the custom-size fields in step with programmatic changes.
function syncTargetUI(focusSafe = true) {
  const target = document.getElementById(
    'target-preset',
  ) as HTMLInputElement | null;
  if (!target) return;
  document
    .querySelectorAll<HTMLInputElement>('input[data-sync=target-preset]')
    .forEach((radio) => (radio.checked = radio.value === target.value));
  const custom = document.getElementById('custom-target');
  if (custom) custom.hidden = target.value !== 'custom';
  void focusSafe;
}
const field = (id: string) => get<HTMLInputElement>(id);
const number = (id: string) => Number(field(id).value);
get('back-settings').addEventListener('click', () => {
  show('editor', 'Edit your settings.');
  format.focus();
});
if (advanced) {
  quality.value = '80';
  get('quality-value').textContent = '80%';
  // Width, height, min KB, max KB for each "application" preset.
  const presets: Record<string, number[]> = {
    passport: [413, 531, 10, 200],
    signature: [300, 100, 10, 50],
    document: [1200, 1600, 0, 500],
    profile: [400, 400, 0, 0],
    square: [1080, 1080, 0, 0],
    social: [1200, 630, 0, 0],
    ...Object.fromEntries(
      imagePresets.map((p) => [p.id, [p.width, p.height, p.minKB, p.maxKB]]),
    ),
  };
  const usePixels = () => {
    if (!get('resize-unit')) return;
    field('resize-unit').value = 'pixels';
    get('percent-field').hidden = true;
  };
  // A target chip/option exists for this KB value.
  const knownTarget = (kb: string) =>
    [
      ...document.querySelectorAll<HTMLInputElement>(
        'input[data-sync=target-preset]',
      ),
    ].some((r) => r.value === kb) ||
    [
      ...(get<HTMLSelectElement>('target-preset').querySelectorAll?.(
        'option',
      ) || []),
    ].some((o) => o.value === kb);
  function targetFor(preset?: number[]) {
    if (!preset?.[3]) return '0';
    return knownTarget(String(preset[3])) && !preset[2]
      ? String(preset[3])
      : 'custom';
  }
  function setSizeFields([width = 0, height = 0, min = 0, max = 0]: number[]) {
    field('width').value = String(width || preview.naturalWidth);
    field('height').value = String(height || preview.naturalHeight);
    field('minimum').value = String(min);
    field('maximum').value = String(max);
    field('size-unit').value = '1024';
  }
  function applyPreset(preset?: number[]) {
    const values = preset || [];
    const sized = (values[0] || 0) > 0;
    setSizeFields(values);
    field('target-preset').value = targetFor(preset);
    field('fixed').checked = sized;
    field('aspect-lock').checked = !sized;
    field('downscale').checked = !!preset && !sized && (values[3] || 0) > 0;
    field('downscale').disabled = sized;
    if (sized) field('fit').value = 'crop';
    if (get('percent')) field('percent').value = '100';
    if (preset) format.value = 'image/jpeg';
  }

  function showPresetNote(id: string) {
    const info = imagePresets.find((p) => p.id === id);
    if (get('preset-note'))
      get('preset-note').textContent = info
        ? `${info.label}: ${presetSpec(info)}. Check the official notice.`
        : 'Presets are starting points. Check the official notice.';
  }
  get('application').addEventListener('change', () => {
    const id = field('application').value;
    applyPreset(presets[id]);
    syncTargetUI();
    showPresetNote(id);
    usePixels();
    updateOptions();
  });
  for (const dimension of ['width', 'height'])
    field(dimension).addEventListener('input', () => {
      usePixels();
      if (!field('aspect-lock').checked) return;
      const ratio =
        dimension === 'width'
          ? preview.naturalHeight / preview.naturalWidth
          : preview.naturalWidth / preview.naturalHeight;
      field(dimension === 'width' ? 'height' : 'width').value = String(
        Math.max(1, Math.round(number(dimension) * ratio)),
      );
    });
  get('quality-preset').addEventListener('change', () => {
    get('quality-field').classList.toggle(
      'in-more',
      field('quality-preset').value !== 'custom',
    );
    if (field('quality-preset').value !== 'custom') {
      quality.value = field('quality-preset').value;
      get('quality-value').textContent = quality.value + '%';
    }
  });
  quality.addEventListener('input', () => {
    field('quality-preset').value = 'custom';
  });
  get('target-preset').addEventListener('change', () => {
    if (field('target-preset').value !== 'custom') {
      field('maximum').value = field('target-preset').value;
      field('size-unit').value = '1024';
    }
    syncTargetUI();
    if (field('target-preset').value === 'custom' && get('custom-target'))
      field('maximum').focus();
  });
  get('maximum').addEventListener('input', () => {
    field('target-preset').value = 'custom';
    syncTargetUI(false);
  });
  get('fixed').addEventListener('change', () => {
    field('downscale').disabled = field('fixed').checked;
    if (field('fixed').checked) field('downscale').checked = false;
  });
  get('resize-unit')?.addEventListener('change', () => {
    get('percent-field').hidden = field('resize-unit').value !== 'percent';
    if (field('resize-unit').value === 'percent')
      get('percent').dispatchEvent(new Event('input'));
  });
  get('percent')?.addEventListener('input', () => {
    field('width').value = String(
      Math.round((preview.naturalWidth * number('percent')) / 100),
    );
    field('height').value = String(
      Math.round((preview.naturalHeight * number('percent')) / 100),
    );
  });
}
updateOptions();
// What the browser can actually draw (device-limits.mjs), not a product cap.
const tooLarge = () =>
  !preview.naturalWidth ||
  !fitsCanvas(preview.naturalWidth, preview.naturalHeight);
const suffixes: Record<string, string> = {
  compressor: 'compressed',
  resizer: 'resized',
};
// Preset from ?preset=, the exam default, or "custom".
function startingPreset() {
  const requested = new URLSearchParams(location.search).get('preset');
  if (requested && imagePresets.some((p) => p.id === requested))
    return requested;
  return workspace.dataset.exam === 'true' ? 'passport' : 'custom';
}
function applyPageSettings() {
  if (!advanced) return;
  field('application').value = startingPreset();
  get('application').dispatchEvent(new Event('change'));
  const target = workspace.dataset.target;
  if (!Number(target)) return;
  field('maximum').value = target!;
  field('target-preset').value = target!;
  syncTargetUI();
}
// Settings handed over by the home search (?targetSize=20&unit=KB, ?width=…,
// ?format=jpg). Validated in search-intent.mjs; invalid values are ignored.
const toolIds = {
  compressor: 'image-compressor',
  resizer: 'image-resizer',
  converter: 'image-converter',
} as const;
const toolId =
  toolIds[(workspace.dataset.mode || 'converter') as keyof typeof toolIds] ||
  'image-converter';
const prefill = readToolParams(location.search, toolId);
const mimes = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
};
const targetValues = () =>
  [
    ...document.querySelectorAll<HTMLInputElement | HTMLOptionElement>(
      'input[data-sync=target-preset], select#target-preset option',
    ),
  ].map((item) => item.value);
function prefillTarget(size: number, unit: 'KB' | 'MB') {
  const kb = unit === 'MB' ? size * 1024 : size;
  const preset = Number.isInteger(kb) && targetValues().includes(String(kb));
  field('maximum').value = String(preset ? kb : size);
  field('size-unit').value = preset || unit === 'KB' ? '1024' : '1048576';
  field('target-preset').value = preset ? String(kb) : 'custom';
  syncTargetUI();
  // The resizer keeps its size limit under "More options".
  if (workspace.dataset.mode === 'resizer')
    get<HTMLDetailsElement>('more-image-options').open = true;
}
function prefillDimensions(width?: number, height?: number) {
  if (get('resize-unit')) field('resize-unit').value = 'pixels';
  if (get('percent-field')) get('percent-field').hidden = true;
  if (width && height) {
    field('aspect-lock').checked = false;
    field('width').value = String(width);
    field('height').value = String(height);
    return;
  }
  // One side only: the other follows the image's proportions.
  const side = width ? 'width' : 'height';
  field(side).value = String(width || height);
  field(side).dispatchEvent(new Event('input'));
}
function applySearchPrefill() {
  const mime = prefill.format && mimes[prefill.format];
  const option = [...format.options].find((o) => o.value === mime);
  if (option && !option.disabled) {
    format.value = option.value;
    updateOptions();
  }
  if (!advanced) return;
  if (prefill.targetSize && prefill.unit)
    prefillTarget(prefill.targetSize, prefill.unit);
  if (prefill.width || prefill.height)
    prefillDimensions(prefill.width, prefill.height);
}
function applyStartingSettings() {
  applyPageSettings();
  applySearchPrefill();
}
// Arriving from search: say what is set and put focus on "Choose image".
function announcePrefill() {
  const summary = describeIntent({ tool: toolId, params: prefill });
  if (!summary) return;
  const note = document.createElement('p');
  note.className = 'prefill-note';
  note.id = 'prefill-note';
  note.textContent = `From your search · ${summary}`;
  dropzone.querySelector('h2')?.after(note);
  input.setAttribute(
    'aria-describedby',
    `prefill-note ${input.getAttribute('aria-describedby') || ''}`.trim(),
  );
  requestAnimationFrame(() => {
    dropzone.scrollIntoView({ block: 'nearest' });
    input.focus({ preventScroll: true });
  });
}
announcePrefill();
function singleFile(files: FileList | File[]) {
  if (files.length !== 1)
    throw new Error(
      'Please choose one image at a time. Loki will give each file its full attention.',
    );
  checkFile(files[0]);
  return files[0];
}
// Decode the chosen image into the preview; false if a newer selection replaced it.
async function loadPreview(file: File, current: number) {
  sourceURL = URL.createObjectURL(file);
  preview.src = sourceURL;
  await preview.decode();
  if (current !== job) return false;
  if (tooLarge())
    throw new Error(canvasLimitMessage());
  await supportReady;
  return current === job;
}
function showSelected(file: File) {
  original = file;
  applyStartingSettings();
  const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
  get<HTMLInputElement>('output-name').value =
    `${stem}-${suffixes[workspace.dataset.mode || ''] || 'converted'}`;
  get('file-name').textContent = file.name;
  get('file-meta').textContent =
    `${preview.naturalWidth} × ${preview.naturalHeight} px · ${size(file.size)}`;
  show('editor', `${file.name} selected. Choose an output format.`);
  format.focus();
}
const readError = (error: unknown) =>
  error instanceof Error && error.message.startsWith('This image')
    ? error.message
    : 'We could not read this image. It may be damaged or saved with a different file type. Try another JPG, PNG, or WebP.';
async function selectFile(files: FileList | File[]) {
  if (phase === 'processing') return;
  const current = ++job;
  release();
  let file: File;
  try {
    file = singleFile(files);
  } catch (error) {
    fail((error as Error).message);
    return;
  }
  show('processing', 'Checking your image.');
  try {
    if (await loadPreview(file, current)) showSelected(file);
  } catch (error) {
    if (current === job) fail(readError(error));
  }
}
input.addEventListener('change', () => {
  if (input.files?.length) void selectFile(input.files);
});
function fileDrag(event: DragEvent) {
  return event.dataTransfer?.types.includes('Files');
}
document.addEventListener('dragenter', (event) => {
  if (!fileDrag(event)) return;
  event.preventDefault();
  dragDepth++;
  if (phase === 'upload') {
    dropzone.classList.add('dragging');
    kittyState('upload');
  }
});
document.addEventListener('dragover', (event) => {
  if (fileDrag(event)) {
    event.preventDefault();
    if (event.dataTransfer)
      event.dataTransfer.dropEffect = phase === 'processing' ? 'none' : 'copy';
  }
});
document.addEventListener('dragleave', (event) => {
  if (!fileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) {
    dropzone.classList.remove('dragging');
    if (phase === 'upload') kittyState('idle');
  }
});
document.addEventListener('drop', (event) => {
  if (!fileDrag(event)) return;
  event.preventDefault();
  dragDepth = 0;
  dropzone.classList.remove('dragging');
  if (event.dataTransfer?.files.length)
    void selectFile(event.dataTransfer.files);
});
// Two frames so the processing state paints; a timer keeps hidden tabs going.
const nextFrame = () =>
  new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, 120);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      }),
    );
  });
function checkPercent() {
  if (!get('resize-unit') || field('resize-unit').value !== 'percent') return;
  const p = number('percent');
  if (!Number.isFinite(p) || p <= 0 || p > 1000)
    throw new Error(
      'Enter a percentage greater than 0 and no larger than 1000.',
    );
}
const validSizes = (min: number, max: number) =>
  Number.isFinite(min) &&
  Number.isFinite(max) &&
  min >= 0 &&
  max >= 0 &&
  !(max && min > max);
// Resizer/compressor read the sidebar; converter mode keeps the original size.
function requestedSize() {
  if (!advanced)
    return {
      width: preview.naturalWidth,
      height: preview.naturalHeight,
      min: 0,
      max: 0,
    };
  const unit = number('size-unit');
  return {
    width: number('width'),
    height: number('height'),
    min: number('minimum') * unit,
    max: number('maximum') * unit,
  };
}
function checkRatio(fit: string, width: number, height: number) {
  const ratioChanged =
    Math.abs(width / height - preview.naturalWidth / preview.naturalHeight) >
    0.005;
  if (advanced && !fit && ratioChanged)
    throw new Error(
      'The aspect ratios differ. Choose crop-to-fit or padding in settings.',
    );
}
function readSettings() {
  checkPercent();
  const { width, height, min, max } = requestedSize();
  checkDimensions(width, height);
  if (!validSizes(min, max))
    throw new Error(
      'Enter valid minimum and maximum sizes; minimum cannot exceed maximum.',
    );
  const fit = advanced ? field('fit').value : 'contain';
  checkRatio(fit, width, height);
  const fixed = advanced && field('fixed').checked;
  return {
    width,
    height,
    min,
    max,
    fit: fit || 'contain',
    fixed,
    downscale: advanced && field('downscale').checked,
  };
}
type Settings = ReturnType<typeof readSettings>;
function encoder(current: number, mime: string, fit: string) {
  const background =
    field('transparent-background').checked && mime !== 'image/jpeg'
      ? 'transparent'
      : field('background').value;
  return async (w: number, h: number, q: number) => {
    if (current !== job) throw new Error('Processing cancelled.');
    const canvas = draw(preview, w, h, fit, background, mime);
    try {
      return await encode(canvas, mime, q);
    } finally {
      canvas.width = canvas.height = 0;
    }
  };
}
function constraintMessage(failures: string[], s: Settings) {
  if (failures.length)
    return 'Does not meet requirement\n' + failures.join('\n');
  return s.min || s.max || s.fixed
    ? 'Meets requirement ✓ — every selected constraint passed.'
    : 'Ready to download.';
}
const span = (text: string) =>
  Object.assign(document.createElement('span'), { textContent: text });
function showSavings(file: File, blob: Blob) {
  const smaller = blob.size < file.size;
  get('result-ring').hidden = !smaller;
  if (!smaller) return;
  const saved = Math.round((1 - blob.size / file.size) * 100);
  get('ring').style.setProperty('--p', String(saved));
  get('ring-value').textContent = `${saved}%`;
  get('ring-text').replaceChildren(
    `Your image is now ${saved}% smaller!`,
    Object.assign(document.createElement('strong'), {
      textContent: `${size(file.size)} → ${size(blob.size)}`,
    }),
  );
}
function showOutput(
  file: File,
  candidate: { blob: Blob; width: number; height: number },
  name: string,
) {
  const { blob } = candidate;
  if (outputURL) URL.revokeObjectURL(outputURL);
  outputURL = URL.createObjectURL(blob);
  resultPreview.src = outputURL;
  const extension =
    blob.type === 'image/jpeg' ? 'jpg' : blob.type.split('/')[1];
  const download = get<HTMLAnchorElement>('download');
  download.href = outputURL;
  download.download = `${name}.${extension}`;
  const change = Math.abs((1 - blob.size / file.size) * 100).toFixed(1);
  get('result-meta').replaceChildren(
    span(
      `Original: ${size(file.size)} · ${preview.naturalWidth} × ${preview.naturalHeight} px`,
    ),
    span(
      `${extension.toUpperCase()}: ${size(blob.size)} (${blob.size.toLocaleString()} bytes)`,
    ),
    span(`${candidate.width} × ${candidate.height} px`),
    span(`${change}% ${blob.size <= file.size ? 'smaller' : 'size increase'}`),
  );
  showSavings(file, blob);
  show(
    'result',
    `Conversion complete. Your ${extension.toUpperCase()} image is ready to download.`,
  );
  get('result-title').focus();
}
get('convert').addEventListener('click', async () => {
  if (!original || phase !== 'editor') return;
  const file = original;
  const current = ++job;
  const mime = format.value;
  const name = normalizeFilename(
    get<HTMLInputElement>('output-name').value.trim(),
  );
  get('settings-error').textContent = '';
  show('processing', 'Processing your image locally.');
  try {
    await nextFrame();
    const s = readSettings();
    const candidate = await inspectOutput(
      await searchOutput(encoder(current, mime, s.fit), {
        ...s,
        mime,
        quality: Number(quality.value) / 100,
      }),
    );
    const failures = validate(candidate, {
      min: s.min,
      max: s.max,
      mime,
      width: s.fixed ? s.width : 0,
      height: s.fixed ? s.height : 0,
    });
    get('constraint-results').textContent = constraintMessage(failures, s);
    if (current !== job) return;
    if (candidate.blob.type !== mime)
      throw new Error(
        'Your browser does not support this output format. Try JPG or PNG instead.',
      );
    showOutput(file, candidate, name);
  } catch (error) {
    if (current !== job) return;
    show('editor', (error as Error).message);
    get('settings-error').textContent = (error as Error).message;
    get('settings-error').focus();
  }
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    job++;
    release();
  }
});
