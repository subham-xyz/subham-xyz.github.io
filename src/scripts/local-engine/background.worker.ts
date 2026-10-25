// Background removal (IS-Net) with onnxruntime-web, entirely inside this worker.
// The runtime and model are self-hosted; the image never leaves the browser.
import type * as Ort from 'onnxruntime-web';
import { loadModel } from './model-cache';
import { createSession } from './ort-runtime';

type ModelInfo = { input: number; mean: number[]; std: number[]; bytes: number; parts: string[] };
type Request =
  | { type: 'load'; gpu: boolean }
  | { type: 'run'; id: number; image: ImageBitmap };

const MODEL_DIR = '/models/isnet/';
let session: Promise<{ session: Ort.InferenceSession; ort: typeof Ort; info: ModelInfo; backend: string }> | undefined;

const post = (message: unknown, transfer: Transferable[] = []) =>
  (self as unknown as Worker).postMessage(message, transfer);

async function open(gpu: boolean) {
  const info: ModelInfo = await (await fetch(`${MODEL_DIR}model.json`)).json();
  const bytes = await loadModel(
    info.parts.map((p) => MODEL_DIR + p),
    info.bytes,
    (loaded, total, fromCache) => post({ type: 'progress', loaded, total, fromCache }),
  );
  post({ type: 'status', text: 'Preparing the model...' });
  const { session, ort, backend } = await createSession(bytes, gpu, (text) => post({ type: 'status', text }));
  return { session, ort, info, backend };
}

function toTensor(ort: typeof Ort, image: ImageBitmap, info: ModelInfo) {
  const size = info.input;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);
  const plane = size * size;
  const input = new Float32Array(plane * 3);
  for (let i = 0; i < plane; i++)
    for (let c = 0; c < 3; c++) input[c * plane + i] = (data[i * 4 + c] / 255 - info.mean[c]) / info.std[c];
  return new ort.Tensor('float32', input, [1, 3, size, size]);
}

// Min-max normalise the prediction to an 8-bit mask, as the model's reference code does.
function toMask(values: Float32Array) {
  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  const mask = new Uint8ClampedArray(values.length);
  for (let i = 0; i < values.length; i++) mask[i] = ((values[i] - min) / range) * 255;
  return mask;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type === 'load') {
      session ||= open(data.gpu);
      const ready = await session.catch((error) => {
        session = undefined;
        throw error;
      });
      post({ type: 'ready', backend: ready.backend });
      return;
    }
    if (!session) throw new Error('The model is not loaded yet.');
    const { session: s, ort, info } = await session;
    const tensor = toTensor(ort, data.image, info);
    data.image.close();
    const started = performance.now();
    const output = await s.run({ [s.inputNames[0]]: tensor });
    tensor.dispose();
    const result = output[s.outputNames[0]];
    const mask = toMask(result.data as Float32Array);
    result.dispose();
    post({ type: 'mask', id: data.id, mask, size: info.input, ms: Math.round(performance.now() - started) }, [mask.buffer]);
  } catch (error) {
    post({ type: 'error', id: (data as any).id, message: error instanceof Error ? error.message : String(error) });
  }
};
