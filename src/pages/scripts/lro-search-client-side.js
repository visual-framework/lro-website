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

function getChevronIconMarkup(type) {
  const iconPaths = {
    first: "<path d='M13.5 5.5L8.5 10.5L13.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path><path d='M9.5 5.5L4.5 10.5L9.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path>",
    previous: "<path d='M11.5 5.5L6.5 10.5L11.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path>",
    next: "<path d='M8.5 5.5L13.5 10.5L8.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path>",
    last: "<path d='M6.5 5.5L11.5 10.5L6.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path><path d='M10.5 5.5L15.5 10.5L10.5 15.5' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'></path>"
  };

  return "<span class='vf-pagination__icon' aria-hidden='true'><svg width='16' height='16' viewBox='0 0 20 20' focusable='false' xmlns='http://www.w3.org/2000/svg'>" + (iconPaths[type] || "") + "</svg></span>";
}

function getMaxVisiblePageLinks() {
  return window.matchMedia("(max-width: 768px)").matches ? 3 : 5;
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

  // Remove old pagination controls before recalculating.
  const existingPagination = container.querySelector("[data-vf-search-pagination]");
  if (existingPagination) {
    existingPagination.remove();
  }

  const resultItems = Array.from(container.querySelectorAll("[data-vf-search-result-item]"));
  const resultsPerPage = 5;

  if (resultItems.length === 0) {
    toggleNoResultsFeedback(true);
    renderNoResultsMessage(container);
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

  const nav = document.createElement("nav");
  nav.className = "vf-pagination";
  nav.setAttribute("aria-label", "Search pagination");
  nav.setAttribute("data-vf-search-pagination", "true");

  const list = document.createElement("ul");
  list.className = "vf-pagination__list";

  function addPageLink(label, page, isActive, extraClass, ariaLabel, iconType, isDisabled) {
    const li = document.createElement("li");
    li.className = "vf-pagination__item"
      + (extraClass ? " " + extraClass : "")
      + (isActive ? " vf-pagination__item--is-active" : "")
      + (isDisabled ? " vf-pagination__item--is-disabled" : "");

    if (isActive || isDisabled) {
      const span = document.createElement("span");
      span.className = "vf-pagination__label";
      if (isActive) {
        span.setAttribute("aria-current", "page");
      }
      if (isDisabled) {
        span.setAttribute("aria-disabled", "true");
      }
      if (iconType) {
        span.innerHTML = getChevronIconMarkup(iconType) + "<span class='vf-u-sr-only'>" + ariaLabel + "</span>";
      } else {
        span.innerHTML = "<span class='vf-u-sr-only'>Page </span>" + String(label);
      }
      li.appendChild(span);
    } else {
      const link = document.createElement("a");
      link.className = "vf-pagination__link";
      link.href = "#";
      link.setAttribute("data-vf-search-page", String(page));
      if (ariaLabel) link.setAttribute("aria-label", ariaLabel);
      if (iconType) {
        link.innerHTML = getChevronIconMarkup(iconType) + "<span class='vf-u-sr-only'>" + ariaLabel + "</span>";
      } else {
        link.innerHTML = "<span class='vf-u-sr-only'>Page </span>" + String(label);
      }
      li.appendChild(link);
    }

    list.appendChild(li);
  }

  addPageLink("First", 1, false, "vf-pagination__item--jump-back", "First page", "first", currentPage === 1);
  addPageLink("Previous", currentPage - 1, false, "vf-pagination__item--previous-page", "Previous page", "previous", currentPage === 1);

  const maxVisiblePageLinks = getMaxVisiblePageLinks();
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePageLinks / 2));
  let endPage = startPage + maxVisiblePageLinks - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(1, endPage - maxVisiblePageLinks + 1);
  }

  for (let page = startPage; page <= endPage; page++) {
    addPageLink(page, page, page === currentPage, "", "Page " + page, "", false);
  }

  addPageLink("Next", currentPage + 1, false, "vf-pagination__item--next-page", "Next page", "next", currentPage === totalPages);
  addPageLink("Last", totalPages, false, "vf-pagination__item--jump-forward", "Last page", "last", currentPage === totalPages);

  nav.appendChild(list);
  container.appendChild(nav);

  nav.querySelectorAll("[data-vf-search-page]").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      const selectedPage = parseInt(this.getAttribute("data-vf-search-page"), 10) || 1;
      setPageQueryParam(selectedPage);
      applySearchPagination(false);
      scrollToSearchResultsTop(container);
    });
  });

  // Reconnect now that our DOM changes are done.
  if (paginationObserver) paginationObserver.observe(container, { childList: true, subtree: true });
}

function vfSearchClientSide() {
  vfSearchClientSideCore();

  const container = document.querySelector("[data-vf-search-client-side-results]");
  if (!container) return;

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
