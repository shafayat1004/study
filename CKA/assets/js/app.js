const doc = document.documentElement;
let searchOpen = false;
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
  if (mobileBar && !document.body.classList.contains("nav-open") && !searchOpen) {
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

// ---- Search: find matches, preview them, and jump between hits ----
const searchInputs = [document.getElementById("search"), document.getElementById("searchMobile")].filter(Boolean);
const resultsPanel = document.getElementById("searchResults");
const resultsList = document.getElementById("searchList");
const searchCount = document.getElementById("searchCount");
const toggleListBtn = document.getElementById("searchToggleList");
const mobileBarEl = document.querySelector(".mobile-bar");
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "PRE", "CODE", "MARK", "BUTTON"]);
const MAX_HITS = 120;

const sectionLabelById = new Map();
sections.forEach((section) => {
  const heading = section.querySelector("h1,h2");
  sectionLabelById.set(section.id, (heading ? heading.textContent : section.id).replace("CKA Study Guide", "Overview").trim());
});

let hits = [];
let activeHit = -1;
let searchTimer;

function updateBarHeight() {
  if (mobileBarEl) doc.style.setProperty("--bar-h", `${mobileBarEl.offsetHeight}px`);
}
updateBarHeight();
window.addEventListener("resize", updateBarHeight);

function clearMarks() {
  document.querySelectorAll("mark.search-hit").forEach((m) => {
    const parent = m.parentNode;
    if (!parent) return;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
}

function snippetAround(value, index, len) {
  const start = Math.max(0, index - 52);
  const end = Math.min(value.length, index + len + 52);
  let before = value.slice(start, index);
  let after = value.slice(index + len, end);
  if (start > 0) before = "… " + before.replace(/^\S+\s/, "");
  if (end < value.length) after = after.replace(/\s\S+$/, "") + " …";
  return { before, match: value.slice(index, index + len), after };
}

function collectHits(term) {
  hits = [];
  for (const section of sections) {
    if (hits.length >= MAX_HITS) break;
    const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.toLowerCase().includes(term)) return NodeFilter.FILTER_REJECT;
        let p = node.parentElement;
        while (p && p !== section) {
          if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
          p = p.parentElement;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const node of nodes) {
      if (hits.length >= MAX_HITS) break;
      const value = node.nodeValue;
      const lower = value.toLowerCase();
      const frag = document.createDocumentFragment();
      let last = 0;
      let idx = lower.indexOf(term);
      let found = false;
      while (idx !== -1 && hits.length < MAX_HITS) {
        found = true;
        if (idx > last) frag.appendChild(document.createTextNode(value.slice(last, idx)));
        const mark = document.createElement("mark");
        mark.className = "search-hit";
        mark.textContent = value.slice(idx, idx + term.length);
        frag.appendChild(mark);
        hits.push({ mark, sectionId: section.id, snippet: snippetAround(value, idx, term.length) });
        last = idx + term.length;
        idx = lower.indexOf(term, last);
      }
      if (found) {
        if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    }
  }
}

function updateCount() {
  if (!hits.length) return;
  const sectionCount = new Set(hits.map((h) => h.sectionId)).size;
  const capped = hits.length >= MAX_HITS ? "+" : "";
  const pos = activeHit >= 0 ? `${activeHit + 1} / ` : "";
  searchCount.textContent = `${pos}${hits.length}${capped} match${hits.length === 1 ? "" : "es"} in ${sectionCount} section${sectionCount === 1 ? "" : "s"}`;
}

function renderResults(term) {
  resultsList.replaceChildren();
  if (!hits.length) {
    searchCount.textContent = `No matches for “${term}”`;
    const empty = document.createElement("p");
    empty.className = "search-empty";
    empty.textContent = "Try Service, RBAC, etcd, Gateway, or StorageClass.";
    resultsList.appendChild(empty);
    return;
  }
  updateCount();
  hits.forEach((hit, i) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "search-hit-card";
    const sec = document.createElement("span");
    sec.className = "hit-section";
    sec.textContent = sectionLabelById.get(hit.sectionId) || hit.sectionId;
    const snip = document.createElement("span");
    snip.className = "hit-snippet";
    snip.appendChild(document.createTextNode(hit.snippet.before));
    const m = document.createElement("mark");
    m.textContent = hit.snippet.match;
    snip.appendChild(m);
    snip.appendChild(document.createTextNode(hit.snippet.after));
    card.append(sec, snip);
    card.addEventListener("click", () => gotoHit(i, true));
    hit.card = card;
    resultsList.appendChild(card);
  });
}

function setListCollapsed(collapsed) {
  resultsPanel.classList.toggle("is-collapsed", collapsed);
  toggleListBtn.setAttribute("aria-expanded", String(!collapsed));
}

function openSearch() {
  resultsPanel.classList.add("open");
  searchOpen = true;
  setListCollapsed(false);
  if (mobileBarEl) mobileBarEl.classList.remove("nav-hidden");
  updateBarHeight();
}

function closeSearch() {
  resultsPanel.classList.remove("open");
  searchOpen = false;
}

function gotoHit(index, collapseOnMobile) {
  if (!hits.length) return;
  activeHit = (index + hits.length) % hits.length;
  hits.forEach((h, j) => {
    h.mark.classList.toggle("active", j === activeHit);
    if (h.card) h.card.classList.toggle("active", j === activeHit);
  });
  const target = hits[activeHit];
  if (target.card) target.card.scrollIntoView({ block: "nearest" });
  target.mark.scrollIntoView({ block: "center", behavior: "smooth" });
  updateCount();
  if (collapseOnMobile && window.matchMedia("(max-width: 860px)").matches) setListCollapsed(true);
}

function clearSearch() {
  clearTimeout(searchTimer);
  clearMarks();
  hits = [];
  activeHit = -1;
  searchInputs.forEach((input) => { if (input.value) input.value = ""; });
  closeSearch();
}

function runSearch(rawValue) {
  clearMarks();
  const term = rawValue.trim().toLowerCase();
  activeHit = -1;
  if (term.length < 2) {
    hits = [];
    closeSearch();
    return;
  }
  collectHits(term);
  openSearch();
  renderResults(term);
}

searchInputs.forEach((input) => {
  input.addEventListener("input", () => {
    const value = input.value;
    searchInputs.forEach((other) => { if (other !== input && other.value !== value) other.value = value; });
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(value), 180);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); gotoHit(activeHit + 1, true); }
    else if (e.key === "Escape") { e.preventDefault(); clearSearch(); }
  });
});

toggleListBtn.addEventListener("click", () => setListCollapsed(!resultsPanel.classList.contains("is-collapsed")));
document.getElementById("searchNext").addEventListener("click", () => gotoHit(activeHit + 1, false));
document.getElementById("searchPrev").addEventListener("click", () => gotoHit(activeHit - 1, false));
document.getElementById("searchClear").addEventListener("click", clearSearch);

document.querySelectorAll('a[target="_blank"]').forEach((link) => {
  const text = link.textContent.trim();
  link.relList.add("noopener");
  if (!link.getAttribute("aria-label")) {
    link.setAttribute("aria-label", `${text} (opens in a new tab)`);
  }
});
