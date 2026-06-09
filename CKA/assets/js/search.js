// Shared find-and-jump search engine used by the study guide and the task bank.
// It marks matches across the supplied "sections", builds clickable preview
// cards (context + a section label), supports prev/next navigation, a compact
// mobile top-bar search, and a center-scroll + glow pulse onto the active hit.
//
// Required DOM (shared ids/classes on both pages):
//   #search, #searchMobile, #searchToggleMobile, .mobile-bar, .mobile-bar-row,
//   .search-box, #searchResults, #searchList, #searchCount, #searchToggleList,
//   #searchPrev, #searchNext, #searchClear
function initGuideSearch(options) {
  const {
    getSections,
    sectionLabel,
    emptyHint = "",
    groupNoun = "section",
    mobileSearchLabel = "Search"
  } = options;

  const searchInputs = [document.getElementById("search"), document.getElementById("searchMobile")].filter(Boolean);
  const resultsPanel = document.getElementById("searchResults");
  const resultsList = document.getElementById("searchList");
  const searchCount = document.getElementById("searchCount");
  const toggleListBtn = document.getElementById("searchToggleList");
  const nextBtn = document.getElementById("searchNext");
  const prevBtn = document.getElementById("searchPrev");
  const clearBtn = document.getElementById("searchClear");
  const mobileBarEl = document.querySelector(".mobile-bar");
  const mobileBarRowEl = document.querySelector(".mobile-bar-row");
  const searchBoxEl = document.querySelector(".search-box");
  const searchToggleMobile = document.getElementById("searchToggleMobile");
  const mobileSearchInput = document.getElementById("searchMobile");

  if (!resultsPanel || !resultsList || !searchCount || !searchInputs.length) return null;

  // Skip scripts/styles and UI chrome, but search code blocks — commands like
  // crictl and kubectl live almost entirely inside <code>/<pre> on this site.
  const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "MARK", "BUTTON"]);
  const MAX_HITS = 120;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let hits = [];
  let activeHit = -1;
  let searchTimer;

  // Dock the panel under whichever search box is in use: inside the sticky
  // mobile bar on phones, under the sidebar search on desktop.
  function dockPanel(input) {
    const anchor = input && input.id === "searchMobile" ? mobileBarRowEl : searchBoxEl;
    if (anchor && resultsPanel.previousElementSibling !== anchor) anchor.after(resultsPanel);
  }

  function tagName(el) {
    return el?.localName?.toLowerCase() || el?.tagName?.toLowerCase() || "";
  }

  // SVG <title>/<desc> are searchable but never painted — highlights there look
  // "hidden". Diagram <desc> often duplicates the visible caption as well.
  function svgMetaRole(node) {
    let p = node.parentElement;
    while (p) {
      const tag = tagName(p);
      if ((tag === "title" || tag === "desc") && p.closest("svg")) return tag;
      p = p.parentElement;
    }
    return null;
  }

  function diagramFigure(node) {
    return node.parentElement?.closest("svg")?.closest(".visual-card, .svg-figure") || null;
  }

  function visibleCaption(figure) {
    return figure?.querySelector(".visual-header strong") || null;
  }

  function descDuplicatesCaption(node, term) {
    if (svgMetaRole(node) !== "desc") return false;
    const caption = visibleCaption(diagramFigure(node));
    return Boolean(caption && caption.textContent.toLowerCase().includes(term));
  }

  function clearFigureSpotlights() {
    document.querySelectorAll(".search-figure-active, .search-figure-flash").forEach((el) => {
      el.classList.remove("search-figure-active", "search-figure-flash");
    });
  }

  function clearMarks() {
    document.querySelectorAll("mark.search-hit").forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      parent.replaceChild(document.createTextNode(m.textContent), m);
      parent.normalize();
    });
    clearFigureSpotlights();
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
    const sections = getSections() || [];
    for (const section of sections) {
      if (hits.length >= MAX_HITS) break;
      const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          if (!node.nodeValue.toLowerCase().includes(term)) return NodeFilter.FILTER_REJECT;
          if (descDuplicatesCaption(node, term)) return NodeFilter.FILTER_REJECT;
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
        const meta = svgMetaRole(node);
        const frag = document.createDocumentFragment();
        let last = 0;
        let idx = lower.indexOf(term);
        let found = false;
        let modified = false;
        while (idx !== -1 && hits.length < MAX_HITS) {
          found = true;
          if (meta) {
            const figure = diagramFigure(node);
            hits.push({
              mark: null,
              spotlight: figure || node.parentElement?.closest("svg"),
              section,
              snippet: snippetAround(value, idx, term.length)
            });
          } else {
            if (idx > last) frag.appendChild(document.createTextNode(value.slice(last, idx)));
            const mark = document.createElement("mark");
            mark.className = "search-hit";
            mark.textContent = value.slice(idx, idx + term.length);
            frag.appendChild(mark);
            hits.push({
              mark,
              spotlight: mark,
              section,
              snippet: snippetAround(value, idx, term.length)
            });
            modified = true;
          }
          last = idx + term.length;
          idx = lower.indexOf(term, last);
        }
        if (found && modified) {
          if (last < value.length) frag.appendChild(document.createTextNode(value.slice(last)));
          node.parentNode.replaceChild(frag, node);
        }
      }
    }
  }

  function updateCount() {
    if (!hits.length) return;
    const groupCount = new Set(hits.map((h) => h.section)).size;
    const capped = hits.length >= MAX_HITS ? "+" : "";
    const pos = activeHit >= 0 ? `${activeHit + 1} / ` : "";
    searchCount.textContent = `${pos}${hits.length}${capped} match${hits.length === 1 ? "" : "es"} in ${groupCount} ${groupNoun}${groupCount === 1 ? "" : "s"}`;
  }

  function renderResults(term) {
    resultsList.replaceChildren();
    if (!hits.length) {
      searchCount.textContent = `No matches for “${term}”`;
      const empty = document.createElement("p");
      empty.className = "search-empty";
      empty.textContent = emptyHint;
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
      sec.textContent = sectionLabel(hit.section);
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

  function syncLayout() {
    window.dispatchEvent(new Event("resize"));
  }

  function setListCollapsed(collapsed) {
    resultsPanel.classList.toggle("is-collapsed", collapsed);
    if (toggleListBtn) toggleListBtn.setAttribute("aria-expanded", String(!collapsed));
    syncLayout();
  }

  function openSearch(input) {
    dockPanel(input);
    resultsPanel.classList.add("open");
    document.body.classList.add("search-open");
    setListCollapsed(false);
    if (mobileBarEl) mobileBarEl.classList.remove("nav-hidden");
    syncLayout();
  }

  function closeSearch() {
    resultsPanel.classList.remove("open");
    document.body.classList.remove("search-open");
    syncLayout();
  }

  // Smooth-scroll to a target offset, then run a callback once scrolling settles.
  function afterScrollSettled(targetTop, callback) {
    if (Math.abs(window.scrollY - targetTop) < 2) { callback(); return; }
    window.scrollTo({ top: targetTop, behavior: "smooth" });
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("scrollend", finish);
      clearTimeout(timer);
      callback();
    };
    window.addEventListener("scrollend", finish);
    const timer = setTimeout(finish, 900);
  }

  // Apply the keyword focus highlight (active + one-shot glow). Called only
  // once scrolling has settled so the highlight starts after the scroll ends.
  function highlightHit(hit) {
    clearFigureSpotlights();
    hits.forEach((h) => {
      if (h.mark) h.mark.classList.toggle("active", h === hit);
      if (!h.mark && h.spotlight) h.spotlight.classList.toggle("search-figure-active", h === hit);
    });
    const target = hit.spotlight;
    if (!target) return;
    if (hit.mark) {
      target.classList.remove("flash");
      void target.offsetWidth;
      target.classList.add("flash");
      return;
    }
    target.classList.remove("search-figure-flash");
    void target.offsetWidth;
    target.classList.add("search-figure-flash");
  }

  // Scroll so the keyword sits at the vertical center, then focus-highlight it
  // once scrolling settles.
  function centerAndSpotlight(hit) {
    const target = hit.spotlight;
    if (!target) return;
    let p = target.parentElement;
    while (p) {
      if (p.tagName === "DETAILS" && !p.open) p.open = true;
      p = p.parentElement;
    }
    // The sticky mobile bar overlays the top of the screen, so the true visible
    // area starts below it. Center the keyword within that visible area.
    let topOffset = 0;
    if (mobileBarEl && getComputedStyle(mobileBarEl).display !== "none") {
      topOffset = Math.max(0, mobileBarEl.getBoundingClientRect().bottom);
    }
    const rect = target.getBoundingClientRect();
    const docCenterY = rect.top + window.scrollY + rect.height / 2;
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const desired = Math.min(Math.max(docCenterY - (window.innerHeight + topOffset) / 2, 0), maxScroll);
    if (reduceMotion.matches) {
      window.scrollTo({ top: desired, behavior: "auto" });
      highlightHit(hit);
      return;
    }
    afterScrollSettled(desired, () => highlightHit(hit));
  }

  function gotoHit(index, collapseOnMobile) {
    if (!hits.length) return;
    activeHit = (index + hits.length) % hits.length;
    hits.forEach((h, j) => {
      if (h.card) h.card.classList.toggle("active", j === activeHit);
    });
    const target = hits[activeHit];
    const onMobile = collapseOnMobile && window.matchMedia("(max-width: 860px)").matches;
    // Collapse the results list first so the sticky bar is at its final height
    // before we measure and compute the centered scroll target.
    if (onMobile) setListCollapsed(true);
    else if (target.card) target.card.scrollIntoView({ block: "nearest" });
    centerAndSpotlight(target);
    updateCount();
  }

  // Update the toggle's icon without clobbering its aria-hidden glyph span.
  function setToggleIcon(glyph) {
    if (!searchToggleMobile) return;
    const icon = searchToggleMobile.querySelector("span");
    if (icon) icon.textContent = glyph;
    else searchToggleMobile.textContent = glyph;
  }

  function collapseMobileSearch() {
    if (mobileBarEl) mobileBarEl.classList.remove("searching");
    if (searchToggleMobile) {
      setToggleIcon("🔍");
      searchToggleMobile.setAttribute("aria-expanded", "false");
      searchToggleMobile.setAttribute("aria-label", mobileSearchLabel);
    }
  }

  function clearSearch() {
    clearTimeout(searchTimer);
    clearMarks();
    hits = [];
    activeHit = -1;
    searchInputs.forEach((input) => { if (input.value) input.value = ""; });
    closeSearch();
    collapseMobileSearch();
  }

  function runSearch(rawValue, input) {
    clearMarks();
    const term = rawValue.trim().toLowerCase();
    activeHit = -1;
    if (term.length < 2) {
      hits = [];
      closeSearch();
      return;
    }
    collectHits(term);
    openSearch(input);
    renderResults(term);
  }

  searchInputs.forEach((input) => {
    input.addEventListener("input", () => {
      const value = input.value;
      searchInputs.forEach((other) => { if (other !== input && other.value !== value) other.value = value; });
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => runSearch(value, input), 180);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); gotoHit(activeHit + 1, true); }
      else if (e.key === "Escape") { e.preventDefault(); clearSearch(); }
    });
  });

  if (toggleListBtn) toggleListBtn.addEventListener("click", () => setListCollapsed(!resultsPanel.classList.contains("is-collapsed")));
  if (nextBtn) nextBtn.addEventListener("click", () => gotoHit(activeHit + 1, false));
  if (prevBtn) prevBtn.addEventListener("click", () => gotoHit(activeHit - 1, false));
  if (clearBtn) clearBtn.addEventListener("click", clearSearch);

  if (searchToggleMobile && mobileBarEl) {
    searchToggleMobile.addEventListener("click", () => {
      const active = mobileBarEl.classList.toggle("searching");
      if (active) {
        setToggleIcon("✕");
        searchToggleMobile.setAttribute("aria-expanded", "true");
        searchToggleMobile.setAttribute("aria-label", "Close search");
        if (mobileSearchInput) mobileSearchInput.focus();
      } else {
        clearSearch();
      }
    });
  }

  return { clear: clearSearch };
}

window.initGuideSearch = initGuideSearch;
