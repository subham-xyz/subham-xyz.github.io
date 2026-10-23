// A minimal known-password RC4 PDF fixture. This is test data generation, never a runtime encryption feature.
import { createHash } from 'node:crypto';
const padding = Buffer.from(
  '28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a',
  'hex',
);
const md5 = (value) => createHash('md5').update(value).digest();
const pad = (text) =>
  Buffer.concat([Buffer.from(text, 'latin1'), padding]).subarray(0, 32);
function rc4(data, key) {
  const s = Uint8Array.from({ length: 256 }, (_, i) => i);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    j = (j + s[i] + key[i % key.length]) & 255;
    [s[i], s[j]] = [s[j], s[i]];
  }
  let i = 0;
  j = 0;
  return Buffer.from(
    data.map((byte) => {
      i = (i + 1) & 255;
      j = (j + s[i]) & 255;
      [s[i], s[j]] = [s[j], s[i]];
      return byte ^ s[(s[i] + s[j]) & 255];
    }),
  );
}
export function passwordFixture(password = 'kitty-test') {
  const id = Buffer.from('00112233445566778899aabbccddeeff', 'hex'),
    owner = rc4(pad(password), md5(pad('known-owner')).subarray(0, 5)),
    permissions = Buffer.alloc(4);
  permissions.writeInt32LE(-4);
  const key = md5(
      Buffer.concat([pad(password), owner, permissions, id]),
    ).subarray(0, 5),
    user = rc4(padding, key),
    objectKey = md5(
      Buffer.concat([key, Buffer.from([5, 0, 0, 0, 0])]),
    ).subarray(0, 10),
    stream = rc4(
      Buffer.from('BT /F1 20 Tf 20 100 Td (KNOWN PASSWORD CONTENT) Tj ET'),
      objectKey,
    );
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    Buffer.concat([
      Buffer.from(`<< /Length ${stream.length} >>\nstream\n`),
      stream,
      Buffer.from('\nendstream'),
    ]),
    `<< /Filter /Standard /V 1 /R 2 /Length 40 /O <${owner.toString('hex')}> /U <${user.toString('hex')}> /P -4 >>`,
  ];
  const chunks = [Buffer.from('%PDF-1.4\n')],
    offsets = [0];
  let offset = chunks[0].length;
  objects.forEach((object, i) => {
    offsets.push(offset);
    const chunk = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.isBuffer(object) ? object : Buffer.from(object),
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(chunk);
    offset += chunk.length;
  });
  chunks.push(
    Buffer.from(
      `xref\n0 7\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((n) => String(n).padStart(10, '0') + ' 00000 n \n')
        .join(
          '',
        )}trailer\n<< /Size 7 /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString('hex')}> <${id.toString('hex')}>] >>\nstartxref\n${offset}\n%%EOF`,
    ),
  );
  return Buffer.concat(chunks);
}
