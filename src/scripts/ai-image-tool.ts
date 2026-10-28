// Upscale Image page. The AI engine (worker, runtime and model) loads only after
// the user presses the run button; nothing heavy runs on page load.
import { bindDrop } from './local-files';
import { setKittyState } from './tool-state';
import { assess, getLocalCapabilities } from './local-engine/capabilities';
import { describeError, isCancelled } from './local-engine/processing-errors';
import { isModelCached, megabytes } from './local-engine/model-cache';

const root = document.getElementById('ai-tool');
if (root) {
  const get = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const status = (text: string) => (get('ai-status').textContent = text);
  const upload = get('ai-upload');
  const editor = get('ai-editor');
  const run = get<HTMLButtonElement>('ai-run');
  const download = get<HTMLAnchorElement>('ai-download');
  const before = get<HTMLImageElement>('ai-before');
  const after = get<HTMLImageElement>('ai-after');
  const progress = get<HTMLProgressElement>('ai-progress');
  const modelDir = '/models/esrgan/';

  type Upscale = typeof import('./local-engine/upscale');
  type Client = { load(gpu: boolean): Promise<string>; cancel(): void; stop(): void };

  let file: File | undefined;
  let original: ImageBitmap | undefined;
  let transparent = false;
  let upscaled: { pixels: Uint8ClampedArray; width: number; height: number } | undefined;
  let urls: string[] = [];
  let client: (Client & Record<string, any>) | undefined;
  let busy = false;
  let gpu = false;

  void getLocalCapabilities().then((caps) => {
    gpu = caps.webgpu;
    const verdict = assess('local-ai', caps);
    for (const id of ['ai-device', 'ai-device-note']) {
      get(id).hidden = !verdict.message;
      get(id).textContent = verdict.message || '';
    }
    if (!verdict.supported) get<HTMLInputElement>('ai-file').disabled = true;
    if (!caps.webgpu && verdict.supported) {
      const note = get('ai-device-note');
      note.hidden = false;
      note.textContent = [
        verdict.message,
        'No graphics acceleration (WebGPU) here, so upscaling uses the CPU and can take a minute or more. Chrome or Edge on a computer is much faster.',
      ]
        .filter(Boolean)
        .join(' ');
    }
  });

  const objectURL = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    urls.push(url);
    return url;
  };
  const choice = (name: string) => root.querySelector<HTMLInputElement>(`input[name=${name}]:checked`)!.value;
  const showProgress = (fraction?: number | null) => {
    get('ai-progress-wrap').hidden = fraction === undefined;
    if (fraction === null) progress.removeAttribute('value');
    else progress.value = Math.round((fraction || 0) * 100);
  };
  const baseName = () => (file?.name || 'image').replace(/\.[^.]+$/, '');

  async function select(files: File[]) {
    if (busy || !files.length) return;
    try {
      const chosen = files[0];
      if (!/\.(jpe?g|png|webp)$/i.test(chosen.name) && !/^image\/(jpeg|png|webp)$/.test(chosen.type))
        throw new Error('Choose a JPG, PNG or WebP image.');
      if (!chosen.size) throw new Error('This file is empty.');
      let bitmap: ImageBitmap;
      try {
        bitmap = await createImageBitmap(chosen, { imageOrientation: 'from-image' });
      } catch {
        throw new Error('This image could not be read. It may be damaged or in an unsupported format.');
      }
      const limit = (await import('./local-engine/upscale')).maxInputPixels();
      if (bitmap.width * bitmap.height > limit) {
        const { width, height } = bitmap;
        bitmap.close();
        throw new Error(
          `This image is ${width} × ${height}. Its 4× result would be larger than this browser can draw, so here the input can be about ${Math.max(1, Math.floor(limit / 1_000_000))} megapixels. Resize it first, or use desktop Chrome, Edge or Firefox.`,
        );
      }
      reset(false);
      file = chosen;
      original = bitmap;
      transparent = (await import('./local-engine/upscale')).hasTransparency(bitmap);
      before.src = objectURL(chosen);
      get('ai-dimensions').textContent = `${bitmap.width} × ${bitmap.height} px`;
      upload.hidden = true;
      editor.hidden = false;
      status(`Image ready. Choose your options, then select ${run.textContent!.replace('→', '').trim()}.`);
      void modelState();
    } catch (error) {
      status(describeError(error, 'this image'));
      setKittyState(root!, 'error');
    }
  }

  async function modelState() {
    try {
      const info = await (await fetch(`${modelDir}model.json`)).json();
      get('ai-model').textContent = (await isModelCached(info.parts.map((p: string) => modelDir + p)))
        ? 'The AI model is saved on this device, so it starts without downloading.'
        : `The AI model (${megabytes(info.bytes)}) downloads once and is kept on this device for next time.`;
    } catch {}
  }

  const encode = (canvas: HTMLCanvasElement, type: string) =>
    new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The result is too large to encode in this browser.'))), type, 0.92),
    );

  async function render() {
    if (!original) return;
    if (!upscaled) return;
    const { finish } = await import('./local-engine/upscale');
    const scale = Number(choice('ai-scale')) as 2 | 4;
    const canvas = finish(original, upscaled, scale, transparent);
    const type = transparent ? 'image/png' : get<HTMLSelectElement>('ai-format').value;
    const note = `${scale}× · ${type === 'image/png' ? 'PNG' : 'JPG'}${transparent && get<HTMLSelectElement>('ai-format').value !== 'image/png' ? ' (kept as PNG for transparency)' : ''}`;
    const blob = await encode(canvas, type);
    const ext = type === 'image/png' ? 'png' : 'jpg';
    after.src = download.href = objectURL(blob);
    download.download = `${baseName()}-${choice('ai-scale')}x.${ext}`;
    download.firstChild!.textContent = `Download ${ext.toUpperCase()} `;
    after.hidden = false;
    get('ai-after-empty').hidden = true;
    download.hidden = false;
    run.hidden = true;
    get('ai-dimensions').textContent = `${original.width} × ${original.height} px → ${canvas.width} × ${canvas.height} px ${note}`;
    canvas.width = canvas.height = 0;
  }

  async function engine() {
    if (client) return client;
    const events = {
      onProgress: (loaded: number, total: number, cached: boolean) => {
        showProgress(loaded / total);
        status(
          cached
            ? 'Loading the AI model from this device...'
            : `Downloading the AI model: ${megabytes(loaded)} of ${megabytes(total)} (one time only)...`,
        );
      },
      onStatus: status,
      onTile: (done: number, total: number) => {
        showProgress(done / total);
        status(`Upscaling on your device: part ${done} of ${total}...`);
      },
    };
    client = ((await import('./local-engine/upscale')) as Upscale).createUpscaler(events);
    return client;
  }

  run.addEventListener('click', async () => {
    if (busy || !original) return;
    busy = true;
    run.disabled = true;
    get<HTMLButtonElement>('ai-reset').disabled = true;
    setKittyState(root!, 'processing');
    showProgress(0);
    try {
      const ai = await engine();
      status('Starting the AI engine...');
      const backend = await ai.load(gpu);
      const where = backend === 'webgpu' ? 'graphics card' : 'CPU';
      const started = performance.now();
      showProgress(0);
      status(`Upscaling on your device (${where})...`);
      upscaled = await ai.upscale(await createImageBitmap(original));
      await render();
      status(`Done in ${((performance.now() - started) / 1000).toFixed(1)} s. Your image never left this device.`);
      setKittyState(root!, 'success');
      void modelState();
    } catch (error) {
      if (isCancelled(error)) client = undefined;
      status(describeError(error, 'this image'));
      setKittyState(root!, isCancelled(error) ? 'idle' : 'error');
    } finally {
      showProgress();
      busy = false;
      run.disabled = false;
      get<HTMLButtonElement>('ai-reset').disabled = false;
    }
  });
  get('ai-cancel').addEventListener('click', () => busy && client?.cancel());
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input[name=ai-scale], #ai-format').forEach(
    (input) =>
      input.addEventListener('input', () => {
        if (upscaled && !busy) void render().catch((e) => status(describeError(e, 'this image')));
      }),
  );

  function reset(showUpload = true) {
    urls.forEach((url) => URL.revokeObjectURL(url));
    urls = [];
    original?.close();
    original = undefined;
    upscaled = undefined;
    file = undefined;
    before.removeAttribute('src');
    after.removeAttribute('src');
    after.hidden = true;
    get('ai-after-empty').hidden = false;
    download.hidden = true;
    download.removeAttribute('href');
    run.hidden = false;
    if (showUpload) {
      editor.hidden = true;
      upload.hidden = false;
      get<HTMLInputElement>('ai-file').value = '';
      status('Choose an image to start again.');
      setKittyState(root!, 'idle');
    }
  }
  get('ai-reset').addEventListener('click', () => !busy && reset());
  bindDrop(get<HTMLInputElement>('ai-file'), select);
  window.addEventListener('pagehide', () => {
    client?.stop();
    reset(false);
  });
}
