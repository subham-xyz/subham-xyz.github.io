// Password-protects a PDF with qpdf's AES-256 encryption (PDF 2.0 / revision 6), locally.

let worker: Worker | undefined;
let next = 0;

function run(bytes: Uint8Array, args: string[]): Promise<Uint8Array> {
  worker ||= new Worker(new URL('./qpdf.worker.ts', import.meta.url), { type: 'module' });
  const id = ++next;
  const copy = bytes.slice();
  return new Promise((resolve, reject) => {
    const done = (event: MessageEvent) => {
      if (event.data?.id !== id) return;
      worker!.removeEventListener('message', done);
      if (event.data.error) reject(new Error(friendly(event.data.error)));
      else resolve(event.data.bytes);
    };
    worker!.addEventListener('message', done);
    worker!.onerror = (event) => {
      worker?.terminate();
      worker = undefined;
      reject(new Error(event.message || 'The PDF engine failed to start in this browser.'));
    };
    worker!.postMessage({ id, bytes: copy, args }, [copy.buffer]);
  });
}

function friendly(message: string) {
  if (/password|encrypt/i.test(message)) return 'This PDF is already password-protected. Unlock it first, then protect it again.';
  if (/not a PDF|can't find PDF header|damaged|xref/i.test(message))
    return 'This file could not be read as a PDF. It may be damaged; try Repair PDF first.';
  return `The PDF could not be protected: ${message}`;
}

export function validatePassword(password: string, confirm: string) {
  if (password.length < 6) return 'Use a password with at least 6 characters.';
  if (password.length > 127) return 'Use a password of at most 127 characters.';
  if (password !== confirm) return 'The two passwords do not match.';
  return '';
}

const randomOwnerPassword = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');

/** Encrypts `bytes` with AES-256. With `restrict`, printing, copying and editing are disallowed. */
export function protectPDF(bytes: Uint8Array, password: string, restrict = false) {
  const args = [
    '--encrypt',
    `--user-password=${password}`,
    // Without restrictions the owner password grants nothing extra, so it matches the user password.
    `--owner-password=${restrict ? randomOwnerPassword() : password}`,
    '--bits=256',
    ...(restrict ? ['--print=none', '--modify=none', '--extract=n'] : []),
  ];
  return run(bytes, args);
}

export function releaseProtect() {
  worker?.terminate();
  worker = undefined;
}
