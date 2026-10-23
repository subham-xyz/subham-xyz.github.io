import { setKittyState, showPanel } from './tool-state';
import { bindSidebar } from './sidebar-ui';
import { imagePresets, presetSpec } from '../data/india';
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
  get('application').addEventListener('change', () => {
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
    const preset = presets[field('application').value];
    const sized = !!preset?.[0];
    field('width').value = String(preset?.[0] || preview.naturalWidth);
    field('height').value = String(preset?.[1] || preview.naturalHeight);
    field('minimum').value = String(preset?.[2] || 0);
    field('maximum').value = String(preset?.[3] || 0);
    field('size-unit').value = '1024';
    const known =
      [
        ...document.querySelectorAll<HTMLInputElement>(
          'input[data-sync=target-preset]',
        ),
      ].some((r) => r.value === String(preset?.[3])) ||
      [
        ...(get<HTMLSelectElement>('target-preset').querySelectorAll?.(
          'option',
        ) || []),
      ].some((o) => o.value === String(preset?.[3]));
    field('target-preset').value = !preset
      ? '0'
      : preset[3] && known && !preset[2]
        ? String(preset[3])
        : preset[3]
          ? 'custom'
          : '0';
    field('fixed').checked = sized;
    field('aspect-lock').checked = !sized;
    field('downscale').checked = !!preset && !sized && !!preset[3];
    field('downscale').disabled = sized;
    if (sized) field('fit').value = 'crop';
    if (get('percent')) field('percent').value = '100';
    if (preset) format.value = 'image/jpeg';
    syncTargetUI();
    const info = imagePresets.find((p) => p.id === field('application').value);
    if (get('preset-note'))
      get('preset-note').textContent = info
        ? `${info.label}: ${presetSpec(info)}. Check the official notice.`
        : 'Presets are starting points. Check the official notice.';
    if (get('resize-unit')) {
      field('resize-unit').value = 'pixels';
      get('percent-field').hidden = true;
    }
    updateOptions();
  });
  for (const dimension of ['width', 'height'])
    field(dimension).addEventListener('input', () => {
      if (get('resize-unit')) {
        field('resize-unit').value = 'pixels';
        get('percent-field').hidden = true;
      }
      if (field('aspect-lock').checked)
        field(dimension === 'width' ? 'height' : 'width').value = String(
          Math.max(
            1,
            Math.round(
              number(dimension) *
                (dimension === 'width'
                  ? preview.naturalHeight / preview.naturalWidth
                  : preview.naturalWidth / preview.naturalHeight),
            ),
          ),
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
async function selectFile(files: FileList | File[]) {
  if (phase === 'processing') return;
  const current = ++job;
  release();
  if (files.length !== 1) {
    fail(
      'Please choose one image at a time. Loki will give each file its full attention.',
    );
    return;
  }
  const file = files[0];
  try {
    checkFile(file);
  } catch (error) {
    fail((error as Error).message);
    return;
  }
  show('processing', 'Checking your image.');
  try {
    sourceURL = URL.createObjectURL(file);
    preview.src = sourceURL;
    await preview.decode();
    if (current !== job) return;
    if (
      !preview.naturalWidth ||
      preview.naturalWidth * preview.naturalHeight > 16000000 ||
      preview.naturalWidth > 16384 ||
      preview.naturalHeight > 16384
    )
      throw new Error(
        'This image is too large to process comfortably. Choose an image under 16 megapixels with each side below 16,384 pixels.',
      );
    await supportReady;
    if (current !== job) return;
    original = file;
    if (advanced) {
      const requested = new URLSearchParams(location.search).get('preset');
      field('application').value =
        requested && imagePresets.some((p) => p.id === requested)
          ? requested
          : workspace.dataset.exam === 'true'
            ? 'passport'
            : 'custom';
      get('application').dispatchEvent(new Event('change'));
      if (Number(workspace.dataset.target)) {
        field('maximum').value = workspace.dataset.target!;
        field('target-preset').value = workspace.dataset.target!;
        syncTargetUI();
      }
    }

    get<HTMLInputElement>('output-name').value =
      `${file.name.replace(/\.[^.]+$/, '') || 'image'}-${workspace.dataset.mode === 'compressor' ? 'compressed' : workspace.dataset.mode === 'resizer' ? 'resized' : 'converted'}`;
    get('file-name').textContent = file.name;
    get('file-meta').textContent =
      `${preview.naturalWidth} × ${preview.naturalHeight} px · ${size(file.size)}`;
    show('editor', `${file.name} selected. Choose an output format.`);
    format.focus();
  } catch (error) {
    if (current === job)
      fail(
        error instanceof Error && error.message.startsWith('This image')
          ? error.message
          : 'We could not read this image. It may be damaged or saved with a different file type. Try another JPG, PNG, or WebP.',
      );
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
get('convert').addEventListener('click', async () => {
  if (!original || phase !== 'editor') return;
  const file = original;
  const current = ++job;
  const mime = format.value;
  const value = Number(quality.value) / 100;
  const requestedName = get<HTMLInputElement>('output-name').value.trim();
  const safeName = normalizeFilename(requestedName);
  get('settings-error').textContent = '';
  show('processing', 'Processing your image locally.');
  try {
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    if (
      get('resize-unit') &&
      field('resize-unit').value === 'percent' &&
      (!Number.isFinite(number('percent')) ||
        number('percent') <= 0 ||
        number('percent') > 1000)
    )
      throw new Error(
        'Enter a percentage greater than 0 and no larger than 1000.',
      );
    const width = advanced ? number('width') : preview.naturalWidth;
    const height = advanced ? number('height') : preview.naturalHeight;
    checkDimensions(width, height);
    const min = advanced ? number('minimum') * number('size-unit') : 0;
    const max = advanced ? number('maximum') * number('size-unit') : 0;
    if (
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min < 0 ||
      max < 0 ||
      (max && min > max)
    )
      throw new Error(
        'Enter valid minimum and maximum sizes; minimum cannot exceed maximum.',
      );
    const fit = advanced ? field('fit').value : 'contain';
    if (
      advanced &&
      !fit &&
      Math.abs(width / height - preview.naturalWidth / preview.naturalHeight) >
        0.005
    )
      throw new Error(
        'The aspect ratios differ. Choose crop-to-fit or padding in settings.',
      );
    const fixed = advanced && field('fixed').checked;
    const candidate = await inspectOutput(
      await searchOutput(
        async (w: number, h: number, q: number) => {
          if (current !== job) throw new Error('Processing cancelled.');
          const canvas = draw(
            preview,
            w,
            h,
            fit || 'contain',
            field('transparent-background').checked && mime !== 'image/jpeg'
              ? 'transparent'
              : field('background').value,
            mime,
          );
          try {
            return await encode(canvas, mime, q);
          } finally {
            canvas.width = canvas.height = 0;
          }
        },
        {
          width,
          height,
          mime,
          quality: value,
          min,
          max,
          fixed,
          downscale: advanced && field('downscale').checked,
        },
      ),
    );
    const { blob } = candidate;
    const failures = validate(candidate, {
      min,
      max,
      mime,
      width: fixed ? width : 0,
      height: fixed ? height : 0,
    });
    get('constraint-results').textContent = failures.length
      ? 'Does not meet requirement\n' + failures.join('\n')
      : min || max || fixed
        ? 'Meets requirement \u2713 — every selected constraint passed.'
        : 'Ready to download.';
    if (current !== job) return;
    if (blob.type !== mime)
      throw new Error(
        'Your browser does not support this output format. Try JPG or PNG instead.',
      );
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = URL.createObjectURL(blob);
    resultPreview.src = outputURL;
    const extension = mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1];
    const download = get<HTMLAnchorElement>('download');
    download.href = outputURL;
    download.download = `${safeName}.${extension}`;
    get('result-meta').replaceChildren(
      ...[
        `Original: ${size(file.size)} · ${preview.naturalWidth} × ${preview.naturalHeight} px`,
        `${extension.toUpperCase()}: ${size(blob.size)} (${blob.size.toLocaleString()} bytes)`,
        `${candidate.width} × ${candidate.height} px`,
        `${Math.abs((1 - blob.size / file.size) * 100).toFixed(1)}% ${blob.size <= file.size ? 'smaller' : 'size increase'}`,
      ].map((text) => {
        const span = document.createElement('span');
        span.textContent = text;
        return span;
      }),
    );
    const saved = Math.round((1 - blob.size / file.size) * 100);
    get('result-ring').hidden = !(blob.size < file.size);
    if (blob.size < file.size) {
      get('ring').style.setProperty('--p', String(saved));
      get('ring-value').textContent = `${saved}%`;
      get('ring-text').replaceChildren(
        `Your image is now ${saved}% smaller!`,
        Object.assign(document.createElement('strong'), {
          textContent: `${size(file.size)} → ${size(blob.size)}`,
        }),
      );
    }
    show(
      'result',
      `Conversion complete. Your ${extension.toUpperCase()} image is ready to download.`,
    );
    get('result-title').focus();
  } catch (error) {
    if (current === job) {
      show('editor', (error as Error).message);
      get('settings-error').textContent = (error as Error).message;
      get('settings-error').focus();
    }
  }
});
window.addEventListener('pagehide', (event) => {
  if (!event.persisted) {
    job++;
    release();
  }
});
