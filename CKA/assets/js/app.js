const doc = document.documentElement;
const scrollStorageKey = `cka-scroll-position:${location.pathname}`;
const savedTheme = localStorage.getItem("cka-theme");
if (savedTheme) doc.setAttribute("data-theme", savedTheme);

if ("scrollRestoration" in history && !location.hash) {
  history.scrollRestoration = "manual";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

async function loadSvgDiagrams() {
  const placeholders = [...document.querySelectorAll("[data-svg-src]")];

  await Promise.all(placeholders.map(async (placeholder, index) => {
    const src = placeholder.dataset.svgSrc;

    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Unable to load ${src}`);

      const svgText = await response.text();
      const parsed = new DOMParser().parseFromString(svgText, "image/svg+xml");
      const svg = parsed.documentElement;

      if (svg.tagName.toLowerCase() !== "svg") throw new Error("Loaded file is not an SVG");

      const importedSvg = document.importNode(svg, true);
      const label = placeholder.getAttribute("aria-label") || "Diagram";
      const figure = placeholder.closest(".visual-card, .svg-figure");
      const captionParts = [
        figure?.querySelector(".visual-header strong")?.textContent,
        figure?.querySelector(".cap")?.textContent
      ].filter(Boolean);
      const titleId = `diagram-title-${index}`;
      const descId = `diagram-desc-${index}`;
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      const desc = document.createElementNS("http://www.w3.org/2000/svg", "desc");

      title.id = titleId;
      title.textContent = label;
      desc.id = descId;
      desc.textContent = captionParts.join(". ") || label;
      importedSvg.prepend(desc);
      importedSvg.prepend(title);
      importedSvg.setAttribute("role", "img");
      importedSvg.setAttribute("aria-labelledby", `${titleId} ${descId}`);

      placeholder.replaceWith(importedSvg);
    } catch {
      const img = document.createElement("img");
      img.className = "diagram";
      img.src = src;
      img.alt = placeholder.getAttribute("aria-label") || "Diagram";
      placeholder.replaceWith(img);
    }
  }));
}

const svgLoadPromise = loadSvgDiagrams();

async function restoreLastScrollPosition() {
  if (location.hash) return;

  const savedY = Number(localStorage.getItem(scrollStorageKey));
  if (!Number.isFinite(savedY) || savedY <= 0) return;

  await svgLoadPromise;
  requestAnimationFrame(() => window.scrollTo({ top: savedY, behavior: "auto" }));
}

restoreLastScrollPosition();

const themeButtons = [document.getElementById("themeToggle"), document.getElementById("themeMobile")].filter(Boolean);
function syncThemeButtons() {
  const isDark = doc.getAttribute("data-theme") === "dark";
  themeButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(isDark));
    button.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  });
}

function toggleTheme() {
  const next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
  doc.setAttribute("data-theme", next);
  localStorage.setItem("cka-theme", next);
  syncThemeButtons();
}
syncThemeButtons();
themeButtons.forEach((button) => button.addEventListener("click", toggleTheme));
document.getElementById("printButton").addEventListener("click", async () => {
  await svgLoadPromise;
  window.print();
});

const sidebar = document.getElementById("sidebar");
const openNav = document.getElementById("openNav");
const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])";
let lastNavTrigger = null;

function setNavOpen(isOpen, options = {}) {
  const { restoreFocus = true } = options;

  document.body.classList.toggle("nav-open", isOpen);
  openNav.setAttribute("aria-expanded", String(isOpen));
  openNav.setAttribute("aria-label", isOpen ? "Close navigation" : "Open navigation");

  if (isOpen) {
    lastNavTrigger = document.activeElement;
    requestAnimationFrame(() => sidebar.querySelector(focusableSelector)?.focus());
  } else if (restoreFocus && lastNavTrigger instanceof HTMLElement) {
    lastNavTrigger.focus();
  }
}

openNav.addEventListener("click", () => setNavOpen(!document.body.classList.contains("nav-open")));
document.addEventListener("click", (e) => {
  if (document.body.classList.contains("nav-open") && !sidebar.contains(e.target) && !openNav.contains(e.target)) {
    setNavOpen(false);
  }
});
document.addEventListener("keydown", (e) => {
  if (!document.body.classList.contains("nav-open")) return;

  if (e.key === "Escape") {
    e.preventDefault();
    setNavOpen(false);
    return;
  }

  if (e.key === "Tab") {
    const focusable = [...sidebar.querySelectorAll(focusableSelector)].filter((el) => el.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
});

const sections = [...document.querySelectorAll(".study-section, .hero")].filter(s => s.id);
const toc = document.getElementById("toc");
sections.forEach((section) => {
  const h = section.querySelector("h1,h2");
  if (!h) return;
  const a = document.createElement("a");
  a.href = "#" + section.id;
  a.textContent = h.textContent.replace("CKA Study Guide", "Overview");
  a.addEventListener("click", () => setNavOpen(false, {restoreFocus: false}));
  toc.appendChild(a);
});

const tocLinks = [...toc.querySelectorAll("a")];
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      tocLinks.forEach((a) => {
        const isActive = a.getAttribute("href") === "#" + entry.target.id;
        a.classList.toggle("active", isActive);
        if (isActive) {
          a.setAttribute("aria-current", "location");
        } else {
          a.removeAttribute("aria-current");
        }
      });
    }
  });
}, {rootMargin: "-35% 0px -55% 0px", threshold: 0.01});
sections.forEach(s => observer.observe(s));

const progress = document.getElementById("progress");
const mobileBar = document.querySelector(".mobile-bar");
let lastScrollY = window.scrollY;
let scrollSaveTimer;
document.addEventListener("scroll", () => {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, y / max))})`;

  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(() => localStorage.setItem(scrollStorageKey, String(Math.round(y))), 150);

  // Auto-hide the mobile bar on scroll down, reveal it on scroll up.
  if (mobileBar && !document.body.classList.contains("nav-open")) {
    if (y > lastScrollY && y > 80) {
      mobileBar.classList.add("nav-hidden");
    } else if (y < lastScrollY) {
      mobileBar.classList.remove("nav-hidden");
    }
  }
  lastScrollY = y;
}, {passive: true});

window.addEventListener("beforeunload", () => {
  localStorage.setItem(scrollStorageKey, String(Math.round(window.scrollY)));
});

document.querySelectorAll(".code-wrap").forEach(wrap => {
  const btn = document.createElement("button");
  btn.className = "copy-code";
  btn.type = "button";
  btn.textContent = "Copy";
  btn.addEventListener("click", async () => {
    const code = wrap.querySelector("pre")?.innerText || "";
    try {
      await navigator.clipboard.writeText(code);
      btn.textContent = "Copied";
      setTimeout(() => btn.textContent = "Copy", 1200);
    } catch {
      btn.textContent = "Select";
      setTimeout(() => btn.textContent = "Copy", 1200);
    }
  });
  wrap.appendChild(btn);
});

const search = document.getElementById("search");
const noResults = document.getElementById("noResults");
const searchStatus = document.createElement("p");
searchStatus.className = "sr-only";
searchStatus.setAttribute("aria-live", "polite");
searchStatus.setAttribute("role", "status");
search.after(searchStatus);
function clearMarks(el) {
  el.querySelectorAll("mark").forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent)));
  el.normalize();
}
function markText(el, term) {
  if (!term || term.length < 2) return;
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue.toLowerCase().includes(term)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement && ["SCRIPT","STYLE","CODE","PRE"].includes(node.parentElement.tagName)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.slice(0, 20).forEach(node => {
    const text = node.nodeValue;
    const i = text.toLowerCase().indexOf(term);
    if (i < 0) return;
    const mark = document.createElement("mark");
    mark.textContent = text.slice(i, i + term.length);
    node.replaceWith(document.createTextNode(text.slice(0, i)), mark, document.createTextNode(text.slice(i + term.length)));
  });
}
search.addEventListener("input", () => {
  const q = search.value.trim().toLowerCase();
  let visible = 0;
  sections.forEach(section => {
    clearMarks(section);
    const hay = section.innerText.toLowerCase();
    const show = !q || hay.includes(q);
    section.style.display = show ? "" : "none";
    if (show) { visible++; markText(section, q); }
  });
  noResults.style.display = visible ? "none" : "block";
  searchStatus.textContent = q ? `${visible} matching sections found.` : "Search cleared.";
});

document.querySelectorAll('a[target="_blank"]').forEach((link) => {
  const text = link.textContent.trim();
  link.relList.add("noopener");
  if (!link.getAttribute("aria-label")) {
    link.setAttribute("aria-label", `${text} (opens in a new tab)`);
  }
});
