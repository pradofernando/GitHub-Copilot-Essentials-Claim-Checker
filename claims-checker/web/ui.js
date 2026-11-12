(() => {
  const storageKey = "claims-lab-theme";
  const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
  let preference = null;
  let storageWarning = "";

  function reportStorageError(error) {
    console.warn("Claims Lab could not persist the theme preference:", error);
    storageWarning = "This browser cannot save the theme. Your choice applies to this page only.";
    const status = document.querySelector("#themeStatus");
    if (status) status.textContent = storageWarning;
  }

  try {
    const saved = localStorage.getItem(storageKey);
    if (saved === "light" || saved === "dark") preference = saved;
    else if (saved !== null) console.warn("Claims Lab ignored an invalid saved theme:", saved);
  } catch (error) {
    reportStorageError(error);
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    const button = document.querySelector("#themeToggle");
    if (button) {
      const next = theme === "dark" ? "light" : "dark";
      button.setAttribute("aria-label", `Switch to ${next} mode`);
      button.title = storageWarning || `Switch to ${next} mode`;
      button.querySelector("[data-theme-label]").textContent = `${next === "dark" ? "Dark" : "Light"} mode`;
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = theme === "dark" ? "#101f33" : "#f2f6fc";
  }

  function syncNavigation() {
    const url = new URL(window.location.href);
    let active;
    if (url.pathname === "/") {
      active = { "#about": "about", "#how-it-works": "how", "#live-example": "example" }[url.hash] || "home";
    } else {
      const tab = url.searchParams.get("tab");
      active = url.hash === "#trace-section" ? "trace" : url.hash === "#claims-section" ? "claims" : ["checks", "raw", "source"].includes(tab) ? tab : "workbench";
    }
    document.querySelectorAll(".site-tab").forEach((link) => {
      if (link.dataset.view === active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  applyTheme(preference || (systemTheme.matches ? "dark" : "light"));
  systemTheme.addEventListener("change", (event) => {
    if (preference === null) applyTheme(event.matches ? "dark" : "light");
  });
  window.addEventListener("hashchange", syncNavigation);
  window.addEventListener("popstate", syncNavigation);

  document.addEventListener("claims-lab:selection", (event) => {
    const claimId = event.detail.claim_id;
    document.querySelectorAll("[data-workbench-link]").forEach((link) => {
      const url = new URL(link.href);
      url.searchParams.set("claim", claimId);
      link.href = `${url.pathname}${url.search}${url.hash}`;
    });
  });

  document.addEventListener("claims-lab:inspector", (event) => {
    const url = new URL(window.location.href);
    url.searchParams.set("tab", event.detail.tab);
    url.hash = "claim-inspector";
    window.history.replaceState(null, "", url);
    syncNavigation();
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a.site-tab[data-workbench-link]");
    if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const current = new URL(window.location.href);
    const target = new URL(link.href);
    if (!current.pathname.startsWith("/lab") || !target.pathname.startsWith("/lab")) return;
    event.preventDefault();
    window.history.pushState(null, "", target);
    document.dispatchEvent(new CustomEvent("claims-lab:navigate"));
    syncNavigation();
    if (target.hash) document.querySelector(target.hash)?.scrollIntoView({ block: "start" });
    else window.scrollTo({ top: 0 });
  });

  document.addEventListener("DOMContentLoaded", () => {
    applyTheme(document.documentElement.dataset.theme);
    syncNavigation();
    if (storageWarning) document.querySelector("#themeStatus").textContent = storageWarning;
    document.querySelector("#themeToggle").addEventListener("click", () => {
      preference = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(storageKey, preference);
      } catch (error) {
        reportStorageError(error);
      }
      applyTheme(preference);
    });
  });
})();
