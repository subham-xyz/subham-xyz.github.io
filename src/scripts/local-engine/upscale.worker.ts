// 4x super-resolution (Real-ESRGAN general x4v3) with onnxruntime-web, in overlapping tiles
// so memory stays bounded. The model and runtime are self-hosted; the image stays in this worker.
import { loadModel } from './model-cache';
import { createSession, type Session } from './ort-runtime';

type Request = { type: 'load'; gpu: boolean } | { type: 'run'; id: number; image: ImageBitmap };
const MODEL_DIR = '/models/esrgan/';
const SCALE = 4;
const PAD = 12;

let ready: Promise<Session> | undefined;
const post = (message: unknown, transfer: Transferable[] = []) => (self as unknown as Worker).postMessage(message, transfer);

async function open(gpu: boolean) {
  const info = await (await fetch(`${MODEL_DIR}model.json`)).json();
  const bytes = await loadModel(
    info.parts.map((p: string) => MODEL_DIR + p),
    info.bytes,
    (loaded, total, fromCache) => post({ type: 'progress', loaded, total, fromCache }),
  );
  post({ type: 'status', text: 'Preparing the model...' });
  return createSession(bytes, gpu, (text) => post({ type: 'status', text }));
}

async function upscale({ session, ort, backend }: Session, image: ImageBitmap, id: number) {
  const width = image.width;
  const height = image.height;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  image.close();
  const src = ctx.getImageData(0, 0, width, height).data;
  canvas.width = canvas.height = 0;
  const outW = width * SCALE;
  const outH = height * SCALE;
  const out = new Uint8ClampedArray(outW * outH * 4);
  const tile = backend === 'webgpu' ? 256 : 160;
  const tiles: [number, number][] = [];
  for (let y = 0; y < height; y += tile) for (let x = 0; x < width; x += tile) tiles.push([x, y]);
  for (const [n, [tx, ty]] of tiles.entries()) {
    // Read the tile plus a margin so seams between tiles are invisible, then keep only the centre.
    const x0 = Math.max(0, tx - PAD);
    const y0 = Math.max(0, ty - PAD);
    const x1 = Math.min(width, tx + tile + PAD);
    const y1 = Math.min(height, ty + tile + PAD);
    const w = x1 - x0;
    const h = y1 - y0;
    const plane = w * h;
    const input = new Float32Array(plane * 3);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const s = ((y0 + y) * width + x0 + x) * 4;
        const d = y * w + x;
        input[d] = src[s] / 255;
        input[plane + d] = src[s + 1] / 255;
        input[2 * plane + d] = src[s + 2] / 255;
      }
    const tensor = new ort.Tensor('float32', input, [1, 3, h, w]);
    const result = await session.run({ [session.inputNames[0]]: tensor });
    tensor.dispose();
    const output = result[session.outputNames[0]];
    const data = output.data as Float32Array;
    const ow = w * SCALE;
    const oplane = ow * h * SCALE;
    const keepX0 = (tx - x0) * SCALE;
    const keepY0 = (ty - y0) * SCALE;
    const keepW = Math.min(tile, width - tx) * SCALE;
    const keepH = Math.min(tile, height - ty) * SCALE;
    for (let y = 0; y < keepH; y++)
      for (let x = 0; x < keepW; x++) {
        const s = (keepY0 + y) * ow + keepX0 + x;
        const d = ((ty * SCALE + y) * outW + tx * SCALE + x) * 4;
        out[d] = data[s] * 255;
        out[d + 1] = data[oplane + s] * 255;
        out[d + 2] = data[2 * oplane + s] * 255;
        out[d + 3] = 255;
      }
    output.dispose();
    post({ type: 'tile', id, done: n + 1, total: tiles.length });
  }
  post({ type: 'image', id, pixels: out, width: outW, height: outH }, [out.buffer]);
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  try {
    if (data.type === 'load') {
      ready ||= open(data.gpu);
      const session = await ready.catch((error) => {
        ready = undefined;
        throw error;
      });
      post({ type: 'ready', backend: session.backend });
      return;
    }
    if (!ready) throw new Error('The model is not loaded yet.');
    await upscale(await ready, data.image, data.id);
  } catch (error) {
    post({ type: 'error', id: (data as any).id, message: error instanceof Error ? error.message : String(error) });
  }
};
