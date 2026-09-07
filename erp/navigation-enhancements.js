const SECTION_BY_MODULE = {
  dashboard: "Visão geral",
  tasks: "Operação diária",
  goals: "Estratégia e projetos",
  documents: "Governança",
  users: "Sistema",
};

function enhanceMenu(menu) {
  for (const label of menu.querySelectorAll(".menu-section[data-enhanced]")) label.remove();
  for (const [module, label] of Object.entries(SECTION_BY_MODULE)) {
    const button = menu.querySelector(`button[data-module="${module}"]`);
    if (!button) continue;
    const existing = button.previousElementSibling;
    if (existing?.classList.contains("menu-section") && !existing.dataset.enhanced) {
      existing.textContent = label;
      continue;
    }
    const section = document.createElement("span");
    section.className = "menu-section";
    section.dataset.enhanced = "true";
    section.textContent = label;
    button.before(section);
  }
  for (const button of menu.querySelectorAll("button[data-module]")) {
    const text = button.querySelector(".menu-label")?.textContent?.trim();
    if (text) button.title = text;
  }
}

const menu = document.getElementById("erpMenu");
if (menu) {
  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => { scheduled = false; observer.disconnect(); enhanceMenu(menu); observer.observe(menu, { childList: true }); });
  });
  observer.observe(menu, { childList: true });
  enhanceMenu(menu);
}
