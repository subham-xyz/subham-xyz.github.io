// FFmpeg recipes for every media tool. Each recipe gets a context (see
// recipe-context.mjs), the chosen options and the probed input info, runs one
// or more commands, and returns the finished files. Long or memory-hungry work
// is split into chunks (reverse, frame export, splitting) so phones can finish.
import { MediaError } from './media-errors.mjs';
import { displaySize } from './probe.mjs';

// ---------------------------------------------------------------- helpers

const extOf = (name) => (name.match(/\.([a-z0-9]+)$/i)?.[1] || '').toLowerCase();
export const safeBase = (name) =>
  (name.replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|%\u0000-\u001f]+/g, '-').replace(/^[-. ]+|[-. ]+$/g, '').slice(0, 80) || 'media');
/** Output name; a result in the same format as its input gets a suffix so it never repeats the original's name. */
const renamed = (name, ext, suffix) => `${safeBase(name)}${extOf(name) === ext ? `-${suffix}` : ''}.${ext}`;
const fixed = (n, d = 3) => String(Math.round(n * 10 ** d) / 10 ** d);
const EVEN = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
const H264 = (crf = 23) => ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', String(crf), '-pix_fmt', 'yuv420p'];
const AAC = (kbps = 160) => ['-c:a', 'aac', '-b:a', `${kbps}k`];
const FASTSTART = ['-movflags', '+faststart'];
// FFmpeg's own Opus encoder: the WebAssembly build of libopus crashes on stereo input.
const OPUS = (bitrate) => ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', bitrate];

function videoKbps(info) {
  const v = info?.video;
  const pixels = (v?.width || 1280) * (v?.height || 720) * Math.min(60, v?.fps || 30);
  return Math.round(Math.min(16000, Math.max(300, (pixels * 0.08) / 1000)));
}

