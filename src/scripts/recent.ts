const KEY = 'kittysuite-recent';

export function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(value)
      ? value.filter((v) => typeof v === 'string' && v.startsWith('/tools/'))
      : [];
  } catch {
    return [];
  }
}

export function rememberTool(path: string) {
  if (!path.startsWith('/tools/')) return;
  try {
    const next = [path, ...readRecent().filter((p) => p !== path)].slice(0, 6);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* Storage can be unavailable; recent tools are only a convenience. */
  }
}
