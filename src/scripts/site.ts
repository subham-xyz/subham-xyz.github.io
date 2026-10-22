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
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  changingTheme = true;
  const traveler = document.querySelector<HTMLElement>('.theme-traveler')!;
  const dark = nextTheme === 'dark';
  const extentX = Math.max(0, innerWidth - 100), extentY = Math.max(0, innerHeight - 100);
  const start = `translate(${dark ? extentX : 0}px, ${dark ? 0 : extentY}px)`;
  const end = `translate(${dark ? 0 : extentX}px, ${dark ? extentY : 0}px)`;
  traveler.style.transform = start;
  traveler.style.visibility = 'visible';
  root.classList.add('theme-changing');
  try {
    if (document.startViewTransition) {
      traveler.style.viewTransitionName = 'theme-loki';
      const transition = document.startViewTransition(() => { apply(); traveler.style.transform = end; });
      await transition.ready;
      const reveal = root.animate({clipPath: dark
        ? ['polygon(100% 0,100% 0,100% 0)', 'polygon(-100% 0,100% 0,100% 200%)']
        : ['polygon(0 100%,0 100%,0 100%)','polygon(0 -100%,200% 100%,0 100%)']
      }, {duration:560,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards',pseudoElement:'::view-transition-new(root)'});
      const catWalk = root.animate({transform:[start,end]}, {duration:560,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards',pseudoElement:'::view-transition-group(theme-loki)'});
      await Promise.all([reveal.finished, catWalk.finished, transition.finished]);
    } else {
      apply();
      await traveler.animate([{transform:start,opacity:0},{opacity:1,offset:.15},{transform:end,opacity:0}],{duration:480,easing:'ease-in-out'}).finished;
    }
  } catch { apply(); }
  finally {
    traveler.style.visibility='hidden'; traveler.style.viewTransitionName='none';
    root.classList.remove('theme-changing'); changingTheme=false;
  }
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
  let timer: ReturnType<typeof setTimeout>;
  pet?.addEventListener("pointerenter", () => {
    kitty.dataset.state = "hover";
  });
  pet?.addEventListener("pointerleave", () => {
    kitty.dataset.state = "idle";
  });
  pet?.addEventListener("focus", () => {
    kitty.dataset.state = "curious";
  });
  pet?.addEventListener("blur", () => {
    kitty.dataset.state = "idle";
  });
  pet?.addEventListener("click", () => {
    clearTimeout(timer);
    kitty.dataset.state = "success";
    timer = setTimeout(() => {
      kitty.dataset.state = "idle";
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

// A short paw-led reveal. Standard links still work without JavaScript.
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const departure = document.querySelector<HTMLAnchorElement>('[data-loki-transition]');
let departing = false;
departure?.addEventListener('click', event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || reducedMotion.matches) return;
  event.preventDefault();
  if (departing) return;
  departing = true;
  document.body.classList.add('loki-departure');
  setTimeout(() => location.assign(departure.href), 240);
});
window.addEventListener('pageshow', () => { departing = false; document.body.classList.remove('loki-departure'); });

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