// Containers KittySuite writes, how to encode into them and what can be copied.
const VIDEO = {
  mp4: { v: () => H264(), a: () => AAC(), extra: FASTSTART, copyV: /^(h264|hevc|mpeg4|av1)$/, copyA: /^(aac|mp3|ac3|eac3|alac|opus|flac)$/ },
  mov: { v: () => H264(), a: () => AAC(), extra: FASTSTART, copyV: /^(h264|hevc|mpeg4|prores|mjpeg)$/, copyA: /^(aac|mp3|alac|pcm_s16le|pcm_s24le)$/ },
  mkv: { v: () => H264(), a: () => AAC(), extra: [], copyV: /./, copyA: /./ },
  webm: {
    v: (info) => ['-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '10', '-b:v', `${videoKbps(info)}k`, '-pix_fmt', 'yuv420p'],
    a: () => OPUS('128k'),
    extra: [],
    copyV: /^(vp8|vp9|av1)$/,
    copyA: /^(opus|vorbis)$/,
  },
  avi: { v: () => ['-c:v', 'mpeg4', '-q:v', '4'], a: () => ['-c:a', 'libmp3lame', '-q:a', '4'], extra: [], copyV: /^(mpeg4|h264|mjpeg)$/, copyA: /^(mp3|ac3|pcm_s16le)$/ },
};
/** The container to keep when a tool edits a video in place. */
const keepContainer = (name) => (['mp4', 'mov', 'mkv', 'webm', 'avi'].includes(extOf(name)) ? extOf(name) : extOf(name) === 'm4v' ? 'mp4' : 'mp4');

const QUALITY = { high: 0, standard: 1, small: 2 };
const AUDIO = {
  mp3: (q) => ['-c:a', 'libmp3lame', '-b:a', ['320k', '192k', '128k'][q]],
  m4a: (q) => ['-c:a', 'aac', '-b:a', ['256k', '160k', '96k'][q], ...FASTSTART],
  wav: () => ['-c:a', 'pcm_s16le'],
  ogg: (q) => ['-c:a', 'libvorbis', '-q:a', ['7', '5', '3'][q]],
  opus: (q) => OPUS(['192k', '128k', '64k'][q]),
  flac: () => ['-c:a', 'flac'],
  aiff: () => ['-c:a', 'pcm_s16be'],
};
// Edits of lossy audio match the source bitrate (rounded up to a common step)
// instead of always using the highest preset, so an edit never inflates a file.
const STEPS = { mp3: [96, 128, 160, 192, 256, 320], m4a: [96, 128, 160, 192, 256], opus: [64, 96, 128, 160, 192] };
const sourceKbps = (input) => {
  const bits = input.info.audio?.bitrate || (input.info.video ? 0 : input.info.bitrate);
  return bits ? bits / 1000 : 0;
};
function audioCodec(ext, kbps) {
  if (!kbps) return AUDIO[ext](QUALITY.high);
  if (ext === 'ogg') return ['-c:a', 'libvorbis', '-q:a', kbps <= 112 ? '3' : kbps <= 160 ? '5' : '7'];
  const steps = STEPS[ext];
  if (!steps) return AUDIO[ext](QUALITY.high); // lossless formats
  const rate = `${steps.find((s) => s >= kbps * 0.95) ?? steps[steps.length - 1]}k`;
  if (ext === 'mp3') return ['-c:a', 'libmp3lame', '-b:a', rate];
  if (ext === 'm4a') return ['-c:a', 'aac', '-b:a', rate, ...FASTSTART];
  return OPUS(rate);
}
const AUDIO_EXT = { mp3: 'mp3', m4a: 'm4a', aac: 'm4a', mp4: 'm4a', wav: 'wav', ogg: 'ogg', oga: 'ogg', opus: 'opus', flac: 'flac', aif: 'aiff', aiff: 'aiff' };
const AUDIO_MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', aiff: 'audio/aiff', mka: 'audio/x-matroska', ac3: 'audio/ac3' };

/**
 * Where an audio-processing tool writes: audio files keep their format; video
 * files keep their picture (copied, not re-encoded) and get new audio.
 */
function audioTarget(input) {
  const ext = extOf(input.name);
  if (input.info.video && !input.info.still) {
    const container = keepContainer(input.name);
    return { ext: container, video: true, codec: [...VIDEO[container].a(), ...VIDEO[container].extra] };
  }
  const audio = AUDIO_EXT[ext] || 'm4a';
  return { ext: audio, video: false, codec: audioCodec(audio, sourceKbps(input)) };
}
const audioMaps = (t) => (t.video ? ['-map', '0:v?', '-map', '0:a', '-c:v', 'copy'] : ['-map', '0:a', '-vn']);
function needAudio(input) {
  if (!input.info.audio) throw new MediaError('This file has no audio track.');
}
function needVideo(input) {
  if (!input.info.video) throw new MediaError('This file has no video track.');
}
const durationOf = (input) => input.info.duration || 0;
function range(input, o) {
  const total = durationOf(input);
  const start = Math.max(0, Number(o.start) || 0);
  const end = o.end === 'end' || o.end === undefined || o.end === '' ? total : Number(o.end);
  if (!(end > start)) throw new MediaError('The end must be after the start.');
  if (total && start >= total) throw new MediaError('The start is after the end of the file.');
  return { start, end: total ? Math.min(end, total) : end, length: (total ? Math.min(end, total) : end) - start };
}
const seek = (start, length) => [...(start > 0 ? ['-ss', fixed(start)] : []), ...(length > 0 ? ['-t', fixed(length)] : [])];

/** Two-pass GIF: a palette from the frames, then the frames mapped to it (no buffering). */
async function gifPasses(ctx, input, filters, outName, { colors = 256, seekArgs = [], duration } = {}) {
  const palette = ctx.tmp('palette.png');
  await ctx.exec([...seekArgs, '-i', input.path, '-vf', `${filters},palettegen=max_colors=${colors}:stats_mode=diff`, '-frames:v', '1', '-update', '1', palette], { duration, phase: 'analyzing' });
  await ctx.exec(
    [...seekArgs, '-i', input.path, '-i', palette, '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`, '-loop', '0', ctx.out(outName)],
    { duration, phase: 'encoding' },
  );
}

// ---------------------------------------------------------------- recipes

export const recipes = {
  async 'video-converter'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const target = VIDEO[o.format] ? o.format : 'mp4';
    const f = VIDEO[target];
    const { video, audio } = input.info;
    const name = renamed(input.name, target, 'converted');
    const duration = durationOf(input);
    ctx.steps(2);
    // Same codecs, new container: copy the streams (fast and lossless).
    if (f.copyV.test(video.codec) && (!audio || f.copyA.test(audio.codec))) {
      const copied = await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-c', 'copy', ...f.extra, ctx.out(name)], { duration, weight: 2, allowFail: true });
      if (copied) return ctx.finish([name]);
      await ctx.remove(name);
    }
    await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-vf', EVEN, ...f.v(input.info), ...(audio ? f.a() : []), ...f.extra, ctx.out(name)], { duration, weight: 2, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'compress-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const duration = durationOf(input);
    const name = `${safeBase(input.name)}-compressed.mp4`;
    const crf = { high: 24, balanced: 28, small: 32 }[o.quality] || 28;
    const filters = [];
    const height = Number(o.height);
    if (height) filters.push(`scale='if(gt(iw,ih),-2,min(iw,${height}))':'if(gt(iw,ih),min(ih,${height}),-2)'`);
    filters.push(EVEN);
    const audioArgs = o.mute || !input.info.audio ? ['-an'] : AAC(o.quality === 'small' ? 64 : 96);
    let rate = ['-crf', String(crf)];
    const target = Number(o.target);
    if (target > 0) {
      if (!duration) throw new MediaError('The video length could not be read, so a target size cannot be used. Clear the target size and try again.');
      const audioKbps = audioArgs[0] === '-an' ? 0 : Number(audioArgs.at(-1).replace('k', ''));
      const totalKbps = (target * 8 * 1024) / duration;
      const videoKbits = Math.floor(totalKbps * 0.97 - audioKbps);
      if (videoKbits < 40)
        throw new MediaError(`${target} MB is too small for a ${Math.round(duration)}-second video. Choose a larger target, a lower resolution or remove the audio.`);
      rate = ['-b:v', `${videoKbits}k`, '-maxrate', `${Math.round(videoKbits * 1.3)}k`, '-bufsize', `${videoKbits * 2}k`];
    }
    await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-vf', filters.join(','), '-c:v', 'libx264', '-preset', 'veryfast', ...rate, '-pix_fmt', 'yuv420p', ...audioArgs, ...FASTSTART, ctx.out(name)], { duration, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'trim-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const { start, length } = range(input, o);
    if (o.mode === 'fast') {
      const ext = keepContainer(input.name);
      const name = `${safeBase(input.name)}-trimmed.${ext}`;
      await ctx.exec([...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', ...VIDEO[ext].extra, ctx.out(name)], { duration: length });
      return ctx.finish([name]);
    }
    const name = `${safeBase(input.name)}-trimmed.mp4`;
    await ctx.exec([...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0:v:0', '-map', '0:a?', '-vf', EVEN, ...H264(20), ...(input.info.audio ? AAC() : []), ...FASTSTART, ctx.out(name)], { duration: length, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'mute-video'(ctx) {
    const input = ctx.input;
    needVideo(input);
    const ext = keepContainer(input.name);
    const name = `${safeBase(input.name)}-muted.${ext}`;
    const ok = await ctx.exec(['-i', input.path, '-map', '0:v', '-c', 'copy', '-an', ...VIDEO[ext].extra, ctx.out(name)], { duration: durationOf(input), allowFail: true });
    if (!ok) {
      await ctx.remove(name);
      await ctx.exec(['-i', input.path, '-map', '0:v:0', '-vf', EVEN, ...VIDEO[ext].v(input.info), '-an', ...VIDEO[ext].extra, ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    }
    return ctx.finish([name]);
  },

  async 'resize-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    let filter;
    if (o.size === 'custom') {
      const w = Math.round(Number(o.width) / 2) * 2;
      const h = Math.round(Number(o.height) / 2) * 2;
      if (!(w >= 2 && h >= 2)) throw new MediaError('Enter a width and height of at least 2 pixels.');
      filter = `scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
    } else {
      const short = Number(o.size) || 720;
      filter = `scale='if(gt(iw,ih),-2,${short})':'if(gt(iw,ih),${short},-2)'`;
    }
    const name = `${safeBase(input.name)}-${o.size === 'custom' ? `${o.width}x${o.height}` : `${o.size}p`}.mp4`;
    await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-vf', `${filter},${EVEN}`, ...H264(21), ...(input.info.audio ? AAC() : []), ...FASTSTART, ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'crop-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const [a, b] = String(o.ratio || '1:1').split(':').map(Number);
    const crop = `crop='trunc(min(iw,ih*${a}/${b})/2)*2':'trunc(min(ih,iw*${b}/${a})/2)*2'`;
    const name = `${safeBase(input.name)}-${a}x${b}.mp4`;
    await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-vf', crop, ...H264(20), ...(input.info.audio ? AAC() : []), ...FASTSTART, ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'rotate-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const filter = { cw: 'transpose=1', ccw: 'transpose=2', 180: 'transpose=1,transpose=1', hflip: 'hflip', vflip: 'vflip' }[o.turn] || 'transpose=1';
    const name = `${safeBase(input.name)}-rotated.mp4`;
    await ctx.exec(['-i', input.path, '-map', '0:v:0', '-map', '0:a?', '-vf', `${filter},${EVEN}`, ...H264(20), ...(input.info.audio ? ['-c:a', 'copy'] : []), ...FASTSTART, ctx.out(name)], { duration: durationOf(input), phase: 'encoding', allowFail: false });
    return ctx.finish([name]);
  },

  async 'change-speed'(ctx, o) {
    const input = ctx.input;
    const speed = Number(o.speed) || 2;
    const duration = durationOf(input) / speed;
    // atempo accepts 0.5–2 per stage; chain stages for larger changes.
    const tempo = [];
    for (let s = speed; Math.abs(s - 1) > 1e-6; ) {
      const step = Math.min(2, Math.max(0.5, s));
      tempo.push(`atempo=${fixed(step, 4)}`);
      s /= step;
    }
    const label = `${String(speed).replace('.', '_')}x`;
    if (!input.info.video || input.info.still) {
      needAudio(input);
      const t = audioTarget(input);
      const name = `${safeBase(input.name)}-${label}.${t.ext}`;
      await ctx.exec(['-i', input.path, '-map', '0:a', '-vn', '-af', tempo.join(',') || 'anull', ...t.codec, ctx.out(name)], { duration });
      return ctx.finish([name]);
    }
    const name = `${safeBase(input.name)}-${label}.mp4`;
    const withAudio = input.info.audio && !o.mute;
    const args = ['-i', input.path, '-filter_complex', `[0:v]setpts=PTS/${fixed(speed, 4)},${EVEN}[v]${withAudio ? `;[0:a]${tempo.join(',') || 'anull'}[a]` : ''}`, '-map', '[v]', ...(withAudio ? ['-map', '[a]', ...AAC()] : ['-an']), ...H264(21), ...FASTSTART, ctx.out(name)];
    await ctx.exec(args, { duration, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'reverse-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const total = durationOf(input);
    if (!total) throw new MediaError('The video length could not be read, so it cannot be reversed. Try Repair Video first.');
    const v = displaySize(input.info);
    const frameBytes = v.width * v.height * 1.5;
    // Reversing buffers every frame of a chunk; size chunks to about 96 MB of frames.
    const chunk = Math.max(0.5, Math.min(10, 96e6 / (frameBytes * (input.info.video.fps || 30))));
    const count = Math.ceil(total / chunk);
    const audio = input.info.audio && o.audio;
    ctx.steps(count + 1);
    const parts = [];
    for (let i = count - 1; i >= 0; i--) {
      const start = i * chunk;
      const length = Math.min(chunk, total - start);
      if (length <= 0.01) continue;
      const part = `part-${String(count - 1 - i).padStart(5, '0')}.mp4`;
      parts.push(part);
      await ctx.exec([...seek(start, length), '-i', input.path, '-map', '0:v:0', ...(audio ? ['-map', '0:a:0', '-af', 'areverse', ...AAC()] : ['-an']), '-vf', `reverse,${EVEN}`, ...H264(20), '-r', String(Math.round(input.info.video.fps || 30)), ctx.tmp(part)], { duration: length, phase: 'encoding' });
    }
    await ctx.write('/work/list.txt', parts.map((p) => `file '/out/${p}'`).join('\n'));
    const name = `${safeBase(input.name)}-reversed.mp4`;
    await ctx.exec(['-f', 'concat', '-safe', '0', '-i', '/work/list.txt', '-c', 'copy', ...FASTSTART, ctx.out(name)], { duration: total, phase: 'writing' });
    return ctx.finish([name]);
  },

  async 'boomerang-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const length = Math.max(0.2, Number(o.length) || 2);
    const start = Math.max(0, Number(o.start) || 0);
    const loops = Math.max(1, Number(o.loops) || 3);
    const fps = Math.round(input.info.video.fps || 30);
    const frames = Math.ceil(length * fps) * 2;
    const name = `${safeBase(input.name)}-boomerang.mp4`;
    await ctx.exec([...seek(start, length), '-i', input.path, '-filter_complex', `[0:v]fps=${fps},${EVEN},split[f][b];[b]reverse[r];[f][r]concat=n=2:v=1:a=0,loop=loop=${loops - 1}:size=${frames}:start=0[v]`, '-map', '[v]', '-an', ...H264(20), ...FASTSTART, ctx.out(name)], { duration: length * 2 * loops, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'video-to-gif'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const { start, length } = range(input, o);
    const fps = Number(o.fps) || 12;
    const width = o.width === 'keep' ? 'iw' : Number(o.width) || 480;
    const filters = `fps=${fps},scale=${width}:-1:flags=lanczos`;
    const name = `${safeBase(input.name)}.gif`;
    ctx.steps(2);
    await gifPasses(ctx, input, filters, name, { seekArgs: seek(start, length), duration: length });
    return ctx.finish([name]);
  },

  async 'gif-to-mp4'(ctx) {
    const input = ctx.input;
    const name = `${safeBase(input.name)}.mp4`;
    await ctx.exec(['-i', input.path, '-vf', EVEN, ...H264(20), '-an', ...FASTSTART, ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'extract-audio'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    if (o.format === 'original') {
      const codec = input.info.audio.codec;
      const ext = { aac: 'm4a', mp3: 'mp3', opus: 'opus', vorbis: 'ogg', flac: 'flac', ac3: 'ac3', alac: 'm4a' }[codec] || (codec.startsWith('pcm_') ? 'wav' : 'mka');
      const name = renamed(input.name, ext, 'audio');
      await ctx.exec(['-i', input.path, '-map', '0:a:0', '-vn', '-c:a', 'copy', ctx.out(name)], { duration: durationOf(input) });
      return ctx.finish([name]);
    }
    const ext = AUDIO[o.format] ? o.format : 'mp3';
    const name = renamed(input.name, ext, 'audio');
    await ctx.exec(['-i', input.path, '-map', '0:a:0', '-vn', ...AUDIO[ext](QUALITY.standard), ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'video-to-images'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const total = durationOf(input);
    // FFmpeg writes PNG; JPG is made by the browser's own encoder (see engine.ts:
    // FFmpeg's MJPEG encoder fails in browser WebAssembly).
    const jpeg = o.format !== 'png';
    const rate = o.every === 'all' ? null : `fps=1/${o.every || 1}`;
    const base = safeBase(input.name);
    // Frames are written window by window and moved off the engine after each
    // window, so a long video never holds all its images in memory at once.
    const window = o.every === 'all' ? 10 : 120;
    const windows = Math.max(1, Math.ceil(total / window) || 1);
    ctx.steps(windows);
    let number = 1;
    for (let w = 0; w < windows; w++) {
      const start = w * window;
      const length = Math.min(window, total - start);
      const filter = [rate, 'scale=trunc(iw/2)*2:trunc(ih/2)*2'].filter(Boolean).join(',');
      await ctx.exec([...(total ? seek(start, length) : []), '-i', input.path, '-vf', filter, ...(o.every === 'all' ? ['-vsync', '0'] : []), '-start_number', String(number), `/out/${base}-%05d.png`], { duration: length || total });
      const made = await ctx.listOut();
      number += made.length;
      await ctx.collect(made, { jpeg });
    }
    return ctx.finish([]);
  },

  async 'join-videos'(ctx) {
    const inputs = ctx.inputs;
    if (inputs.length < 2) throw new MediaError('Choose at least two videos to join.');
    inputs.forEach(needVideo);
    const first = displaySize(inputs[0].info);
    const W = Math.round(first.width / 2) * 2;
    const H = Math.round(first.height / 2) * 2;
    const fps = Math.round(inputs[0].info.video.fps || 30);
    const total = inputs.reduce((n, i) => n + durationOf(i), 0);
    const name = `${safeBase(inputs[0].name)}-joined.mp4`;
    // Same codec, size and frame rate everywhere: join without re-encoding.
    const same = inputs.every((i) => {
      const v = i.info.video;
      return v.codec === inputs[0].info.video.codec && v.width === inputs[0].info.video.width && v.height === inputs[0].info.video.height && Math.round(v.fps || 0) === Math.round(inputs[0].info.video.fps || 0) && (i.info.audio?.codec || '') === (inputs[0].info.audio?.codec || '');
    });
    if (same && /^(h264|hevc|mpeg4)$/.test(inputs[0].info.video.codec)) {
      await ctx.write('/work/list.txt', inputs.map((i) => `file '${i.path}'`).join('\n'));
      if (await ctx.exec(['-f', 'concat', '-safe', '0', '-i', '/work/list.txt', '-c', 'copy', ...FASTSTART, ctx.out(name)], { duration: total, allowFail: true })) return ctx.finish([name]);
      await ctx.remove(name);
    }
    const anyAudio = inputs.some((i) => i.info.audio);
    const args = [];
    inputs.forEach((i) => args.push('-i', i.path));
    let silent = inputs.length;
    const parts = [];
    const graph = inputs.map((input, n) => {
      let s = `[${n}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${fps},format=yuv420p[v${n}]`;
      if (anyAudio) {
        if (input.info.audio) s += `;[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo[a${n}]`;
        else {
          args.push('-f', 'lavfi', '-t', fixed(durationOf(input) || 1), '-i', 'anullsrc=r=48000:cl=stereo');
          s += `;[${silent++}:a]anull[a${n}]`;
        }
      }
      parts.push(`[v${n}]${anyAudio ? `[a${n}]` : ''}`);
      return s;
    });
    const filter = `${graph.join(';')};${parts.join('')}concat=n=${inputs.length}:v=1:a=${anyAudio ? 1 : 0}[v]${anyAudio ? '[a]' : ''}`;
    await ctx.exec([...args, '-filter_complex', filter, '-map', '[v]', ...(anyAudio ? ['-map', '[a]', ...AAC()] : []), ...H264(21), ...FASTSTART, ctx.out(name)], { duration: total, phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'replace-audio'(ctx, o) {
    const [video, audio] = ctx.inputs;
    needVideo(video);
    needAudio(audio);
    const ext = keepContainer(video.name);
    const f = VIDEO[ext];
    const name = `${safeBase(video.name)}-new-audio.${ext}`;
    const duration = durationOf(video);
    if (o.mode === 'mix' && video.info.audio) {
      await ctx.exec(['-i', video.path, '-i', audio.path, '-filter_complex', '[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0[a]', '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', ...f.a(), ...f.extra, ctx.out(name)], { duration });
    } else {
      await ctx.exec(['-i', video.path, '-i', audio.path, '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', ...f.a(), ...(duration ? ['-t', fixed(duration)] : ['-shortest']), ...f.extra, ctx.out(name)], { duration });
    }
    return ctx.finish([name]);
  },

  async 'split-video'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    return splitInto(ctx, input, o, (start, length, out) => {
      if (o.mode === 'exact') return [...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0:v:0', '-map', '0:a?', '-vf', EVEN, ...H264(20), ...(input.info.audio ? AAC() : []), ...FASTSTART, out];
      const ext = keepContainer(input.name);
      return [...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0', '-c', 'copy', '-avoid_negative_ts', 'make_zero', ...VIDEO[ext].extra, out];
    }, o.mode === 'exact' ? 'mp4' : keepContainer(input.name));
  },

  async 'extract-subtitles'(ctx, o) {
    const input = ctx.input;
    const tracks = input.info.subtitles;
    if (!tracks.length) throw new MediaError('This video has no subtitle tracks. Burned-in subtitles are part of the picture and cannot be extracted.');
    const text = tracks.filter((t) => /^(subrip|srt|ass|ssa|mov_text|webvtt|text)$/.test(t.codec));
    if (!text.length) throw new MediaError('The subtitles in this video are pictures (DVD or Blu-ray style), not text, so they cannot be saved as SRT or WebVTT.');
    const ext = o.format === 'vtt' ? 'vtt' : 'srt';
    const names = [];
    ctx.steps(text.length);
    for (const track of text) {
      const label = [track.language, track.title].filter(Boolean).join('-').replace(/[^\w-]+/g, '') || `track${track.index + 1}`;
      const name = `${safeBase(input.name)}.${label}.${ext}`;
      names.push(name);
      await ctx.exec(['-i', input.path, '-map', `0:s:${track.index}`, '-c:s', ext === 'vtt' ? 'webvtt' : 'srt', ctx.out(name)]);
    }
    return ctx.finish(names);
  },

  async 'subtitle-converter'(ctx, o) {
    const input = ctx.input;
    const ext = ['srt', 'vtt', 'ass'].includes(o.format) ? o.format : 'srt';
    const offset = Number(o.offset) || 0;
    const name = renamed(input.name, ext, 'converted');
    await ctx.exec([...(offset ? ['-itsoffset', fixed(offset)] : []), '-i', input.path, '-c:s', { srt: 'srt', vtt: 'webvtt', ass: 'ass' }[ext], ctx.out(name)]);
    return ctx.finish([name]);
  },

  async 'burn-subtitles'(ctx, o) {
    const [video, subs] = ctx.inputs;
    needVideo(video);
    if (!subs) throw new MediaError('Choose the subtitle file first.');
    // libass draws the text into every frame. The engine has no system fonts, so
    // Lato (OFL: Latin, Greek, Cyrillic, Vietnamese) is loaded from this site.
    await ctx.write('/fonts/Lato.ttf', await ctx.asset('fonts/lato.ttf'));
    const isAss = /\.(ass|ssa)$/i.test(subs.name);
    // Sizes are relative to libass's 288-line script height, so they scale with the video.
    const size = { small: 15, medium: 19, large: 25 }[o.size] || 19;
    const style = isAss
      ? 'FontName=Lato'
      : `FontName=Lato,FontSize=${size},PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=1.4,Shadow=0,Alignment=${o.position === 'top' ? 6 : 2},MarginV=16`; // SSA alignment: 2 bottom centre, 6 top centre
    const name = `${safeBase(video.name)}-subtitled.mp4`;
    await ctx.exec(
      ['-i', video.path, '-map', '0:v:0', '-map', '0:a:0?', '-vf', `subtitles=${subs.path}:fontsdir=/fonts:force_style='${style}',${EVEN}`, ...H264(20), ...AAC(), ...FASTSTART, ctx.out(name)],
      { duration: durationOf(video), phase: 'encoding' },
    );
    return ctx.finish([name]);
  },

  async 'video-contact-sheet'(ctx, o) {
    const input = ctx.input;
    needVideo(input);
    const [cols, rows] = String(o.grid || '4x4').split('x').map(Number);
    const count = cols * rows;
    const total = durationOf(input);
    if (!total) throw new MediaError('The video length could not be read, so frames cannot be spaced evenly.');
    const width = Number(o.width) || 320;
    const name = `${safeBase(input.name)}-contact-sheet.png`;
    // One frame from the middle of each of `count` equal slices.
    const rate = `fps=${fixed(count / total, 6)}:start_time=${fixed(total / count / 2)}`;
    await ctx.exec(['-i', input.path, '-vf', `${rate},scale=${width}:-2,tile=${cols}x${rows}:margin=8:padding=8:color=white`, '-frames:v', '1', '-update', '1', ctx.out(name)], { duration: total, phase: 'processing' });
    // Saved as JPG by the browser's encoder (smaller than PNG for photos).
    return ctx.finish([name], { jpeg: true });
  },

  async 'repair-video'(ctx, o) {
    const input = ctx.input;
    const ext = keepContainer(input.name);
    const name = `${safeBase(input.name)}-repaired.${o.mode === 'reencode' ? 'mp4' : ext}`;
    const tolerant = ['-err_detect', 'ignore_err', '-fflags', '+genpts+discardcorrupt+igndts'];
    if (o.mode === 'reencode') {
      await ctx.exec([...tolerant, '-i', input.path, '-map', '0:v:0?', '-map', '0:a:0?', '-vf', EVEN, ...H264(21), ...AAC(), ...FASTSTART, ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    } else {
      await ctx.exec([...tolerant, '-i', input.path, '-map', '0:v?', '-map', '0:a?', '-c', 'copy', '-avoid_negative_ts', 'make_zero', ...VIDEO[ext].extra, ctx.out(name)], { duration: durationOf(input) });
    }
    return ctx.finish([name]);
  },

  async 'watermark-video'(ctx, o) {
    const [video, logo] = ctx.inputs;
    needVideo(video);
    const size = displaySize(video.info);
    const width = Math.max(2, Math.round((size.width * Math.min(100, Math.max(1, Number(o.size) || 15))) / 100 / 2) * 2);
    const margin = Math.round(Math.min(size.width, size.height) * 0.03);
    const xy = {
      'top-left': `${margin}:${margin}`,
      'top-right': `W-w-${margin}:${margin}`,
      center: '(W-w)/2:(H-h)/2',
      'bottom-left': `${margin}:H-h-${margin}`,
      'bottom-right': `W-w-${margin}:H-h-${margin}`,
    }[o.position] || `W-w-${margin}:H-h-${margin}`;
    const opacity = fixed(Math.min(100, Math.max(1, Number(o.opacity) || 80)) / 100, 2);
    const name = `${safeBase(video.name)}-watermarked.mp4`;
    await ctx.exec(['-i', video.path, '-i', logo.path, '-filter_complex', `[1:v]format=rgba,scale=${width}:-1,colorchannelmixer=aa=${opacity}[logo];[0:v][logo]overlay=${xy}:format=auto,${EVEN}[v]`, '-map', '[v]', '-map', '0:a?', ...H264(20), '-c:a', 'copy', ...FASTSTART, ctx.out(name)], { duration: durationOf(video), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'audio-converter'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const ext = AUDIO[o.format] ? o.format : 'mp3';
    const name = renamed(input.name, ext, 'converted');
    await ctx.exec(['-i', input.path, '-map', '0:a:0', '-vn', ...AUDIO[ext](QUALITY[o.quality] ?? 1), ctx.out(name)], { duration: durationOf(input), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'trim-audio'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const { start, length } = range(input, o);
    const t = audioTarget(input);
    const name = `${safeBase(input.name)}-trimmed.${t.ext}`;
    const fade = o.fade ? Math.min(0.5, length / 4) : 0;
    const af = fade ? ['-af', `afade=t=in:d=${fixed(fade)},afade=t=out:st=${fixed(length - fade)}:d=${fixed(fade)}`] : [];
    await ctx.exec([...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0:a:0', '-vn', ...af, ...audioCodec(t.ext === 'mp4' ? 'm4a' : t.ext, sourceKbps(input)), ctx.out(name)], { duration: length });
    return ctx.finish([name]);
  },

  async 'join-audio'(ctx, o) {
    const inputs = ctx.inputs;
    if (inputs.length < 2) throw new MediaError('Choose at least two audio files to join.');
    inputs.forEach(needAudio);
    const ext = AUDIO[o.format] ? o.format : 'mp3';
    const name = `${safeBase(inputs[0].name)}-joined.${ext}`;
    const args = [];
    inputs.forEach((i) => args.push('-i', i.path));
    const graph = inputs.map((_, n) => `[${n}:a]aformat=sample_rates=48000:channel_layouts=stereo[a${n}]`).join(';');
    const filter = `${graph};${inputs.map((_, n) => `[a${n}]`).join('')}concat=n=${inputs.length}:v=0:a=1[a]`;
    await ctx.exec([...args, '-filter_complex', filter, '-map', '[a]', ...audioCodec(ext, Math.max(...inputs.map(sourceKbps))), ctx.out(name)], { duration: inputs.reduce((n, i) => n + durationOf(i), 0), phase: 'encoding' });
    return ctx.finish([name]);
  },

  async 'split-audio'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const ext = AUDIO_EXT[extOf(input.name)] || 'm4a';
    return splitInto(ctx, input, o, (start, length, out) => [...seek(start, 0), '-i', input.path, '-t', fixed(length), '-map', '0:a:0', '-vn', '-c:a', 'copy', out], ext);
  },

  async 'stereo-to-mono'(ctx) {
    const input = ctx.input;
    needAudio(input);
    const t = audioTarget(input);
    const name = `${safeBase(input.name)}-mono.${t.ext}`;
    await ctx.exec(['-i', input.path, ...audioMaps(t), '-ac', '1', ...t.codec, ctx.out(name)], { duration: durationOf(input) });
    return ctx.finish([name]);
  },

  async 'change-volume'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const t = audioTarget(input);
    const gain = Number(o.gain) || 0;
    const name = `${safeBase(input.name)}-${gain >= 0 ? 'louder' : 'quieter'}.${t.ext}`;
    const af = [`volume=${gain}dB`, ...(o.limit ? ['alimiter=limit=0.97:level=disabled'] : [])].join(',');
    await ctx.exec(['-i', input.path, ...audioMaps(t), '-af', af, ...t.codec, ctx.out(name)], { duration: durationOf(input) });
    return ctx.finish([name]);
  },

  async 'fade-audio'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const total = durationOf(input);
    const fadeIn = Math.max(0, Number(o.in) || 0);
    const fadeOut = Math.max(0, Number(o.out) || 0);
    if (fadeOut && !total) throw new MediaError('The length could not be read, so the fade-out cannot be placed.');
    if (fadeIn + fadeOut > total && total) throw new MediaError('The fades are longer than the file. Use shorter fades.');
    const t = audioTarget(input);
    const filters = [fadeIn && `afade=t=in:d=${fixed(fadeIn)}`, fadeOut && `afade=t=out:st=${fixed(total - fadeOut)}:d=${fixed(fadeOut)}`].filter(Boolean);
    const name = `${safeBase(input.name)}-faded.${t.ext}`;
    await ctx.exec(['-i', input.path, ...audioMaps(t), '-af', filters.join(',') || 'anull', ...t.codec, ctx.out(name)], { duration: total });
    return ctx.finish([name]);
  },

  async 'normalize-audio'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const target = o.target === 'custom' ? Number(o.custom) : Number(o.target) || -16;
    if (!(target <= -5 && target >= -70)) throw new MediaError('Choose a loudness target between −70 and −5 LUFS.');
    const t = audioTarget(input);
    const total = durationOf(input);
    ctx.steps(2);
    // Pass 1 measures the file (EBU R128); pass 2 applies one linear gain.
    const spec = `I=${target}:TP=-1.5:LRA=11`;
    await ctx.exec(['-i', input.path, '-map', '0:a:0', '-af', `loudnorm=${spec}:print_format=json`, '-f', 'null', '-'], { duration: total, phase: 'analyzing' });
    const json = ctx.log.slice(ctx.log.lastIndexOf('{'), ctx.log.lastIndexOf('}') + 1);
    let m;
    try {
      m = JSON.parse(json);
    } catch {
      throw new MediaError('The loudness could not be measured. The file may be silent or damaged.');
    }
    if (!Number.isFinite(Number(m.input_i))) throw new MediaError('This file is silent, so there is nothing to normalise.');
    const measured = `measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
    const name = `${safeBase(input.name)}-normalized.${t.ext}`;
    const rate = input.info.audio.sampleRate || 48000;
    await ctx.exec(['-i', input.path, ...audioMaps(t), '-af', `loudnorm=${spec}:${measured},aresample=${rate}`, ...t.codec, ctx.out(name)], { duration: total, phase: 'encoding' });
    ctx.result = { measured: Number(m.input_i), target };
    return ctx.finish([name]);
  },

  async 'remove-silence'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const t = audioTarget(input);
    const threshold = `${Number(o.threshold) || -40}dB`;
    const total = durationOf(input);
    const name = `${safeBase(input.name)}-no-silence.${t.ext}`;
    if (o.where === 'edges') {
      // Find where sound starts and ends, then cut once (streams; no buffering).
      ctx.steps(2);
      await ctx.exec(['-i', input.path, '-map', '0:a:0', '-af', `silencedetect=n=${threshold}:d=0.3`, '-f', 'null', '-'], { duration: total, phase: 'analyzing' });
      const starts = [...ctx.log.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Number(m[1]));
      const ends = [...ctx.log.matchAll(/silence_end: (-?[\d.]+)/g)].map((m) => Number(m[1]));
      let from = 0;
      let to = total;
      if (starts.length && starts[0] <= 0.05 && ends.length) from = ends[0];
      if (starts.length && starts.at(-1) > from && (ends.length < starts.length || ends.at(-1) >= total - 0.05)) to = starts.at(-1);
      if (!(to > from)) throw new MediaError('The whole file is quieter than the threshold. Choose a lower threshold.');
      await ctx.exec([...seek(from, 0), '-i', input.path, '-t', fixed(to - from), ...audioMaps(t), ...t.codec, ctx.out(name)], { duration: to - from });
      return ctx.finish([name]);
    }
    if (t.video) throw new MediaError('Removing pauses inside a video would put the sound out of sync with the picture. Use “Only at the start and end”, or extract the audio first.');
    const pause = Math.max(0.1, Number(o.pause) || 1);
    await ctx.exec(['-i', input.path, '-map', '0:a:0', '-vn', '-af', `silenceremove=start_periods=1:start_threshold=${threshold}:start_silence=0.1:stop_periods=-1:stop_duration=${fixed(pause)}:stop_threshold=${threshold}`, ...t.codec, ctx.out(name)], { duration: total });
    return ctx.finish([name]);
  },

  async 'clean-voice'(ctx, o) {
    const input = ctx.input;
    needAudio(input);
    const t = audioTarget(input);
    const nr = { light: 8, medium: 14, strong: 22 }[o.strength] || 14;
    const hum = Number(o.hum);
    const filters = [
      'highpass=f=80',
      ...(hum ? [1, 2, 3].map((k) => `bandreject=f=${hum * k}:width_type=q:w=8`) : []),
      `afftdn=nr=${nr}:nf=-40`,
      'lowpass=f=12000',
      'acompressor=threshold=-20dB:ratio=3:attack=10:release=200',
      'loudnorm=I=-16:TP=-1.5:LRA=11',
      `aresample=${input.info.audio.sampleRate || 48000}`,
    ];
    const name = `${safeBase(input.name)}-clean.${t.ext}`;
    await ctx.exec(['-i', input.path, ...audioMaps(t), '-af', filters.join(','), ...t.codec, ctx.out(name)], { duration: durationOf(input), phase: 'processing' });
    return ctx.finish([name]);
  },

  async 'compress-gif'(ctx, o) {
    const input = ctx.input;
    const scale = Number(o.scale) || 100;
    const filters = [o.fps && o.fps !== 'keep' ? `fps=${o.fps}` : null, scale < 100 ? `scale=trunc(iw*${scale / 100}/2)*2:-1:flags=lanczos` : 'scale=iw:ih'].filter(Boolean).join(',');
    const name = `${safeBase(input.name)}-compressed.gif`;
    ctx.steps(2);
    await gifPasses(ctx, input, filters, name, { colors: Number(o.colors) || 128, duration: durationOf(input) });
    return ctx.finish([name]);
  },

  async 'resize-gif'(ctx, o) {
    const input = ctx.input;
    const width = o.width === 'custom' ? Math.max(2, Math.round(Number(o.custom) || 400)) : Number(o.width) || 480;
    const name = `${safeBase(input.name)}-${width}px.gif`;
    ctx.steps(2);
    await gifPasses(ctx, input, `scale=${width}:-1:flags=lanczos`, name, { duration: durationOf(input) });
    return ctx.finish([name]);
  },

  async 'gif-to-frames'(ctx, o) {
    const input = ctx.input;
    await ctx.exec(['-i', input.path, '-vsync', '0', `/out/${safeBase(input.name)}-%04d.png`], { duration: durationOf(input) });
    return ctx.finish(await ctx.listOut(), { jpeg: o.format === 'jpg' });
  },

  async 'gif-maker'(ctx, o) {
    const inputs = ctx.inputs;
    if (!inputs.length) throw new MediaError('Choose at least one image.');
    const seconds = Math.max(0.02, Number(o.seconds) || 0.5);
    const width = Number(o.width) || 480;
    const first = displaySize(inputs[0].info) || { width, height: width };
    const height = Math.max(2, Math.round((width * first.height) / first.width / 2) * 2);
    const fps = o.output === 'mp4' ? 30 : Math.min(50, Math.max(1, Math.round(1 / seconds)));
    const fit = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=white,setsar=1,fps=${fps},format=rgb24`;
    const args = [];
    // Each image is its own looped input, so images of any size and format mix.
    for (const input of inputs) args.push('-loop', '1', '-t', fixed(seconds), '-i', input.path);
    const graph = `${inputs.map((_, n) => `[${n}:v]${fit}[v${n}]`).join(';')};${inputs.map((_, n) => `[v${n}]`).join('')}concat=n=${inputs.length}:v=1:a=0`;
    const total = seconds * inputs.length;
    const base = `${safeBase(inputs[0].name)}-animation`;
    if (o.output === 'mp4') {
      const name = `${base}.mp4`;
      await ctx.exec([...args, '-filter_complex', `${graph},format=yuv420p[v]`, '-map', '[v]', ...H264(20), ...FASTSTART, ctx.out(name)], { duration: total, phase: 'encoding' });
      return ctx.finish([name]);
    }
    const name = `${base}.gif`;
    const palette = ctx.tmp('palette.png');
    ctx.steps(2);
    await ctx.exec([...args, '-filter_complex', `${graph},palettegen=stats_mode=full[p]`, '-map', '[p]', '-frames:v', '1', '-update', '1', palette], { duration: total, phase: 'analyzing' });
    await ctx.exec([...args, '-i', palette, '-filter_complex', `${graph}[x];[x][${inputs.length}:v]paletteuse=dither=sierra2_4a[g]`, '-map', '[g]', '-loop', '0', ctx.out(name)], { duration: total, phase: 'encoding' });
    return ctx.finish([name]);
  },
};

/** Splits by length or into equal parts, one disk-backed file per command. */
async function splitInto(ctx, input, o, build, ext) {
  const total = durationOf(input);
  if (!total) throw new MediaError('The length could not be read, so the file cannot be split.');
  const length = o.by === 'parts' ? total / Math.max(2, Math.round(Number(o.parts) || 2)) : Math.max(1, Number(o.seconds) || 60);
  const count = Math.ceil(total / length - 1e-6);
  ctx.steps(count);
  const names = [];
  for (let i = 0; i < count; i++) {
    const start = i * length;
    const name = `${safeBase(input.name)}-part${String(i + 1).padStart(String(count).length, '0')}.${ext}`;
    names.push(name);
    await ctx.exec(build(start, Math.min(length, total - start), ctx.out(name)), { duration: Math.min(length, total - start) });
  }
  return ctx.finish(names);
}

const MIME = { mp4: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska', webm: 'video/webm', avi: 'video/x-msvideo', gif: 'image/gif', jpg: 'image/jpeg', png: 'image/png', srt: 'application/x-subrip', vtt: 'text/vtt', ass: 'text/x-ssa', ...AUDIO_MIME };
export const mimeFor = (name) => MIME[extOf(name)] || 'application/octet-stream';
export const kindOfName = (name) => (/^(mp4|mov|mkv|webm|avi)$/.test(extOf(name)) ? 'video' : AUDIO_MIME[extOf(name)] ? 'audio' : /^(gif|png|jpg)$/.test(extOf(name)) ? 'image' : 'file');
