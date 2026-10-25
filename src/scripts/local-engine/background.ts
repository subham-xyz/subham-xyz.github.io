// Main-thread side of background removal: drives the worker and composites the mask.
import { createAIClient, type AIEvents } from './ai-client';

export const MODEL_PARTS_URL = '/models/isnet/model.json';
/** Largest output side; bigger photos are scaled down to keep memory use safe. */
export const MAX_SIDE = 4096;

export function createRemover(events: AIEvents = {}) {
  const client = createAIClient(
    () => new Worker(new URL('./background.worker.ts', import.meta.url), { type: 'module' }),
    events,
  );
  return Object.assign(client, {
    remove: (image: ImageBitmap) =>
      client.run<{ mask: Uint8ClampedArray; size: number; ms: number }>({ image }, 'mask', [image]),
  });
}

/** Draws `source` with the model mask as its alpha channel; fills behind it when `background` is a colour. */
export function composite(
  source: CanvasImageSource & { width: number; height: number },
  mask: Uint8ClampedArray,
  size: number,
  background?: string,
) {
  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.round(source.width * scale);
  const height = Math.round(source.height * scale);
  const alpha = document.createElement('canvas');
  alpha.width = alpha.height = size;
  const pixels = new ImageData(size, size);
  for (let i = 0; i < mask.length; i++) pixels.data[i * 4 + 3] = mask[i];
  alpha.getContext('2d')!.putImageData(pixels, 0, 0);
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(alpha, 0, 0, width, height);
  if (background) {
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
  }
  alpha.width = alpha.height = 0;
  return { canvas: out, scaled: scale < 1 };
}
