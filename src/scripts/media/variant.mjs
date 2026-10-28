// Which FFmpeg build the media engine uses. The single-thread core works on
// every host (GitHub Pages included). The multi-threaded core needs
// SharedArrayBuffer, which browsers only allow on cross-origin isolated pages
// (COOP: same-origin and COEP: require-corp headers). To enable it on a host that
// can send those headers, copy @ffmpeg/core-mt's files to /local-engine/ffmpeg-mt/
// and set MULTI_THREAD_DEPLOYED to true; pages without isolation keep using the
// single-thread core, so nothing breaks.
export const MULTI_THREAD_DEPLOYED = false;

export function engineVariant() {
  return MULTI_THREAD_DEPLOYED && globalThis.crossOriginIsolated === true ? 'multi-thread' : 'single-thread';
}

export function engineDir(variant = engineVariant()) {
  return variant === 'multi-thread' ? '/local-engine/ffmpeg-mt/' : '/local-engine/ffmpeg/';
}
