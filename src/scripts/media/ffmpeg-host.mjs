// Wraps one FFmpeg WebAssembly core instance: mounts inputs, runs commands,
// tracks output files and logs. Used by the browser worker and by Node tests,
// so recipes are tested against the exact same engine the site ships.
import { createOutFS, outFiles } from './outfs.mjs';

const MAX_LOG = 600;

export class FFmpegHost {
  /**
   * @param core  an FFmpeg core instance (createFFmpegCore result)
   * @param opts.workerfs  mount inputs lazily from Blobs (browser workers only)
   * @param opts.threads   threaded core: threads per decoder, encoder and filter graph
   */
  constructor(core, { workerfs = true, threads = 0 } = {}) {
    this.threads = threads;
    this.core = core;
    this.FS = core.FS;
    this.workerfs = workerfs;
    this.lines = [];
    this.onTime = null;
    this.dead = false;
    this.pending = new Map(); // announced output name -> disk handle
    core.setLogger(({ message }) => {
      this.lines.push(message);
      if (this.lines.length > MAX_LOG) this.lines.splice(0, MAX_LOG / 2);
    });
    core.setProgress(({ time }) => {
      if (time > 0) this.onTime?.(time / 1e6);
    });
    // /fonts holds fonts for libass (subtitles); it survives between jobs.
    for (const dir of ['/in', '/work', '/out', '/fonts']) this.FS.mkdir(dir);
    const announced = {
      take: (name) => {
        const handle = this.pending.get(name) || null;
        return handle;
      },
      drop: () => {},
    };
    this.outfs = createOutFS(this.FS, announced);
    this.FS.mount(this.outfs, {}, '/out');
    this.inputsMounted = false;
  }

  /** inputs: [{ name, blob }] (browser) or [{ name, data: Uint8Array }] (Node). */
  mountInputs(inputs) {
    this.unmountInputs();
    if (this.workerfs && inputs.every((i) => i.blob)) {
      this.FS.mount(
        this.FS.filesystems.WORKERFS,
        { blobs: inputs.map((i) => ({ name: i.name, data: i.blob })) },
        '/in',
      );
      this.inputsMounted = true;
    } else for (const i of inputs) this.FS.writeFile(`/in/${i.name}`, i.data);
  }
  unmountInputs() {
    if (this.inputsMounted) {
      this.FS.unmount('/in');
      this.inputsMounted = false;
    } else
      for (const name of this.FS.readdir('/in'))
        if (name !== '.' && name !== '..') this.FS.unlink(`/in/${name}`);
  }

  /** Registers a disk handle for an output file before FFmpeg creates it. */
  announce(name, handle) {
    this.pending.set(name, handle);
  }

  /** Bytes of WebAssembly memory this instance holds (it never shrinks). */
  memory() {
    return this.core.HEAPU8?.length || 0;
  }

  write(path, data) {
    this.FS.writeFile(path, data);
  }

  /**
   * Threaded core only: an explicit thread count for filter graphs and for the
   * (last) output's encoders, so a job never needs more threads than the pool has.
   */
  withThreads(args) {
    if (!this.threads || args.length < 2) return args;
    const n = String(this.threads);
    return ['-filter_threads', n, '-filter_complex_threads', n, ...args.slice(0, -1), '-threads', n, args[args.length - 1]];
  }

  /** Runs one ffmpeg command. Never throws: a crash is reported as { crashed }. */
  exec(args) {
    this.lines = [];
    let ret;
    let crashed = false;
    try {
      // ffprobe's -v setting is global in the library; reset it for every command.
      ret = this.core.exec('-hide_banner', '-loglevel', 'info', ...this.withThreads(args));
    } catch (error) {
      crashed = true;
      this.lines.push(String(error?.message || error));
    }
    try {
      this.core.reset();
    } catch {
      crashed = true;
    }
    if (ret === undefined) crashed = true;
    if (crashed) this.dead = true;
    return { ret: crashed ? -1 : ret, crashed, log: this.lines.slice(-80).join('\n') };
  }

  /** ffprobe as JSON (format and streams). */
  probe(path) {
    this.lines = [];
    try {
      this.core.ffprobe('-v', 'error', '-show_format', '-show_streams', '-of', 'json', path);
    } catch (error) {
      this.dead = true;
      throw error;
    }
    this.core.reset();
    const text = this.lines.join('\n');
    const start = text.indexOf('{');
    return start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf('}') + 1)) : {};
  }

  /** Output files: disk-backed ({ handle }) or in memory ({ data }). */
  files() {
    return outFiles(this.FS, '/out');
  }

  remove(name) {
    try {
      this.FS.unlink(`/out/${name}`);
    } catch {
      // never created
    }
    this.pending.delete(name);
  }

  /** Clears outputs, scratch files and inputs between jobs. */
  clear() {
    for (const name of this.FS.readdir('/out'))
      if (name !== '.' && name !== '..') this.remove(name);
    for (const name of this.FS.readdir('/work'))
      if (name !== '.' && name !== '..') this.FS.unlink(`/work/${name}`);
    this.unmountInputs();
    this.pending.clear();
  }
}
