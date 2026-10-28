// Google Analytics 4, loaded only when PUBLIC_GA_MEASUREMENT_ID is set.
// Only anonymous product events are sent: the page path and simple counts.
// File names, file contents, typed text and form fields are never sent.
type Gtag = (...args: unknown[]) => void;
const id = document.body.dataset.ga;
if (id && /^G-[A-Z0-9]+$/.test(id)) {
  const w = window as unknown as { dataLayer: unknown[]; gtag: Gtag };
  w.dataLayer = w.dataLayer || [];
  // gtag.js expects the arguments object itself, not an array.
  w.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer.push(arguments);
  };
  w.gtag('js', new Date());
  w.gtag('config', id, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });
  const script = document.createElement('script');
  script.async = true;
  // Pages are cross-origin isolated (COEP: require-corp), so third-party
  // scripts must load in CORS mode; Google serves gtag.js with CORS headers.
  script.crossOrigin = 'anonymous';
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.append(script);

  const tool = location.pathname.replaceAll('/', '') || 'home';
  const send = (name: string, params: Record<string, string | number> = {}) =>
    w.gtag('event', name, { tool, ...params });
  if (document.body.hasAttribute('data-tool-page')) send('tool_open');
  document.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement;
    if (
      input instanceof HTMLInputElement &&
      input.type === 'file' &&
      input.files?.length
    )
      send('file_selected', { count: input.files.length });
  });
  document.addEventListener('drop', (event) => {
    const count = event.dataTransfer?.files.length || 0;
    if (count) send('file_selected', { count, method: 'drop' });
  });
  document.addEventListener('kittysuite:done', () =>
    send(
      tool === 'image-compressor' || tool === 'compress-pdf'
        ? 'compression_completed'
        : tool.includes('convert') || tool.includes('-to-')
          ? 'conversion_completed'
          : 'task_completed',
    ),
  );
  document.addEventListener('click', (event) => {
    const link = (event.target as Element).closest?.('a[download]');
    if (link) send('download_clicked');
  });
}
