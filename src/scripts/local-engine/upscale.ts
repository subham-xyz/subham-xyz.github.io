// Main-thread side of AI upscaling: drives the tiled worker and assembles the final canvas.
import { createAIClient, type AIEvents } from './ai-client';

export const MODEL_URL = '/models/esrgan/model.json';
/** Input limit: a 1 MP image becomes 16 MP at 4x, which is near the safe canvas size on phones. */
export const MAX_INPUT_PIXELS = 1_000_000;

export function createUpscaler(events: AIEvents = {}) {
  const client = createAIClient(
    () => new Worker(new URL('./upscale.worker.ts', import.meta.url), { type: 'module' }),
    events,
  );
  return Object.assign(client, {
    upscale: (image: ImageBitmap) =>
      client.run<{ pixels: Uint8ClampedArray; width: number; height: number }>({ image }, 'image', [image]),
  });
}

/**
 * Builds the output canvas from the model's 4x pixels: scaled to 2x on request, and with the
 * source's transparency (smoothly enlarged) when it had any. The model itself works on colour only.
 */
export function finish(
  source: ImageBitmap,
  result: { pixels: Uint8ClampedArray; width: number; height: number },
  scale: 2 | 4,
  transparent: boolean,
) {
  const full = document.createElement('canvas');
  full.width = result.width;
  full.height = result.height;
  full.getContext('2d')!.putImageData(new ImageData(result.pixels as Uint8ClampedArray<ArrayBuffer>, result.width, result.height), 0, 0);
  let out = full;
  if (scale === 2) {
    out = document.createElement('canvas');
    out.width = source.width * 2;
    out.height = source.height * 2;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(full, 0, 0, out.width, out.height);
    full.width = full.height = 0;
  }
  if (transparent) {
    const ctx = out.getContext('2d')!;
    ctx.globalCompositeOperation = 'destination-in';
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, 0, 0, out.width, out.height);
    ctx.globalCompositeOperation = 'source-over';
  }
  return out;
}

export function hasTransparency(image: ImageBitmap) {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0);
  const { data } = ctx.getImageData(0, 0, image.width, image.height);
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true;
  return false;
}
