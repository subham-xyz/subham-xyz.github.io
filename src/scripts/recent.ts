const KEY = 'kittysuite-recent';

export function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((v) => typeof v === 'string' && /^\/[a-z0-9-]+\/$/.test(v))
      : [];
  } catch {
    return [];
  }
}

export function rememberTool(path: string) {
  // Only tool pages are remembered; they mark <body data-tool-page>.
  if (!document.body.hasAttribute('data-tool-page') || !/^\/[a-z0-9-]+\/$/.test(path)) return;
  try {
    const next = [path, ...readRecent().filter((p) => p !== path)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage can be unavailable; recent tools are only a convenience. */
  }
}
