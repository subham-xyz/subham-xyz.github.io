import { readRecent } from './recent';
import { renderIntent, type ResolvedIntent } from './search-command';

const grid = document.getElementById('tool-grid');
const input = document.querySelector<HTMLInputElement>('#home-search');
const chips = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-filter]'),
];
const empty = document.getElementById('search-empty');
const cards = grid
  ? [...grid.querySelectorAll<HTMLElement>('[data-tool-card]')]
  : [];
let filter = 'all';
const groups = grid
  ? [...grid.querySelectorAll<HTMLElement>('[data-group]')]
  : [];
const popularSection = document.getElementById('popular');

export function matches(keywords: string, query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return terms.every((term) => keywords.includes(term));
}

// English keywords plus the card's visible (possibly translated) name and summary,
// so localized pages find tools in their own language too.
const searchText = (card: HTMLElement) =>
  (card.dataset.search ??=
    `${card.dataset.keywords || ''} ${card.textContent || ''}`.toLowerCase());
const inFilter = (card: HTMLElement) =>
  filter === 'all' ||
  (filter === 'popular'
    ? card.hasAttribute('data-popular')
    : card.dataset.toolGroup === filter);
// Homepage: tools outside the highlights appear only when searching or filtering.
const curated = Boolean(grid?.closest('[data-curated]'));
const moreLink = document.getElementById('tools-more');
function apply() {
  const query = input?.value || '';
  const browsing = curated && filter === 'all' && !query.trim();
  let shown = 0;
  for (const card of cards) {
    card.hidden =
      !(inFilter(card) && matches(searchText(card), query)) ||
      (browsing && card.hasAttribute('data-more'));
    if (!card.hidden) shown++;
  }
  if (moreLink) moreLink.hidden = shown === 0;
  // Hide group headings that have nothing to show.
  for (const group of groups)
    group.hidden = !group.querySelector('[data-tool-card]:not([hidden])');
  // While searching, results matter more than the popular shortcuts above them.
  if (popularSection) popularSection.hidden = query.trim().length > 0;
  if (empty) empty.hidden = shown > 0;
}

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter || 'all';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    apply();
  }),
);
// "compress 50kb to 20kb" → an interpreted action under the box.
const intentBox = document.getElementById('home-intent');
const intentLink = intentBox?.querySelector<HTMLAnchorElement>('a') || null;
const intentStatus = document.getElementById('home-intent-status');
let intent: ResolvedIntent | null = null;
function showIntent() {
  if (!intentBox || !intentLink || !input) return;
  intent = renderIntent(intentLink, input.value);
  intentBox.hidden = !intent;
  if (intentStatus)
    intentStatus.textContent = intent
      ? `${[intent.label, intent.detail].filter(Boolean).join(', ')}. Press Enter to open.`
      : '';
}
input?.addEventListener('input', () => {
  apply();
  showIntent();
});
input?.addEventListener('focus', showIntent);
input?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && intentBox && !intentBox.hidden) {
    event.preventDefault();
    intentBox.hidden = true;
  }
  if (event.key === 'ArrowDown' && intent && intentLink) {
    event.preventDefault();
    intentLink.focus();
  }
});
intentLink?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'Escape') {
    event.preventDefault();
    input?.focus();
  }
});
const searchForm = input?.closest('form');
// Hide when focus or a tap moves elsewhere. iOS does not focus tapped links, so
// a plain blur would hide the row before its click lands.
searchForm?.addEventListener('focusout', (event) => {
  const next = event.relatedTarget as Node | null;
  if (intentBox && next && !searchForm.contains(next)) intentBox.hidden = true;
});
document.addEventListener('pointerdown', (event) => {
  if (intentBox && searchForm && !searchForm.contains(event.target as Node))
    intentBox.hidden = true;
});
searchForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const first = cards.find((card) => !card.hidden);
  // A clear command wins; otherwise keep the old "open the first match".
  if (intent && (intent.strong || !(first instanceof HTMLAnchorElement)))
    location.assign(intent.href);
  else if (first instanceof HTMLAnchorElement) first.click();
});

const query = new URLSearchParams(location.search).get('q');
if (input && query) {
  input.value = query.slice(0, 80);
  apply();
  document.getElementById('tools')?.scrollIntoView();
}

// "Tell Loki what you need": the same local intent parser as a conversational box.
const lokiInput = document.querySelector<HTMLInputElement>('#loki-input');
const lokiForm = lokiInput?.closest('form');
const lokiBox = document.getElementById('loki-intent');
const lokiLink = lokiBox?.querySelector<HTMLAnchorElement>('a') || null;
const lokiSay = document.getElementById('loki-status');
let lokiIntent: ResolvedIntent | null = null;
function lokiShow() {
  if (!lokiInput || !lokiBox || !lokiLink) return;
  lokiIntent = renderIntent(lokiLink, lokiInput.value);
  lokiBox.hidden = !lokiIntent;
  if (lokiSay)
    lokiSay.textContent = lokiIntent
      ? `${[lokiIntent.label, lokiIntent.detail].filter(Boolean).join(', ')}. Press Enter to open.`
      : '';
}
lokiInput?.addEventListener('input', lokiShow);
lokiInput?.addEventListener('focus', lokiShow);
lokiInput?.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && lokiBox && !lokiBox.hidden) {
    event.preventDefault();
    lokiBox.hidden = true;
  }
  if (event.key === 'ArrowDown' && lokiIntent && lokiLink) {
    event.preventDefault();
    lokiLink.focus();
  }
});
lokiLink?.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowUp' || event.key === 'Escape') {
    event.preventDefault();
    lokiInput?.focus();
  }
});
lokiForm?.addEventListener('focusout', (event) => {
  const next = event.relatedTarget as Node | null;
  if (lokiBox && next && !lokiForm.contains(next)) lokiBox.hidden = true;
});
document.addEventListener('pointerdown', (event) => {
  if (lokiBox && lokiForm && !lokiForm.contains(event.target as Node))
    lokiBox.hidden = true;
});
lokiForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  const query = lokiInput?.value.trim() || '';
  if (!query) return lokiInput?.focus();
  if (lokiIntent) return location.assign(lokiIntent.href);
  // Tool names and descriptions also match in the page language.
  const match = cards.find((card) => matches(searchText(card), query));
  const href = match?.getAttribute('href');
  if (href) return location.assign(href);
  if (lokiSay)
    lokiSay.textContent =
      'Loki couldn’t match that to a tool yet. Try “compress image to 50 KB”, or pick a goal below.';
});
document
  .querySelectorAll<HTMLButtonElement>('[data-loki-example]')
  .forEach((button) =>
    button.addEventListener('click', () => {
      if (!lokiInput) return;
      lokiInput.value = button.dataset.lokiExample || '';
      lokiInput.focus();
      lokiShow();
    }),
  );

// Recently used tools, remembered only in this browser.
const recentBox = document.getElementById('recent-tools');
const recentList = document.getElementById('recent-list');
if (recentBox && recentList) {
  const recent = readRecent()
    .map((href) => cards.find((card) => card.getAttribute('href') === href))
    .filter(Boolean) as HTMLElement[];
  if (recent.length) {
    recentList.replaceChildren(
      ...recent.slice(0, 4).map((card) => {
        const copy = card.cloneNode(true) as HTMLElement;
        copy.classList.add('tool-card-compact');
        copy.removeAttribute('data-tool-card');
        copy.removeAttribute('data-more');
        copy.hidden = false;
        copy.querySelector('p')?.remove();
        return copy;
      }),
    );
    recentBox.hidden = false;
  }
}
