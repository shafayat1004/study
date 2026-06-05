const doc = document.documentElement;
const savedTheme = localStorage.getItem("cka-theme");
if (savedTheme) doc.setAttribute("data-theme", savedTheme);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("../sw.js").catch(() => {});
  });
}

const LAUNCH_URLS = {
  api: "https://killercoda.com/playgrounds/scenario/kubernetes",
  vm: "https://killercoda.com/playgrounds/scenario/kubernetes-kubeadm-2nodes"
};
const LAB_LABEL = { api: "API lab", vm: "VM lab" };
const DIFFICULTY_ORDER = { easy: 0, medium: 1, hard: 2 };
const DONE_KEY = "cka-tasks-done";

const state = {
  tasks: [],
  meta: null,
  sort: "recommended",
  filters: { domain: new Set(), labMode: new Set(), difficulty: new Set(), phase: new Set() },
  done: loadDone()
};

let searchApi = null;

function loadDone() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY)) || {}; } catch { return {}; }
}
function saveDone() {
  localStorage.setItem(DONE_KEY, JSON.stringify(state.done));
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).filter(Boolean).forEach((c) =>
    node.appendChild(typeof c === "string" ? document.createTextNode(c) : c)
  );
  return node;
}

function formatClock(seconds) {
  const neg = seconds < 0;
  const abs = Math.abs(seconds);
  const m = String(Math.floor(abs / 60)).padStart(2, "0");
  const s = String(abs % 60).padStart(2, "0");
  return `${neg ? "-" : ""}${m}:${s}`;
}

function cmdBlock(label, command) {
  const pre = el("pre", {}, [el("code", { text: command })]);
  const copyBtn = el("button", { class: "copy-cmd", type: "button", text: "Copy" });
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(command);
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Select";
    }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
  });
  const block = el("div", { class: "cmd-block" }, [pre, copyBtn]);
  return el("div", {}, [el("span", { class: "field-label", text: label }), block]);
}

function buildTimer(task) {
  const limit = (task.timeLimitMin || 0) * 60;
  let remaining = limit;
  let timerId = null;

  const clock = el("span", { class: "timer-clock", text: formatClock(remaining) });
  const startBtn = el("button", { class: "timer-btn", type: "button", text: "Start" });
  const resetBtn = el("button", { class: "timer-btn", type: "button", text: "Reset" });

  function render() {
    clock.textContent = formatClock(remaining);
    clock.classList.toggle("over", remaining < 0);
  }
  function tick() {
    remaining -= 1;
    render();
  }
  function start() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
      startBtn.textContent = "Start";
    } else {
      timerId = setInterval(tick, 1000);
      startBtn.textContent = "Pause";
    }
  }
  function reset() {
    clearInterval(timerId);
    timerId = null;
    remaining = limit;
    startBtn.textContent = "Start";
    render();
  }
  startBtn.addEventListener("click", start);
  resetBtn.addEventListener("click", reset);

  return el("div", { class: "task-timer" }, [
    clock,
    el("span", { class: "timer-spacer" }),
    startBtn,
    resetBtn
  ]);
}

function domainLabel(id) {
  return state.meta?.domains?.[id]?.label || id;
}
function phaseLabel(id) {
  return state.meta?.phases?.find((p) => p.id === id)?.label || id;
}

