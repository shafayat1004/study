const doc = document.documentElement;
const savedTheme = localStorage.getItem("cka-theme");
if (savedTheme) doc.setAttribute("data-theme", savedTheme);
function toggleTheme() {
  const next = doc.getAttribute("data-theme") === "dark" ? "light" : "dark";
  doc.setAttribute("data-theme", next);
  localStorage.setItem("cka-theme", next);
}
document.getElementById("themeToggle").addEventListener("click", toggleTheme);
document.getElementById("themeMobile").addEventListener("click", toggleTheme);
document.getElementById("printButton").addEventListener("click", () => window.print());

const sidebar = document.getElementById("sidebar");
document.getElementById("openNav").addEventListener("click", () => document.body.classList.add("nav-open"));
document.addEventListener("click", (e) => {
  if (document.body.classList.contains("nav-open") && !sidebar.contains(e.target) && e.target.id !== "openNav") {
    document.body.classList.remove("nav-open");
  }
});

const sections = [...document.querySelectorAll(".study-section, .hero")].filter(s => s.id);
const toc = document.getElementById("toc");
sections.forEach((section) => {
  const h = section.querySelector("h1,h2");
  if (!h) return;
  const a = document.createElement("a");
  a.href = "#" + section.id;
  a.textContent = h.textContent.replace("Comprehensive CKA Study Guide", "Overview");
  a.addEventListener("click", () => document.body.classList.remove("nav-open"));
  toc.appendChild(a);
});

const tocLinks = [...toc.querySelectorAll("a")];
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      tocLinks.forEach(a => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
    }
  });
}, {rootMargin: "-35% 0px -55% 0px", threshold: 0.01});
sections.forEach(s => observer.observe(s));

const progress = document.getElementById("progress");
const mobileBar = document.querySelector(".mobile-bar");
let lastScrollY = window.scrollY;
document.addEventListener("scroll", () => {
  const y = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.transform = `scaleX(${Math.max(0, Math.min(1, y / max))})`;

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
});
