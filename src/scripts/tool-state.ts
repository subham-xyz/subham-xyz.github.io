export function setKittyState(workspace: HTMLElement, state: string) {
  workspace.querySelectorAll<HTMLElement>('[data-kitty]').forEach(kitty => kitty.dataset.state = state);
  // Lets optional analytics count finished tasks. No file details are attached.
  if (state === 'success' && workspace !== document.body) document.dispatchEvent(new CustomEvent('kittysuite:done'));
}
export function showPanel(workspace: HTMLElement, panelId: string, state: string) {
  workspace.querySelectorAll<HTMLElement>('.state-panel').forEach(panel => {
    panel.hidden = panel.id !== panelId;
    panel.classList.remove('state-enter');
    if (!panel.hidden) panel.classList.add('state-enter');
  });
  workspace.setAttribute('aria-busy', String(state === 'processing'));
  setKittyState(workspace, state === 'result' ? 'success' : state === 'error' ? 'error' : state === 'processing' ? 'processing' : 'idle');
}