function buildCard(task) {
  const head = el("div", { class: "task-head" }, [
    el("div", {}, [
      el("div", { class: "task-id", text: task.id }),
      el("h3", { class: "task-title", text: task.title })
    ]),
    el("label", { class: "done-toggle" }, [
      (() => {
        const cb = el("input", { type: "checkbox" });
        cb.checked = !!state.done[task.id];
        cb.addEventListener("change", () => {
          state.done[task.id] = cb.checked;
          saveDone();
          card.classList.toggle("is-done", cb.checked);
        });
        return cb;
      })(),
      "Done"
    ])
  ]);

  const badges = el("div", { class: "task-meta" }, [
    el("span", { class: `badge difficulty-${task.difficulty}`, text: task.difficulty }),
    el("span", { class: "badge labmode", text: LAB_LABEL[task.labMode] || task.labMode }),
    el("span", { class: "badge", text: domainLabel(task.domain) }),
    el("span", { class: "badge", text: `${task.timeLimitMin} min` }),
    el("span", { class: "badge", text: phaseLabel(task.phase) })
  ]);

  const hints = el("details", {}, [
    el("summary", { text: "Hints" }),
    el("div", { class: "details-body" }, [
      el("ul", { class: "hints" }, (task.hints || []).map((h) => el("li", { text: h })))
    ])
  ]);

  const verifyWrap = el("div", {}, [
    cmdBlock("Verify", task.verifyCmd),
    el("span", { class: "field-label", text: "Expected output" }),
    el("div", { class: "expected", text: task.expectedOutput })
  ]);

  const setupDetails = el("details", {}, [
    el("summary", { text: "Starting state (setup)" }),
    el("div", { class: "details-body" }, [cmdBlock("Setup", task.setup)])
  ]);

  const solutionDetails = el("details", {}, [
    el("summary", { text: "Solution" }),
    el("div", { class: "details-body" }, [cmdBlock("Solution", task.solution)])
  ]);

  const extras = [];
  if (task.assets && task.assets.length) {
    extras.push(el("p", { class: "assets-list", text: `Assets: ${task.assets.join(", ")}` }));
  }
  extras.push(el("p", { class: "outcomes", text: task.learningOutcomes }));

  const launch = el("a", {
    class: "launch-btn",
    href: LAUNCH_URLS[task.labMode] || LAUNCH_URLS.api,
    target: "_blank",
    rel: "noopener",
    "aria-label": `Launch ${LAB_LABEL[task.labMode] || task.labMode} playground (opens in a new tab)`
  }, [`Launch ${LAB_LABEL[task.labMode] || task.labMode} ↗`]);

  const foot = el("div", { class: "task-foot" }, [launch]);

  const card = el("article", {
    class: "task-card" + (state.done[task.id] ? " is-done" : ""),
    id: `task-${task.id}`,
    "data-id": task.id
  }, [
    head,
    badges,
    el("p", { class: "task-context", text: task.context }),
    el("p", { class: "task-objective" }, [el("strong", { text: "Objective: " }), task.objective]),
    buildTimer(task),
    hints,
    verifyWrap,
    setupDetails,
    solutionDetails,
    ...extras,
    foot
  ]);

  return card;
}

function matchesFilters(task) {
  const f = state.filters;
  if (f.domain.size && !f.domain.has(task.domain)) return false;
  if (f.labMode.size && !f.labMode.has(task.labMode)) return false;
  if (f.difficulty.size && !f.difficulty.has(task.difficulty)) return false;
  if (f.phase.size && !f.phase.has(task.phase)) return false;
  return true;
}

function sortTasks(list) {
  const phaseOrder = (state.meta?.phases || []).map((p) => p.id);
  const copy = [...list];
  if (state.sort === "id") {
    copy.sort((a, b) => a.id.localeCompare(b.id));
  } else {
    copy.sort((a, b) => {
      const pa = phaseOrder.indexOf(a.phase);
      const pb = phaseOrder.indexOf(b.phase);
      if (pa !== pb) return pa - pb;
      const da = DIFFICULTY_ORDER[a.difficulty] ?? 9;
      const db = DIFFICULTY_ORDER[b.difficulty] ?? 9;
      if (da !== db) return da - db;
      return a.id.localeCompare(b.id);
    });
  }
  return copy;
}

const grid = document.getElementById("taskGrid");
const taskCount = document.getElementById("taskCount");
const noResults = document.getElementById("noResults");

function render() {
  if (searchApi) searchApi.clear();
  const filtered = sortTasks(state.tasks.filter(matchesFilters));
  grid.replaceChildren(...filtered.map(buildCard));
  noResults.style.display = filtered.length ? "none" : "block";
  taskCount.textContent = `${filtered.length} of ${state.tasks.length} tasks`;
}

function buildChip(group, value, label, weight) {
  const chip = el("button", {
    class: "chip",
    type: "button",
    "aria-pressed": "false",
    "data-group": group,
    "data-value": value
  });
  chip.appendChild(document.createTextNode(label));
  if (weight != null) chip.appendChild(el("span", { class: "chip-weight", text: ` ${weight}%` }));
  chip.addEventListener("click", () => {
    const set = state.filters[group];
    if (set.has(value)) { set.delete(value); chip.classList.remove("active"); chip.setAttribute("aria-pressed", "false"); }
    else { set.add(value); chip.classList.add("active"); chip.setAttribute("aria-pressed", "true"); }
    render();
  });
  return chip;
}

