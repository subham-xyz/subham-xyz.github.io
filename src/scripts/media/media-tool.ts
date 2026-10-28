// Page controller shared by every video, audio and GIF tool: file selection,
// settings, a batch queue with per-file progress, cancel, pause and retry,
// results with download, ZIP and share. Processing runs in engine.ts.
import { bindDrop, downloads, friendlyError } from '../local-files';
import { size } from '../image-core.mjs';
import { resultView } from '../result-view';
import { setKittyState } from '../tool-state';
import { JobQueue, isCancelled, type JobItem } from '../jobs/queue';
import { device } from '../jobs/device';
import { clearSession } from '../jobs/temp-store';
import { zipFiles } from '../jobs/zip';
import { mediaTools } from './media-tools.mjs';
import { displaySize, formatTime, parseTime } from './probe.mjs';
import { ENGINE_BYTES, probe, runTool, releaseEngine, type OnProgress } from './engine';

type Info = Awaited<ReturnType<typeof probe>>;
type Entry = { file: File; info?: Info; url?: string };

const root = document.getElementById('media-tool');
if (root) {
  const toolId = root.dataset.tool!;
  const cfg = (mediaTools as Record<string, any>)[toolId];
  const mode: 'one' | 'batch' | 'ordered' | 'roles' = root.dataset.inputs as any;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
  const upload = get('media-upload');
  const editor = get('media-editor');
  const statusLine = get('media-status');
  const queueList = get('media-queue');
  const runButton = get<HTMLButtonElement>('media-run');
  const progressBox = get('media-progress');
  const bar = get('media-bar');
  const phaseLine = get('media-phase');
  const output = downloads(get('media-output'));
  const result = resultView('media', root);
  const video = get<HTMLVideoElement>('media-video');
  const audio = get<HTMLAudioElement>('media-audio');
  const resultPreview = get('media-result-preview');
  const status = (text: string) => (statusLine.textContent = text);

  let entries: Entry[] = [];
  const roleFiles: (File | undefined)[] = [];
  let controller: AbortController | undefined;
  let queue: JobQueue<Entry, File[]> | undefined;
  let previewUrl = '';
  let resultUrl = '';
  let running = false;

  // ------------------------------------------------------------- settings
  const options = [...root.querySelectorAll<HTMLElement>('.media-option')];
  function values() {
    const out: Record<string, unknown> = {};
    for (const box of options) {
      const id = box.dataset.option!;
      const type = box.dataset.type;
      if (type === 'choice') out[id] = box.querySelector<HTMLInputElement>('input:checked')?.value;
      else if (type === 'toggle') out[id] = box.querySelector<HTMLInputElement>('input')!.checked;
      else if (type === 'time') {
        const text = box.querySelector<HTMLInputElement>('input')!.value;
        const seconds = parseTime(text);
        if (text.trim() && seconds === undefined) throw new Error(`Enter the time as seconds or m:ss, for example 1:30.`);
        out[id] = seconds ?? (cfg.options.find((o: any) => o.id === id)?.default === 'end' ? 'end' : 0);
      } else out[id] = box.querySelector<HTMLInputElement>('input')!.value;
    }
    return out;
  }
  function syncWhen() {
    const current: Record<string, unknown> = {};
    for (const box of options)
      if (box.dataset.type === 'choice') current[box.dataset.option!] = box.querySelector<HTMLInputElement>('input:checked')?.value;
    for (const box of options) {
      if (!box.dataset.when) continue;
      const when = JSON.parse(box.dataset.when);
      box.hidden = !Object.entries(when).every(([k, v]) => current[k] === v);
    }
  }
  root.addEventListener('change', (event) => {
    if ((event.target as HTMLElement).closest('.media-option')) syncWhen();
  });
  // Settings typed into search ("compress video to 25mb", "mp4 to mp3") arrive as
  // ?target=25 or ?format=mp3. Only valid values for this tool are applied.
  const prefill = new URLSearchParams(location.search);
  for (const box of options) {
    const value = prefill.get(box.dataset.option!);
    if (value === null) continue;
    if (box.dataset.type === 'choice') {
      const radio = [...box.querySelectorAll<HTMLInputElement>('input')].find((i) => i.value === value);
      if (radio) radio.checked = true;
    } else if (box.dataset.type === 'number') {
      const input = box.querySelector<HTMLInputElement>('input')!;
      const n = Number(value);
      const min = input.min === '' ? -Infinity : Number(input.min);
      const max = input.max === '' ? Infinity : Number(input.max);
      if (Number.isFinite(n) && n >= min && n <= max) input.value = String(n);
    }
  }
  syncWhen();
  root.querySelectorAll<HTMLButtonElement>('[data-now]').forEach((button) =>
    button.addEventListener('click', () => {
      const player = video.hidden ? audio : video;
      const input = get<HTMLInputElement>(`media-${button.dataset.now}`);
      input.value = formatTime(player.currentTime || 0);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }),
  );

  // ------------------------------------------------------------- progress
  const phaseText: Record<string, (r?: number, d?: any) => string> = {
    engine: (_r, d) => `Downloading the media engine (first time only): ${size(d?.loaded || 0)} of ${size(d?.total || ENGINE_BYTES)}`,
    'engine-cached': () => 'Starting the media engine…',
    'engine-start': () => 'Starting the media engine…',
    reading: () => 'Reading the file…',
    analyzing: (r) => `Analysing… ${Math.round((r || 0) * 100)}%`,
    processing: (r) => `Processing… ${Math.round((r || 0) * 100)}%`,
    encoding: (r) => `Encoding… ${Math.round((r || 0) * 100)}%`,
    writing: () => 'Writing the file…',
    packing: (r) => `Packing the ZIP… ${Math.round((r || 0) * 100)}%`,
  };
  function showProgress(ratio: number | undefined, phase: string, detail?: any, prefix = '') {
    progressBox.hidden = false;
    const percent = ratio === undefined ? undefined : Math.round(Math.min(1, Math.max(0, ratio)) * 100);
    bar.classList.toggle('indeterminate', percent === undefined);
    bar.querySelector('span')!.style.width = `${percent ?? 30}%`;
    if (percent !== undefined) bar.setAttribute('aria-valuenow', String(percent));
    else bar.removeAttribute('aria-valuenow');
    phaseLine.textContent = prefix + (phaseText[phase]?.(ratio, detail) || 'Processing…');
  }

  // ------------------------------------------------------------- files
  const matches = (file: File, accept: string) => {
    const name = file.name.toLowerCase();
    return accept.split(',').some((rule) => {
      rule = rule.trim().toLowerCase();
      if (rule.startsWith('.')) return name.endsWith(rule);
      if (rule.endsWith('/*')) return file.type.startsWith(rule.slice(0, -1));
      return file.type === rule;
    });
  };
  function facts(info?: Info) {
    if (!info) return '';
    const parts: string[] = [];
    if (info.duration) parts.push(formatTime(info.duration));
    const d = displaySize(info);
    if (d && !info.still) parts.push(`${d.width} × ${d.height}`);
    if (info.video?.fps && !info.still && cfg.kind !== 'audio') parts.push(`${Math.round(info.video.fps * 100) / 100} fps`);
    if (info.video && !info.still) parts.push(info.video.codec.toUpperCase());
    if (info.audio) parts.push(`${info.audio.codec.toUpperCase()} audio${info.audio.channels === 1 ? ' (mono)' : ''}`);
    else if (cfg.kind !== 'gif' && info.video && !info.still) parts.push('no audio');
    if (info.subtitles?.length) parts.push(`Subtitles: ${info.subtitles.length}`);
    return parts.join(' · ');
  }
  function setPreview(entry?: Entry) {
    const preview = get('media-preview');
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    video.hidden = audio.hidden = true;
    preview.hidden = true;
    if (!entry || mode === 'batch' && entries.length > 1) return;
    const isVideo = entry.info?.video && !entry.info.still;
    const isAudio = !isVideo && entry.info?.audio;
    const playable = isVideo ? video.canPlayType(entry.file.type || 'video/mp4') !== '' : isAudio;
    if (!playable && !cfg.preview) return;
    previewUrl = URL.createObjectURL(entry.file);
    const player = isVideo ? video : audio;
    player.src = previewUrl;
    player.hidden = false;
    preview.hidden = false;
  }
  function renderQueue() {
    const items = queue?.items;
    queueList.replaceChildren(
      ...entries.map((entry, index) => {
        const item = items?.find((i) => i.input === entry);
        const li = document.createElement('li');
        li.className = 'media-item';
        const name = document.createElement('strong');
        name.className = 'media-name';
        name.textContent = entry.file.name;
        const meta = document.createElement('small');
        meta.className = 'media-meta';
        meta.textContent = [size(entry.file.size), facts(entry.info)].filter(Boolean).join(' · ');
        const state = document.createElement('span');
        state.className = 'media-state';
        if (item) {
          li.dataset.status = item.status;
          state.textContent =
            item.status === 'running'
              ? `${Math.round((item.ratio || 0) * 100)}%`
              : item.status === 'done'
                ? 'Done'
                : item.status === 'failed'
                  ? friendlyError(item.error)
                  : item.status === 'cancelled'
                    ? 'Cancelled'
                    : 'Waiting';
        }
        const actions = document.createElement('span');
        actions.className = 'media-actions';
        const button = (label: string, title: string, fn: () => void) => {
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'icon-button media-action';
          b.textContent = label;
          b.title = title;
          b.setAttribute('aria-label', `${title}: ${entry.file.name}`);
          b.addEventListener('click', fn);
          return b;
        };
        if (item && (item.status === 'failed' || item.status === 'cancelled') && !running)
          actions.append(button('↻', 'Retry', () => void retry(item)));
        if (!running) {
          if (mode === 'ordered' && index > 0) actions.append(button('↑', 'Move up', () => move(index, -1)));
          if (mode === 'ordered' && index < entries.length - 1) actions.append(button('↓', 'Move down', () => move(index, 1)));
          if (entries.length > 1) actions.append(button('×', 'Remove', () => removeEntry(index)));
        }
        li.append(name, meta, state, actions);
        return li;
      }),
    );
    queueList.hidden = !entries.length || (entries.length === 1 && mode !== 'ordered' && !items);
    const first = entries[0];
    get('media-facts').textContent = first
      ? entries.length > 1
        ? `${entries.length} files · ${size(entries.reduce((n, e) => n + e.file.size, 0))}`
        : `${first.file.name} · ${[size(first.file.size), facts(first.info)].filter(Boolean).join(' · ')}`
      : '';
  }
  function move(index: number, delta: number) {
    const [entry] = entries.splice(index, 1);
    entries.splice(index + delta, 0, entry);
    renderQueue();
  }
  function removeEntry(index: number) {
    entries.splice(index, 1);
    queue = undefined;
    setPreview(entries.length === 1 ? entries[0] : undefined);
    renderQueue();
  }

  async function select(files: File[]) {
    if (running) return;
    const accept = mode === 'roles' ? cfg.inputs[0].accept : cfg.accept;
    const usable = files.filter((f) => f.size && matches(f, accept));
    if (!usable.length) {
      setKittyState(root!, 'error');
      status(files.some((f) => !f.size) ? 'This file is empty.' : 'This file type is not supported here. Check the formats listed above.');
      return;
    }
    output.clear();
    result.hide();
    resultPreview.hidden = true;
    queue = undefined;
    const added: Entry[] = usable.map((file) => ({ file }));
    if (mode === 'batch' || mode === 'ordered') entries.push(...added);
    else entries = added.slice(0, 1);
    upload.hidden = true;
    editor.hidden = false;
    renderQueue();
    setKittyState(root!, 'processing');
    // Read duration and streams now: settings and errors depend on them.
    try {
      for (const entry of added.slice(0, mode === 'batch' ? 1 : added.length)) {
        status(`Reading ${entry.file.name}…`);
        entry.info = await probe(entry.file, (r, phase, d) => status(phaseText[phase]?.(r, d) || 'Starting the media engine…'));
      }
      setKittyState(root!, 'idle');
      status(usable.length < files.length ? 'Some files were skipped because their type is not supported here.' : mode === 'batch' && entries.length > 1 ? `${entries.length} files ready. Review settings, then continue.` : 'Ready. Review settings, then continue.');
    } catch (error) {
      setKittyState(root!, 'error');
      status(friendlyError(error));
    }
    setPreview(entries.length === 1 ? entries[0] : undefined);
    renderQueue();
    const heavy = cfg.kind !== 'audio' && entries.some((e) => (e.info?.duration || 0) > 300 || (e.info ? displaySize(e.info)?.height || 0 : 0) >= 1440);
    get('media-heavy').hidden = !(heavy && device().mobile);
  }
  bindDrop(get<HTMLInputElement>('media-file'), select);
  root.querySelectorAll<HTMLInputElement>('input[data-role]').forEach((input) =>
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const index = Number(input.dataset.role);
      if (!matches(file, cfg.inputs[index].accept)) {
        status('This file type is not supported here.');
        return;
      }
      roleFiles[index] = file;
      get(`media-role-${index}-name`).textContent = `${file.name} · ${size(file.size)}`;
    }),
  );

  // ------------------------------------------------------------- running
  function setRunning(on: boolean) {
    running = on;
    runButton.hidden = on;
    if (on && queue?.isPaused !== true) get('media-pause')?.replaceChildren('Pause after this file');
    progressBox.hidden = !on;
    root!.querySelectorAll<HTMLInputElement>('.media-option input, input[data-role], #media-file').forEach((i) => (i.disabled = on));
    get('media-add')?.toggleAttribute('hidden', on);
    setKittyState(root!, on ? 'processing' : 'idle');
    renderQueue();
  }

  async function finish(files: File[], originals: File[]) {
    if (!files.length) return;
    output.clear();
    const urls = files.map((f) => output.add(f, f.name));
    let zip: File | undefined;
    if (files.length > 1) {
      showProgress(0, 'packing');
      zip = await zipFiles(files.map((f) => ({ name: f.name, blob: f })), `${originals[0].name.replace(/\.[^.]+$/, '')}-${toolId}.zip`, (d, t) => showProgress(d / t, 'packing'));
    }
    const original = /compress/.test(toolId) ? originals.reduce((n, f) => n + f.size, 0) : undefined;
    // A small preview of a single video, audio or GIF result.
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = '';
    resultPreview.replaceChildren();
    resultPreview.hidden = true;
    if (files.length === 1 && /^(video|audio|image)\//.test(files[0].type)) {
      resultUrl = URL.createObjectURL(files[0]);
      const el = files[0].type.startsWith('image/')
        ? Object.assign(document.createElement('img'), { alt: 'Result preview' })
        : Object.assign(document.createElement(files[0].type.startsWith('video/') ? 'video' : 'audio'), { controls: true, playsInline: true, preload: 'metadata' });
      el.src = resultUrl;
      resultPreview.append(el);
      resultPreview.hidden = false;
    }
    const total = files.reduce((n, f) => n + f.size, 0);
    result.show(
      files.map((f) => ({ name: f.name, blob: f })),
      urls,
      { original, zip, zipName: zip?.name, editor, upload, summary: `${files.length === 1 ? '1 file' : `${files.length} files`} · ${size(total)}` },
    );
    status('Done. Your original files are unchanged.');
  }

  async function runBatch() {
    const opts = values();
    controller = new AbortController();
    queue = new JobQueue<Entry, File[]>(async (entry, ctx) => {
      const index = entries.indexOf(entry) + 1;
      const prefix = entries.length > 1 ? `File ${index} of ${entries.length} · ` : '';
      const onProgress: OnProgress = (r, phase, d) => {
        ctx.progress(r, phase);
        showProgress(r, phase, d, prefix);
      };
      return runTool(toolId, [entry.file], opts, { signal: ctx.signal, onProgress, infos: entry.info ? [entry.info] : undefined });
    }, 1);
    queue.onChange(renderQueue);
    queue.add(entries);
    await queue.whenIdle();
  }

  async function retry(item: JobItem<Entry, File[]>) {
    if (!queue || running) return;
    setRunning(true);
    queue.retry(item.id);
    await queue.whenIdle();
    setRunning(false);
    await done();
  }

  async function done() {
    const items = queue?.items || [];
    const files = items.filter((i) => i.status === 'done').flatMap((i) => i.output || []);
    const failed = items.filter((i) => i.status === 'failed');
    if (files.length) await finish(files, entries.map((e) => e.file));
    if (failed.length) {
      setKittyState(root!, files.length ? 'idle' : 'error');
      status(files.length ? `${failed.length} of ${items.length} files could not be processed. Use ↻ to try them again.` : friendlyError(failed[0].error));
      // The finished files stay downloadable; the back arrow returns to the queue to retry the rest.
      if (files.length) get('media-summary').textContent += ` · ${failed.length} failed: go back to retry`;
    } else if (!files.length && items.some((i) => i.status === 'cancelled')) status('Cancelled. Your files are unchanged.');
  }

  runButton.addEventListener('click', async () => {
    if (running || !entries.length) return;
    let opts: Record<string, unknown>;
    try {
      opts = values();
    } catch (error) {
      status(friendlyError(error));
      return;
    }
    if (mode === 'roles') {
      const missing = cfg.inputs.findIndex((_: unknown, i: number) => i > 0 && !roleFiles[i]);
      if (missing > 0) {
        const label = cfg.inputs[missing].label;
        status(label === 'Logo image' ? 'Choose the logo image first.' : label === 'Subtitle file' ? 'Choose the subtitle file first.' : 'Choose the new audio first.');
        return;
      }
    }
    if (mode === 'ordered' && entries.length < (cfg.kind === 'gif' ? 1 : 2)) {
      status('Add at least two files.');
      return;
    }
    setRunning(true);
    try {
      if (mode === 'batch') {
        await runBatch();
        setRunning(false);
        await done();
        return;
      }
      controller = new AbortController();
      const files = mode === 'roles' ? [entries[0].file, ...roleFiles.slice(1).map((f) => f!)] : entries.map((e) => e.file);
      const infos = mode === 'roles' ? [entries[0].info!] : entries.map((e) => e.info!);
      const out = await runTool(toolId, files, opts, {
        signal: controller.signal,
        infos: infos.every(Boolean) && infos.length === files.length ? infos : undefined,
        onProgress: (r, phase, d) => showProgress(r, phase, d),
      });
      setRunning(false);
      await finish(out, files);
    } catch (error) {
      setRunning(false);
      if (isCancelled(error)) status('Cancelled. Your files are unchanged.');
      else {
        setKittyState(root!, 'error');
        status(friendlyError(error));
      }
    }
  });

  get('media-cancel').addEventListener('click', () => {
    queue?.cancelAll();
    controller?.abort();
    status('Cancelling…');
  });
  get('media-pause')?.addEventListener('click', () => {
    if (!queue) return;
    if (queue.isPaused) {
      queue.resume();
      get('media-pause').textContent = 'Pause after this file';
    } else {
      queue.pause();
      get('media-pause').textContent = 'Resume';
      status('The queue pauses after the current file finishes.');
    }
  });

  function reset() {
    queue?.cancelAll();
    controller?.abort();
    queue = undefined;
    entries = [];
    roleFiles.length = 0;
    root!.querySelectorAll<HTMLInputElement>('input[type=file]').forEach((i) => (i.value = ''));
    root!.querySelectorAll('[id^=media-role-][id$=-name]').forEach((el) => (el.textContent = 'Not chosen yet'));
    output.clear();
    result.hide();
    setPreview();
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = '';
    resultPreview.hidden = true;
    editor.hidden = true;
    upload.hidden = false;
    progressBox.hidden = true;
    runButton.hidden = false;
    running = false;
    renderQueue();
    setKittyState(root!, 'idle');
    status('100% on your device');
    // Results of this tab are no longer needed: free their temporary disk space.
    void clearSession();
  }
  get('media-reset').addEventListener('click', reset);
  result.onBack(() => {
    result.hide();
    editor.hidden = false;
  });
  result.onStartOver(reset);
  addEventListener('pagehide', () => releaseEngine());
}
