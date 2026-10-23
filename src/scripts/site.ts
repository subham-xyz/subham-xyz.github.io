const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>("#theme-toggle");
function labelTheme() {
  themeButton?.setAttribute(
    "aria-label",
    `Switch to ${root.dataset.theme === "dark" ? "light" : "dark"} mode`,
  );
}
labelTheme();
let changingTheme = false;
themeButton?.addEventListener('click', async () => {
  if (changingTheme) return;
  const nextTheme = root.dataset.theme === 'dark' ? 'light' : 'dark';
  try { localStorage.setItem('kittysuite-theme', nextTheme); } catch {}
  const apply = () => { root.dataset.theme = nextTheme; labelTheme(); };
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !document.startViewTransition) { apply(); return; }
  changingTheme = true;
  const corner = nextTheme === 'dark' ? '100% 0%' : '0% 100%';
  const radius = Math.ceil(Math.hypot(innerWidth, innerHeight));
  root.classList.add('theme-changing');
  try {
    const transition = document.startViewTransition(apply);
    const finished = transition.finished.catch(() => {});
    const updated = transition.updateCallbackDone.catch(() => {});
    await transition.ready;
    const reveal = root.animate({clipPath:[`circle(0px at ${corner})`, `circle(${radius}px at ${corner})`]},
      {duration:480,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards',pseudoElement:'::view-transition-new(root)'});
    await Promise.all([reveal.finished, finished, updated]);
  } catch { apply(); }
  finally { root.classList.remove('theme-changing'); changingTheme=false; }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener(
  "change",
  (event) => {
    let saved;
    try {
      saved = localStorage.getItem("kittysuite-theme");
    } catch {}
    if (!saved) {
      root.dataset.theme = event.matches ? "dark" : "light";
      labelTheme();
    }
  },
);
const menu = document.querySelector<HTMLElement>("#mobile-nav");
const toggle = document.querySelector<HTMLButtonElement>("#menu-toggle");
function closeMenu() {
  if (menu) menu.hidden = true;
  toggle?.setAttribute("aria-expanded", "false");
  toggle?.setAttribute("aria-label", "Open navigation");
}
toggle?.addEventListener("click", () => {
  if (!menu) return;
  menu.hidden = !menu.hidden;
  toggle.setAttribute("aria-expanded", String(!menu.hidden));
  toggle.setAttribute(
    "aria-label",
    menu.hidden ? "Open navigation" : "Close navigation",
  );
});
menu
  ?.querySelectorAll("a")
  .forEach((link) => link.addEventListener("click", closeMenu));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menu && !menu.hidden) {
    closeMenu();
    toggle?.focus();
  }
});
const kitties = document.querySelectorAll<HTMLElement>("[data-kitty]");
const observer = new IntersectionObserver((entries) =>
  entries.forEach((entry) => {
    (entry.target as HTMLElement).dataset.paused = String(
      !entry.isIntersecting,
    );
  }),
);
kitties.forEach((kitty) => {
  observer.observe(kitty);
  const pet = kitty.querySelector("button");
  const guardian = kitty.closest<HTMLElement>(".guardian-scene");
  let timer: ReturnType<typeof setTimeout>;
  let tiltFrame = 0;
  let bounds: DOMRect | undefined;
  const resetTilt = () => { cancelAnimationFrame(tiltFrame); kitty.style.setProperty('--head-tilt','0deg'); kitty.style.setProperty('--eye-look','0px'); };
  pet?.addEventListener("pointerenter", () => {
    kitty.dataset.state = "hover";
    bounds = pet!.getBoundingClientRect();
    kitty.style.setProperty('--head-tilt','-3deg');
  });
  pet?.addEventListener("pointerleave", () => {
    kitty.dataset.state = "idle";
    resetTilt();
  });
  pet?.addEventListener("focus", () => {
    kitty.dataset.state = "curious";
    kitty.style.setProperty("--head-tilt","-4deg");
  });
  pet?.addEventListener("blur", () => {
    resetTilt();
    kitty.dataset.state = "idle";
  });
  pet?.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' || !bounds || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const offset = Math.max(-1,Math.min(1,(event.clientX-bounds.left)/bounds.width*2-1));
    cancelAnimationFrame(tiltFrame);
    tiltFrame=requestAnimationFrame(() => {kitty.style.setProperty('--head-tilt',`${offset*5}deg`);kitty.style.setProperty('--eye-look',`${offset*2}px`);});
  });
  pet?.addEventListener("click", () => {
    clearTimeout(timer);
    kitty.dataset.state = "success";
    guardian?.classList.add("branches-awake");
    timer = setTimeout(() => {
      kitty.dataset.state = "idle";
      guardian?.classList.remove("branches-awake");
    }, 1600);
  });
});
document.addEventListener("visibilitychange", () => {
  kitties.forEach((kitty) => {
    if (document.hidden) kitty.dataset.paused = "true";
    else {
      observer.unobserve(kitty);
      observer.observe(kitty);
    }
  });
});

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Consistent easing for same-page links; user input interrupts immediately.
let scrollFrame = 0;
let stopScroll = () => {};
document.querySelectorAll<HTMLAnchorElement>('a[href*="#"]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !url.hash) return;
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)));
    if (!target || link.classList.contains('skip-link')) return;
    event.preventDefault();
    stopScroll();
    const start = scrollY;
    const end = Math.max(0, Math.min(start + target.getBoundingClientRect().top - 28, document.documentElement.scrollHeight - innerHeight));
    const distance = end - start;
    const duration = Math.min(800, Math.max(420, Math.abs(distance) * .35));
    const began = performance.now();
    const previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    let stopped = false;
    const cleanup = () => {
      cancelAnimationFrame(scrollFrame); root.style.scrollBehavior = previous;
      window.removeEventListener('wheel', interrupt); window.removeEventListener('touchstart', interrupt); window.removeEventListener('keydown', interrupt);
    };
    const interrupt = () => { stopped = true; cleanup(); };
    stopScroll = interrupt;
    window.addEventListener('wheel', interrupt, {passive:true}); window.addEventListener('touchstart', interrupt, {passive:true}); window.addEventListener('keydown', interrupt);
    const finish = () => {
      cleanup(); history.pushState(null, '', url.hash);
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({preventScroll:true});
    };
    if (reducedMotion.matches) { window.scrollTo(0,end); finish(); return; }
    const tick = (now: number) => {
      if (stopped) return;
      const t = Math.min(1, (now-began)/duration);
      const eased = t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
      window.scrollTo(0, start + distance * eased);
      if (t < 1) scrollFrame = requestAnimationFrame(tick); else finish();
    };
    scrollFrame = requestAnimationFrame(tick);
  });
});

// Cross-document transitions may be skipped by the browser (including reduced motion).
for (const eventName of ['pageswap', 'pagereveal']) {
 window.addEventListener(eventName, (event: Event) => {
  const transition = (event as Event & {viewTransition?: ViewTransition}).viewTransition;
  if (transition) { void transition.ready.catch(() => {}); void transition.finished.catch(() => {}); }
 });
}
