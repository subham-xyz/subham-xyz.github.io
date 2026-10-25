import { readRecent } from './recent';

const grid = document.getElementById('tool-grid');
const input = document.querySelector<HTMLInputElement>('#home-search');
const chips = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-filter]'),
];
const empty = document.getElementById('search-empty');
const cards = grid
  ? [...grid.querySelectorAll<HTMLElement>('[data-tool-card]')]
  : [];
let filter = 'All';

export function matches(keywords: string, query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  return terms.every((term) => keywords.includes(term));
}

const inFilter = (card: HTMLElement) =>
  filter === 'All' || card.dataset.toolCategory === filter;
function apply() {
  const query = input?.value || '';
  let shown = 0;
  for (const card of cards) {
    card.hidden = !(
      inFilter(card) && matches(card.dataset.keywords || '', query)
    );
    if (!card.hidden) shown++;
  }
  if (empty) empty.hidden = shown > 0;
}

chips.forEach((chip) =>
  chip.addEventListener('click', () => {
    filter = chip.dataset.filter || 'All';
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
    apply();
  }),
);
input?.addEventListener('input', apply);
input?.closest('form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const first = cards.find((card) => !card.hidden);
  if (first instanceof HTMLAnchorElement) first.click();
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
