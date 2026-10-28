// An Emscripten file system for FFmpeg's output folder that writes straight to
// disk through OPFS synchronous access handles (inside a worker). The encoded
// result never has to sit in WebAssembly memory, so output size is bounded by
// free disk space instead of RAM. Files the recipe did not announce in advance
// (frame sequences, segment lists) fall back to growable memory buffers.
//
// `open(name)` must return a ready handle-like object for announced names:
//   { read(view, {at}), write(view, {at}), getSize(), truncate(n), flush(), close() }
// Errno values are Emscripten's: ENOENT 44, EPERM 63, EINVAL 28.

const DIR_MODE = 16895; // drwxrwxrwx
const FILE_MODE = 33206; // -rw-rw-rw-

export function createOutFS(FS, announced) {
  const fail = (errno) => new FS.ErrnoError(errno);
  function make(parent, name, mode) {
    const node = FS.createNode(parent, name, mode, 0);
    node.node_ops = nodeOps;
    node.stream_ops = streamOps;
    node.timestamp = Date.now();
    if (FS.isDir(mode)) node.contents = {};
    else {
      const handle = announced.take(name);
      if (handle) handle.truncate(0);
      node.contents = { handle, mem: handle ? null : new Uint8Array(0), size: 0 };
    }
    if (parent) parent.contents[name] = node;
    return node;
  }
  const sizeOf = (node) =>
    FS.isDir(node.mode)
      ? 4096
      : node.contents.handle
        ? node.contents.handle.getSize()
        : node.contents.size;
  function resize(c, size) {
    if (c.handle) return c.handle.truncate(size);
    if (size > c.mem.length) {
      const next = new Uint8Array(Math.max(size, c.mem.length * 2, 65536));
      next.set(c.mem.subarray(0, c.size));
      c.mem = next;
    }
    if (size < c.size) c.mem.fill(0, size, c.size);
    c.size = size;
  }
  const nodeOps = {
    getattr(node) {
      const size = sizeOf(node);
      const time = new Date(node.timestamp);
      return {
        dev: 1, ino: node.id, mode: node.mode, nlink: 1, uid: 0, gid: 0, rdev: 0,
        size, atime: time, mtime: time, ctime: time, blksize: 4096,
        blocks: Math.ceil(size / 4096),
      };
    },
    setattr(node, attr) {
      if (attr.mode !== undefined) node.mode = attr.mode;
      if (attr.timestamp !== undefined) node.timestamp = attr.timestamp;
      if (attr.size !== undefined && !FS.isDir(node.mode)) resize(node.contents, attr.size);
    },
    lookup() {
      throw fail(44);
    },
    mknod(parent, name, mode) {
      return make(parent, name, mode);
    },
    rename(node, dir, name) {
      delete node.parent.contents[node.name];
      dir.contents[name] = node;
      node.name = name;
      node.parent = dir;
    },
    unlink(parent, name) {
      const node = parent.contents[name];
      if (node?.contents?.handle) announced.drop(name, node.contents.handle);
      delete parent.contents[name];
    },
    rmdir(parent, name) {
      delete parent.contents[name];
    },
    readdir(node) {
      return ['.', '..', ...Object.keys(node.contents)];
    },
    symlink() {
      throw fail(63);
    },
  };
  const streamOps = {
    read(stream, buffer, offset, length, position) {
      const c = stream.node.contents;
      const view = buffer.subarray(offset, offset + length);
      if (c.handle) return c.handle.read(view, { at: position });
      if (position >= c.size) return 0;
      const n = Math.min(length, c.size - position);
      view.set(c.mem.subarray(position, position + n));
      return n;
    },
    write(stream, buffer, offset, length, position) {
      const c = stream.node.contents;
      const view = buffer.subarray(offset, offset + length);
      if (c.handle) {
        let written = 0;
        while (written < length)
          written += c.handle.write(view.subarray(written), { at: position + written });
        return length;
      }
      if (position + length > c.size) resize(c, position + length);
      c.mem.set(view, position);
      return length;
    },
    llseek(stream, offset, whence) {
      let position = offset;
      if (whence === 1) position += stream.position;
      else if (whence === 2) position += sizeOf(stream.node);
      if (position < 0) throw fail(28);
      return position;
    },
  };
  return {
    mount() {
      return make(null, '/', DIR_MODE);
    },
  };
}

/** Lists files in the mounted output folder: disk-backed and in-memory ones. */
export function outFiles(FS, mountPoint) {
  const root = FS.lookupPath(mountPoint).node;
  return Object.entries(root.contents)
    .filter(([, node]) => !FS.isDir(node.mode))
    .map(([name, node]) => ({
      name,
      handle: node.contents.handle || null,
      size: node.contents.handle ? node.contents.handle.getSize() : node.contents.size,
      data: node.contents.handle ? null : node.contents.mem.subarray(0, node.contents.size),
    }));
}

export const FILE_MODE_RW = FILE_MODE;
