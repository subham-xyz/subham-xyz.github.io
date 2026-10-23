const tabs = [...document.querySelectorAll<HTMLButtonElement>('[role=tab]')];
function activate(tab: HTMLButtonElement) {
  tabs.forEach((button) => {
    const active = button === tab;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
    button.classList.toggle('category-active', active);
    document.getElementById(button.getAttribute('aria-controls')!)!.hidden =
      !active;
  });
}
tabs.forEach((tab, i) => {
  tab.addEventListener('click', () => activate(tab));
  tab.addEventListener('keydown', (event) => {
    let next: number;
    if (event.key === 'ArrowRight') next = (i + 1) % tabs.length;
    else if (event.key === 'ArrowLeft')
      next = (i - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault();
    activate(tabs[next]);
    tabs[next].focus();
  });
});
if (tabs[0]) activate(tabs[0]);
