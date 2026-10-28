// Copies the self-hosted runtimes used by the local engine into public/local-engine/.
// Everything is served from this site; nothing is fetched from a CDN at runtime.
//   tesseract/  tesseract.js worker + LSTM core (Apache-2.0) and language data (tessdata, Apache-2.0)
//   ort/        onnxruntime-web 1.22 (MIT): WebGPU+CPU build and CPU-only build (each under 25 MB)
//   qpdf/       qpdf 12 compiled to WebAssembly (Apache-2.0)
//   ffmpeg/     FFmpeg 5.1 compiled to WebAssembly by ffmpeg.wasm (@ffmpeg/core, GPL-2.0-or-later,
//               single-thread build). Source: https://github.com/ffmpegwasm/ffmpeg.wasm
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';

const out = 'public/local-engine';
const copies = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'tesseract/worker.min.js'],
  ['node_modules/tesseract.js/LICENSE.md', 'tesseract/LICENSE.md'],
  ...['tesseract-core-simd-lstm', 'tesseract-core-lstm'].flatMap((name) => [
    [`node_modules/tesseract.js-core/${name}.js`, `tesseract/${name}.js`],
    [`node_modules/tesseract.js-core/${name}.wasm`, `tesseract/${name}.wasm`],
  ]),
  ...['eng', 'spa', 'fra', 'deu', 'por', 'ita'].map((lang) => [
    `node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`,
    `tesseract/lang/${lang}.traineddata.gz`,
  ]),
  ...['ort-wasm-simd-threaded.jsep', 'ort-wasm-simd-threaded'].flatMap((name) => [
    [`node_modules/onnxruntime-web/dist/${name}.mjs`, `ort/${name}.mjs`],
    [`node_modules/onnxruntime-web/dist/${name}.wasm`, `ort/${name}.wasm`],
  ]),
  ['node_modules/onnxruntime-web/dist/ort.webgpu.min.mjs', 'ort/ort.webgpu.min.mjs'],
  ['node_modules/onnxruntime-web/dist/ort.wasm.min.mjs', 'ort/ort.wasm.min.mjs'],
  ['node_modules/@neslinesli93/qpdf-wasm/dist/qpdf.wasm', 'qpdf/qpdf.wasm'],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.js', 'ffmpeg/ffmpeg-core.js'],
  ['node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'ffmpeg/ffmpeg-core.wasm'],
];
for (const [from, to] of copies) {
  const target = `${out}/${to}`;
  await mkdir(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  await cp(from, target);
}
const tesseractLicense = await readFile('node_modules/tesseract.js-core/LICENSE', 'utf8').catch(() => '');
if (tesseractLicense) await writeFile(`${out}/tesseract/LICENSE-core.txt`, tesseractLicense);
await writeFile(
  `${out}/NOTICE.txt`,
  [
    'Local processing runtimes served by KittySuite',
    '',
    'onnxruntime-web 1.22.0 - MIT License - Copyright (c) Microsoft Corporation - https://github.com/microsoft/onnxruntime',
    'tesseract.js 7 and tesseract.js-core 6 - Apache License 2.0 - https://github.com/naptha/tesseract.js',
    'Tesseract language data (tessdata 4.0.0_best_int) - Apache License 2.0 - https://github.com/tesseract-ocr/tessdata',
    'qpdf 12 (WebAssembly build @neslinesli93/qpdf-wasm, ISC) - Apache License 2.0 - https://github.com/qpdf/qpdf',
    'FFmpeg 5.1 with x264, LAME, libvpx, Opus, Vorbis, Theora and others (WebAssembly build @ffmpeg/core 0.12.10) - GNU General Public License v2.0 or later - https://ffmpeg.org/legal.html',
    '  Complete corresponding source code and build scripts: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/v0.12.10 (packages/core) and https://ffmpeg.org/download.html',
    '',
  ].join('\n'),
);
