// Page-level search pagination wrapper.
import { vfSearchClientSide as vfSearchClientSideCore } from "./modified-vf-search-client-side.js";

function getQueryVariable(variable) {
  var query = window.location.search.substring(1);
  var vars = query.split("&");
  for (var i = 0; i < vars.length; i++) {
    var pair = vars[i].split("=");
    if (pair[0] === variable) {
      return decodeURIComponent((pair[1] || "").replace(/\+/g, "%20"));
    }
  }
}

function setPageQueryParam(page) {
  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }
  window.history.replaceState({}, "", url.toString());
}

// Module-level reference so applySearchPagination can disconnect/reconnect it.
var paginationObserver = null;

function getMaxVisiblePageLinks() {
  return window.matchMedia("(max-width: 768px)").matches ? 3 : 5;
}

function getPaginationNav(resultsContainer) {
  if (!resultsContainer) return null;
  const wrapper = resultsContainer.closest(".vf-search-client-side");
  if (wrapper) {
    const navInWrapper = wrapper.querySelector("[data-vf-search-pagination]");
    if (navInWrapper) return navInWrapper;
  }
  return document.querySelector("[data-vf-search-pagination]");
}

function buildPageHref(page) {
  const url = new URL(window.location.href);
  if (page <= 1) {
    url.searchParams.delete("page");
  } else {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

function setControlState(item, link, page, disabled) {
  if (!item || !link) return;

  link.setAttribute("data-vf-search-page", String(page));
  link.href = buildPageHref(page);
  item.classList.toggle("vf-pagination__item--is-disabled", disabled);

  if (disabled) {
    link.setAttribute("aria-disabled", "true");
    link.setAttribute("tabindex", "-1");
    return;
  }

  link.removeAttribute("aria-disabled");
  link.removeAttribute("tabindex");
}

function updatePaginationUI(container, currentPage, totalPages) {
  const nav = getPaginationNav(container);
  if (!nav) return;

  if (totalPages <= 1) {
    nav.hidden = true;
    return;
  }

  nav.hidden = false;

  const firstLink = nav.querySelector("[data-vf-search-page-role='first']");
  const previousLink = nav.querySelector("[data-vf-search-page-role='previous']");
  const nextLink = nav.querySelector("[data-vf-search-page-role='next']");
  const lastLink = nav.querySelector("[data-vf-search-page-role='last']");

  const firstItem = firstLink ? firstLink.closest(".vf-pagination__item") : null;
  const previousItem = previousLink ? previousLink.closest(".vf-pagination__item") : null;
  const nextItem = nextLink ? nextLink.closest(".vf-pagination__item") : null;
  const lastItem = lastLink ? lastLink.closest(".vf-pagination__item") : null;

  setControlState(firstItem, firstLink, 1, currentPage === 1);
  setControlState(previousItem, previousLink, Math.max(1, currentPage - 1), currentPage === 1);
  setControlState(nextItem, nextLink, Math.min(totalPages, currentPage + 1), currentPage === totalPages);
  setControlState(lastItem, lastLink, totalPages, currentPage === totalPages);

  const pageSlots = Array.from(nav.querySelectorAll("[data-vf-search-page-slot]"));
  const maxVisiblePageLinks = getMaxVisiblePageLinks();
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePageLinks / 2));
  let endPage = startPage + maxVisiblePageLinks - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisiblePageLinks + 1);
  }

  pageSlots.forEach(function (slot, index) {
    const page = startPage + index;
    const link = slot.querySelector("[data-vf-search-page-link]");
    if (!link) return;

    if (page > endPage) {
      slot.hidden = true;
      slot.classList.remove("vf-pagination__item--is-active");
      link.removeAttribute("aria-current");
      link.removeAttribute("data-vf-search-page");
      return;
    }

    slot.hidden = false;
    link.innerHTML = "<span class='vf-u-sr-only'>Page </span>" + page;
    link.setAttribute("aria-label", "Page " + page);
    link.setAttribute("data-vf-search-page", String(page));
    link.href = buildPageHref(page);

    const isActive = page === currentPage;
    slot.classList.toggle("vf-pagination__item--is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
      link.removeAttribute("aria-disabled");
      link.removeAttribute("tabindex");
      return;
    }

    link.removeAttribute("aria-current");
  });
}

function initializePaginationInteraction(container) {
  const nav = getPaginationNav(container);
  if (!nav || nav.getAttribute("data-vf-search-pagination-bound") === "true") return;

  nav.addEventListener("click", function (event) {
    const link = event.target.closest("[data-vf-search-page-link]");
    if (!link) return;

    event.preventDefault();

    if (link.getAttribute("aria-disabled") === "true") {
      return;
    }

    const selectedPage = parseInt(link.getAttribute("data-vf-search-page"), 10) || 1;
    setPageQueryParam(selectedPage);
    applySearchPagination(false);
    scrollToSearchResultsTop(container);
  });

  nav.setAttribute("data-vf-search-pagination-bound", "true");
}

