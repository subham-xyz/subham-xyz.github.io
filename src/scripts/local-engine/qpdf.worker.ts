// Runs qpdf (WebAssembly, self-hosted at /local-engine/qpdf/qpdf.wasm) off the main thread.
import createModule from '@neslinesli93/qpdf-wasm';

type Request = { id: number; bytes: Uint8Array; args: string[] };

let module: Promise<any> | undefined;
const qpdf = () =>
  (module ||= (createModule as any)({
    locateFile: () => '/local-engine/qpdf/qpdf.wasm',
    noInitialRun: true,
    print: () => {},
    printErr: (line: string) => errors.push(line),
  }));
let errors: string[] = [];

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const { id, bytes, args } = data;
  try {
    const q = await qpdf();
    errors = [];
    q.FS.writeFile('/in.pdf', bytes);
    let code: number;
    try {
      code = q.callMain([...args, '--', '/in.pdf', '/out.pdf']);
    } catch (error: any) {
      // Emscripten reports exit() as an ExitStatus exception.
      code = typeof error?.status === 'number' ? error.status : 2;
    }
    // qpdf exit code 3 means "succeeded with warnings".
    if (code !== 0 && code !== 3) throw new Error(errors.join(' ').slice(0, 240) || `qpdf exited with code ${code}`);
    const out: Uint8Array = q.FS.readFile('/out.pdf');
    q.FS.unlink('/in.pdf');
    q.FS.unlink('/out.pdf');
    (self as unknown as Worker).postMessage({ id, bytes: out }, [out.buffer]);
  } catch (error) {
    (self as unknown as Worker).postMessage({ id, error: error instanceof Error ? error.message : String(error) });
  }
};
