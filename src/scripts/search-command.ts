// Shows "Compress Image · Target: 20 KB · Enter" under a search box and routes to
// the tool with those settings. Parsing lives in search-intent.mjs.
import {
  parseSearchIntent,
  buildIntentRoute,
  describeIntent,
  STRONG_INTENT,
} from './search-intent.mjs';

export interface ResolvedIntent {
  tool: string;
  href: string;
  label: string;
  detail: string;
  strong: boolean;
}

// Tool links already on the page carry the right (localized) URL, name and icon.
function toolLink(id: string) {
  return document.querySelector<HTMLAnchorElement>(`a[data-tool-id="${id}"]`);
}

export function resolveIntent(query: string): ResolvedIntent | null {
  const intent = parseSearchIntent(query);
  if (!intent) return null;
  const link = toolLink(intent.tool);
  const base = link ? new URL(link.href, location.href).pathname : undefined;
  return {
    tool: intent.tool,
    href: buildIntentRoute(intent, base),
    label: link?.dataset.toolName || intent.label,
    detail: describeIntent(intent),
    strong: intent.confidence >= STRONG_INTENT,
  };
}

/** Fill an <a> with the interpreted action. Returns the resolved intent (or null to hide it). */
export function renderIntent(anchor: HTMLAnchorElement, query: string) {
  const resolved = resolveIntent(query);
  if (!resolved) {
    anchor.removeAttribute('href');
    return null;
  }
  anchor.href = resolved.href;
  const name = document.createElement('strong');
  name.textContent = resolved.label;
  const detail = document.createElement('small');
  detail.textContent = resolved.detail || 'Open the tool';
  const text = document.createElement('span');
  text.className = 'search-intent-text';
  text.append(name, detail);
  const key = document.createElement('span');
  key.className = 'search-intent-key';
  key.setAttribute('aria-hidden', 'true');
  key.innerHTML = '<span class="key-enter">Enter ↵</span><span class="key-tap">Open ↗</span>';
  const icon = toolLink(resolved.tool)?.querySelector('.ti')?.cloneNode(true) as HTMLElement | undefined;
  anchor.replaceChildren(...(icon ? [icon] : []), text, key);
  anchor.setAttribute(
    'aria-label',
    `${[resolved.label, resolved.detail].filter(Boolean).join(', ')}. Press Enter to open.`,
  );
  return resolved;
}
