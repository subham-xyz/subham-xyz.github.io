const filters = document.querySelectorAll<HTMLButtonElement>(
  "[data-category-filter]",
);
const cards = document.querySelectorAll<HTMLElement>("[data-tool-category]");
filters.forEach((button) =>
  button.addEventListener("click", () => {
    const category = button.dataset.categoryFilter;
    filters.forEach((filter) => {
      const active = filter === button;
      filter.setAttribute("aria-pressed", String(active));
      filter.classList.toggle("category-active", active);
    });
    let count = 0;
    cards.forEach((card) => {
      card.hidden =
        category !== "All" && card.dataset.toolCategory !== category;
      if (!card.hidden) {
        count++;
        card.classList.remove("state-enter");
        requestAnimationFrame(() => card.classList.add("state-enter"));
      }
    });
    document.getElementById("category-status")!.textContent =
      `${count} ${category === "All" ? "" : category} tools shown.`;
  }),
);
