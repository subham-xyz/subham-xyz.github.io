const root = document.documentElement;
const themeButton = document.querySelector<HTMLButtonElement>("#theme-toggle");
function labelTheme() {
  themeButton?.setAttribute(
    "aria-label",
    `Switch to ${root.dataset.theme === "dark" ? "light" : "dark"} mode`,
  );
}
labelTheme();
themeButton?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem("kittysuite-theme", root.dataset.theme);
  } catch {}
  labelTheme();
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
