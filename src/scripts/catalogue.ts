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
function apply() {
  const query = input?.value || '';
  let shown = 0;
  for (const card of cards) {
    card.hidden = !(inFilter(card) && matches(searchText(card), query));
    if (!card.hidden) shown++;
  }
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
        copy.querySelector('p')?.remove();
        return copy;
      }),
    );
    recentBox.hidden = false;
  }
}
