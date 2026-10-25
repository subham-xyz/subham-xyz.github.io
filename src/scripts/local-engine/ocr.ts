// Local OCR with tesseract.js. Recognition runs in tesseract's own Web Worker; the worker,
// WebAssembly core and language data are all served from /local-engine/tesseract/.
import { createWorker, OEM, PSM, type Worker as TesseractWorker } from 'tesseract.js';
import { getLocalCapabilities } from './capabilities';
import { CancelledError } from './processing-errors';

export const OCR_LANGUAGES = {
  eng: 'English',
  spa: 'Spanish',
  fra: 'French',
  deu: 'German',
  por: 'Portuguese',
  ita: 'Italian',
} as const;
export type OcrLanguage = keyof typeof OCR_LANGUAGES;

/** One recognised word in image pixels, with the baseline of its line at the word's left and right edges. */
export type OcrWord = {
  text: string;
  confidence: number;
  x0: number;
  x1: number;
  top: number;
  bottom: number;
  baseLeft: number;
  baseRight: number;
};
export type OcrPage = { text: string; confidence: number; words: OcrWord[] };

const BASE = '/local-engine/tesseract';

export type OcrEngine = {
  /** Rejects with CancelledError as soon as `signal` aborts (the engine must then be terminated). */
  recognize(
    image: HTMLCanvasElement | OffscreenCanvas | Blob,
    onProgress?: (fraction: number) => void,
    signal?: AbortSignal,
  ): Promise<OcrPage>;
  terminate(): Promise<void>;
};

const cancellable = <T>(work: Promise<T>, signal?: AbortSignal) =>
  signal
    ? Promise.race([
        work,
        new Promise<never>((_, reject) => {
          if (signal.aborted) reject(new CancelledError());
          signal.addEventListener('abort', () => reject(new CancelledError()), { once: true });
        }),
      ])
    : work;

export async function createOcr(
  language: OcrLanguage,
  onStatus?: (text: string) => void,
): Promise<OcrEngine> {
  const caps = await getLocalCapabilities();
  let pageProgress: ((fraction: number) => void) | undefined;
  onStatus?.('Starting the OCR engine...');
  const worker: TesseractWorker = await createWorker(language, OEM.LSTM_ONLY, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/${caps.simd ? 'tesseract-core-simd-lstm.js' : 'tesseract-core-lstm.js'}`,
    langPath: `${BASE}/lang`,
    gzip: true,
    workerBlobURL: false,
    // Language data is kept in IndexedDB after the first download.
    cacheMethod: 'write',
    logger: (m) => {
      if (m.status === 'recognizing text') pageProgress?.(m.progress);
      else if (/loading language|loading tesseract core/.test(m.status) && m.progress < 1)
        onStatus?.(`Loading the ${OCR_LANGUAGES[language]} OCR model... ${Math.round(m.progress * 100)}%`);
    },
    errorHandler: () => {},
  });
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: '1' });
  return {
    async recognize(image, onProgress, signal) {
      pageProgress = onProgress;
      const { data } = await cancellable(worker.recognize(image as any, {}, { text: true, blocks: true }), signal);
      pageProgress = undefined;
      const words: OcrWord[] = [];
      for (const block of data.blocks || [])
        for (const paragraph of block.paragraphs)
          for (const line of paragraph.lines) {
            const b = line.baseline;
            const slope = b.x1 !== b.x0 ? (b.y1 - b.y0) / (b.x1 - b.x0) : 0;
            const baseAt = (x: number) => (b.x1 > b.x0 ? b.y0 + slope * (x - b.x0) : line.bbox.y1);
            for (const word of line.words) {
              const text = word.text.trim();
              if (!text || word.confidence < 20) continue;
              words.push({
                text,
                confidence: word.confidence,
                x0: word.bbox.x0,
                x1: word.bbox.x1,
                // The line's top gives a steadier letter height than each word's own box.
                top: Math.min(line.bbox.y0, word.bbox.y0),
                bottom: word.bbox.y1,
                baseLeft: baseAt(word.bbox.x0),
                baseRight: baseAt(word.bbox.x1),
              });
            }
          }
      return { text: data.text || '', confidence: data.confidence || 0, words };
    },
    terminate: () => worker.terminate().then(() => {}),
  };
}
