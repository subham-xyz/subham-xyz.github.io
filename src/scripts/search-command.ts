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
  /** Other tools offered next to this one ("my pdfs": combine or compress). */
  choices?: string[];
}

// What each offered choice does, shown under the tool name.
const CHOICE_DETAIL: Record<string, string> = {
  'merge-pdf': 'Combine into one PDF',
  'compress-pdf': 'Compress each PDF',
};

// Tool links already on the page carry the right (localized) URL, name and icon.
function toolLink(id: string) {
  return document.querySelector<HTMLAnchorElement>(`a[data-tool-id="${id}"]`);
}
function toolBase(id: string) {
  const link = toolLink(id);
  return link ? new URL(link.href, location.href).pathname : undefined;
}

export function resolveIntent(query: string): ResolvedIntent | null {
  const intent = parseSearchIntent(query);
  if (!intent) return null;
  const link = toolLink(intent.tool);
  return {
    tool: intent.tool,
    href: buildIntentRoute(intent, toolBase(intent.tool)),
    label: link?.dataset.toolName || intent.label,
    detail: intent.choices
      ? CHOICE_DETAIL[intent.tool] || ''
      : describeIntent(intent),
    strong: intent.confidence >= STRONG_INTENT,
    choices: intent.choices,
  };
}

function fill(
  anchor: HTMLAnchorElement,
  tool: string,
  href: string,
  label: string,
  detail: string,
) {
  anchor.href = href;
  const name = document.createElement('strong');
  name.textContent = label;
  const small = document.createElement('small');
  small.textContent = detail || 'Open the tool';
  const text = document.createElement('span');
  text.className = 'search-intent-text';
  text.append(name, small);
  const key = document.createElement('span');
  key.className = 'search-intent-key';
  key.setAttribute('aria-hidden', 'true');
  key.innerHTML =
    '<span class="key-enter">Enter ↵</span><span class="key-tap">Open ↗</span>';
  const icon = toolLink(tool)?.querySelector('.ti')?.cloneNode(true) as
    HTMLElement | undefined;
  anchor.replaceChildren(...(icon ? [icon] : []), text, key);
  anchor.setAttribute(
    'aria-label',
    `${[label, detail].filter(Boolean).join(', ')}. Press Enter to open.`,
  );
}

/** Fill an <a> with the interpreted action. Returns the resolved intent (or null to hide it). */
export function renderIntent(anchor: HTMLAnchorElement, query: string) {
  anchor.parentElement
    ?.querySelectorAll('.search-intent-alt')
    .forEach((alt) => alt.remove());
  const resolved = resolveIntent(query);
  if (!resolved) {
    anchor.removeAttribute('href');
    return null;
  }
  fill(anchor, resolved.tool, resolved.href, resolved.label, resolved.detail);
  // Extra choices sit right under the main one, in the same box.
  let after: Element = anchor;
  for (const id of (resolved.choices || []).filter(
    (c) => c !== resolved.tool,
  )) {
    const alt = document.createElement('a');
    alt.className = 'search-intent search-intent-alt';
    fill(
      alt,
      id,
      buildIntentRoute({ tool: id as any, params: {} } as any, toolBase(id)),
      toolLink(id)?.dataset.toolName || id,
      CHOICE_DETAIL[id] || '',
    );
    after.after(alt);
    after = alt;
  }
  return resolved;
}