function renderResultsSummary(container, startIndex, endIndex, totalResults) {
  const existingSummary = container.querySelector("[data-vf-search-results-summary]");
  if (existingSummary) {
    existingSummary.remove();
  }

  if (totalResults < 1) return;

  const summary = document.createElement("p");
  summary.className = "vf-search-results-summary vf-u-padding__bottom--400";
  summary.setAttribute("data-vf-search-results-summary", "true");
  summary.innerHTML = "Showing <strong>" + (startIndex + 1) + "</strong> - <strong>" + endIndex + "</strong> of <strong>" + totalResults + "</strong>";

  const firstResult = container.querySelector("[data-vf-search-result-item]");
  if (firstResult && firstResult.parentNode) {
    firstResult.parentNode.insertBefore(summary, firstResult);
    return;
  }

  container.insertBefore(summary, container.firstChild);
}

function renderNoResultsMessage(container) {
  container.innerHTML = ""
    + "<section class='vf-search-no-results' role='status'>"
    + "<h3>We couldn’t find any results matching the search criteria</h3>"
    + "<ul><li>Check your spelling</li><li>Use more general terms</li></ul>"
    + "</section>";
}

function ensureResultsLiveRegion(container) {
  if (!container) return;
  // container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-atomic", "true");
}

function focusResultsSummary(container) {
  if (!container) return;
  var summary = container.querySelector("[data-vf-search-results-summary]");
  if (!summary) return;
  summary.setAttribute("tabindex", "-1");
  summary.focus({ preventScroll: true });
}

function focusNoResultsMessage(container) {
  if (!container) return;
  var message = container.querySelector(".vf-search-no-results");
  if (!message) return;
  message.setAttribute("tabindex", "-1");
  message.focus({ preventScroll: true });
}

function toggleNoResultsFeedback(show) {
  const feedbackSection = document.getElementById("search-no-results-feedback");
  if (!feedbackSection) return;

  if (show) {
    feedbackSection.classList.remove("vf-u-display-none");
    return;
  }

  feedbackSection.classList.add("vf-u-display-none");
}

function scrollToSearchResultsTop(container) {
  if (!container) return;

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const targetTop = container.getBoundingClientRect().top + window.pageYOffset;

  window.scrollTo({
    top: Math.max(0, targetTop - 64),
    behavior: prefersReducedMotion ? "auto" : "smooth"
  });
}

// resetPage=true when called from the observer (new search results rendered) —
// resets to page 1. resetPage=false when called from a pagination link click.
function applySearchPagination(resetPage) {
  const container = document.querySelector("[data-vf-search-client-side-results]");
  if (!container) return;

  ensureResultsLiveRegion(container);

  // Disconnect while we mutate the nav to avoid triggering ourselves.
  if (paginationObserver) paginationObserver.disconnect();

  if (resetPage) {
    setPageQueryParam(1);
  }

  const resultItems = Array.from(container.querySelectorAll("[data-vf-search-result-item]"));
  const resultsPerPage = 10;
  const paginationNav = getPaginationNav(container);

  if (resultItems.length === 0) {
    toggleNoResultsFeedback(true);
    renderNoResultsMessage(container);
    if (paginationNav) {
      paginationNav.hidden = true;
    }
    if (resetPage) {
      focusNoResultsMessage(container);
    }
    if (paginationObserver) paginationObserver.observe(container, { childList: true, subtree: true });
    return;
  }

  toggleNoResultsFeedback(false);

  if (resultItems.length <= resultsPerPage) {
    resultItems.forEach(function (item) {
      item.style.display = "";
    });
    renderResultsSummary(container, 0, resultItems.length, resultItems.length);
    if (paginationNav) {
      paginationNav.hidden = true;
    }
    if (resetPage) {
      focusResultsSummary(container);
    }
    if (paginationObserver) paginationObserver.observe(container, { childList: true, subtree: true });
    return;
  }

  const totalPages = Math.ceil(resultItems.length / resultsPerPage);
  var currentPage = parseInt(getQueryVariable("page"), 10);
  if (Number.isNaN(currentPage) || currentPage < 1) {
    currentPage = 1;
  }
  if (currentPage > totalPages) {
    currentPage = totalPages;
    setPageQueryParam(currentPage);
  }

  const startIndex = (currentPage - 1) * resultsPerPage;
  const endIndex = startIndex + resultsPerPage;

  resultItems.forEach(function (item, index) {
    item.style.display = (index >= startIndex && index < endIndex) ? "" : "none";
  });

  renderResultsSummary(container, startIndex, Math.min(endIndex, resultItems.length), resultItems.length);
  if (resetPage) {
    focusResultsSummary(container);
  }

  updatePaginationUI(container, currentPage, totalPages);

  // Reconnect now that our DOM changes are done.
  if (paginationObserver) paginationObserver.observe(container, { childList: true, subtree: true });
}

function vfSearchClientSide() {
  vfSearchClientSideCore();

  const container = document.querySelector("[data-vf-search-client-side-results]");
  if (!container) return;

  initializePaginationInteraction(container);

  // Watch for the core function re-rendering results (e.g. new search query).
  // Disconnect/reconnect inside applySearchPagination prevents an infinite loop.
  paginationObserver = new MutationObserver(function () {
    applySearchPagination(true);
  });

  paginationObserver.observe(container, { childList: true, subtree: true });

  // Recompute visible page links when switching between mobile and desktop widths.
  window.addEventListener("resize", function () {
    applySearchPagination(false);
  });

  applySearchPagination(false);
}

export { vfSearchClientSide };
