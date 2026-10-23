// Shared behaviour for tool sidebars: chip/radio groups that write into a
// hidden field, live slider readouts, tabs and the 3×3 position grid.
export function bindSidebar(root: HTMLElement, onChange: () => void) {
  const get = (id: string) => document.getElementById(id) as HTMLInputElement | null;
  const tablists = [...root.querySelectorAll<HTMLElement>('[role=tablist]')];

  root.querySelectorAll<HTMLInputElement>('input[data-sync]').forEach((radio) =>
    radio.addEventListener('change', () => {
      const target = get(radio.dataset.sync!);
      if (!target || !radio.checked) return;
      target.value = radio.value;
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }),
  );

  const readouts = [...root.querySelectorAll<HTMLInputElement>('input[data-show]')];
  const showValue = (input: HTMLInputElement) => {
    const out = get(input.dataset.show!);
    if (out) out.textContent = input.value + (input.dataset.suffix || '');
  };
  readouts.forEach((input) => {
    showValue(input);
    input.addEventListener('input', () => showValue(input));
  });

  const positions = [...root.querySelectorAll<HTMLInputElement>('input[data-position]')];
  positions.forEach((radio) =>
    radio.addEventListener('change', () => {
      const [x, y] = radio.value.split(',');
      const sx = get('stamp-x'),
        sy = get('stamp-y');
      if (sx && sy) {
        sx.value = x;
        sy.value = y;
        sx.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }),
  );

  // A custom colour unselects the swatches.
  get('text-color')?.addEventListener('input', (event) => {
    if (event.isTrusted)
      root
        .querySelectorAll<HTMLInputElement>('input[data-sync=text-color]')
        .forEach((r) => (r.checked = false));
  });

  for (const list of tablists) {
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[role=tab]')];
    const select = (tab: HTMLButtonElement, focus = false) => {
      for (const t of tabs) {
        const active = t === tab;
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls')!);
        if (panel) panel.hidden = !active;
      }
      root.querySelectorAll<HTMLElement>('[data-extra-for]').forEach((el) => {
        el.hidden = !el.dataset.extraFor!.split(' ').includes(tab.dataset.tab || '');
      });
      if (focus) tab.focus();
      onChange();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (event) => {
        const next =
          event.key === 'ArrowRight'
            ? (i + 1) % tabs.length
            : event.key === 'ArrowLeft'
              ? (i - 1 + tabs.length) % tabs.length
              : -1;
        if (next < 0) return;
        event.preventDefault();
        select(tabs[next], true);
      });
    });
  }

  root
    .querySelectorAll<HTMLInputElement | HTMLSelectElement>(
      'input:not([type=file]):not([data-sync]):not([data-position]),select',
    )
    .forEach((el) => el.addEventListener('input', onChange));

  return {
    activeTab() {
      const tab = tablists[tablists.length - 1]?.querySelector<HTMLElement>(
        '[role=tab][aria-selected=true]',
      );
      return tab?.dataset.tab || '';
    },
    clearPosition() {
      positions.forEach((r) => (r.checked = false));
    },
  };
}