function buildFilters() {
  const domainBox = document.getElementById("domainChips");
  Object.entries(state.meta.domains).forEach(([id, d]) =>
    domainBox.appendChild(buildChip("domain", id, d.label.replace(/,.*$/, ""), d.weight))
  );

  const labBox = document.getElementById("labModeChips");
  Object.keys(LAB_LABEL).forEach((m) => labBox.appendChild(buildChip("labMode", m, LAB_LABEL[m])));

  const diffBox = document.getElementById("difficultyChips");
  ["easy", "medium", "hard"].forEach((d) => diffBox.appendChild(buildChip("difficulty", d, d)));

  const phaseBox = document.getElementById("phaseChips");
  state.meta.phases.forEach((p) => phaseBox.appendChild(buildChip("phase", p.id, p.label)));
}

// Sort chips
document.getElementById("sortChips").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-sort]");
  if (!btn) return;
  state.sort = btn.dataset.sort;
  [...e.currentTarget.querySelectorAll(".chip")].forEach((c) => {
    const active = c === btn;
    c.classList.toggle("active", active);
    c.setAttribute("aria-pressed", String(active));
  });
  render();
});

// Reset filters
document.getElementById("resetFilters").addEventListener("click", () => {
  Object.values(state.filters).forEach((s) => s.clear());
  document.querySelectorAll(".chip-row .chip[data-group]").forEach((c) => {
    c.classList.remove("active");
    c.setAttribute("aria-pressed", "false");
  });
  render();
});

// Theme toggle
const themeButtons = [document.getElementById("themeToggle"), document.getElementById("themeMobile")].filter(Boolean);
const darkMedia = window.matchMedia("(prefers-color-scheme: dark)");
function effectiveDark() {
  const attr = doc.getAttribute("data-theme");
  if (attr === "dark") return true;
  if (attr === "light") return false;
  return darkMedia.matches;
}
function syncThemeButtons() {
  const isDark = effectiveDark();
  themeButtons.forEach((b) => {
    b.setAttribute("aria-pressed", String(isDark));
    b.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
  });
}
function toggleTheme() {
  const next = effectiveDark() ? "light" : "dark";
  doc.setAttribute("data-theme", next);
  localStorage.setItem("cka-theme", next);
  syncThemeButtons();
}
syncThemeButtons();
themeButtons.forEach((b) => b.addEventListener("click", toggleTheme));
darkMedia.addEventListener("change", () => {
  if (!localStorage.getItem("cka-theme")) syncThemeButtons();
});

// Mobile nav
const sidebar = document.getElementById("sidebar");
const openNav = document.getElementById("openNav");
const focusableSelector = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";
let lastNavTrigger = null;
function setNavOpen(isOpen, { restoreFocus = true } = {}) {
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
  if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
    e.preventDefault();
    setNavOpen(false);
  }
});

// Progress bar
const progress = document.getElementById("progress");
document.addEventListener("scroll", () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, window.scrollY / max))})`;
}, { passive: true });

// External-link a11y
function decorateExternalLinks() {
  document.querySelectorAll('a[target="_blank"]').forEach((link) => {
    link.relList.add("noopener");
    if (!link.getAttribute("aria-label")) {
      link.setAttribute("aria-label", `${link.textContent.trim()} (opens in a new tab)`);
    }
  });
}

// Shared find-and-jump search across the rendered task cards.
searchApi = initGuideSearch({
  getSections: () => [...grid.querySelectorAll(".task-card")],
  sectionLabel: (card) => {
    const title = card.querySelector(".task-title")?.textContent || "";
    return `${card.dataset.id} · ${title}`.trim();
  },
  emptyHint: "Try a task id, domain, or a keyword like ingress, RBAC, or etcd.",
  groupNoun: "task",
  mobileSearchLabel: "Search tasks"
});

async function init() {
  try {
    const res = await fetch("tasks.json");
    if (!res.ok) throw new Error("fetch failed");
    const data = await res.json();
    state.meta = data.meta;
    state.tasks = data.tasks;
    buildFilters();
    render();
    decorateExternalLinks();
  } catch {
    document.getElementById("loadError").hidden = false;
    taskCount.textContent = "";
  }
}

init();
