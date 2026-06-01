/*
 *
 * scripts.js
 * The Visual Framework kitchen sink of JavaScript.
 * Import this as a quick way to get *everything*,
 *
 */

// All VF JS
import { vfBanner } from "vf-banner/vf-banner";
vfBanner();


import { vfSearchClientSide } from "../../pages/scripts/lro-search-client-side.js";
import { initFeedbackForms } from "../../pages/scripts/feedback-forms.js";

// Make vfSearchClientSide globally available for the search page
window.vfSearchClientSide = vfSearchClientSide;

import { vfMegaMenu } from 'vf-mega-menu/vf-mega-menu';
vfMegaMenu();

// Mega menu
(function () {
  var searchLink = document.querySelector(".search-menu-link");
  var menuLink = document.querySelector(".menu-link");
  var globalNav = document.querySelector(".vf-navigation--global");
  var searchbarSection = document.querySelector("div.searchbar-content-section");

  function hideEl(el) { if (el) el.style.display = "none"; }
  function showEl(el, display) { if (el) el.style.display = display || "block"; }
  function qAll(sel) { return document.querySelectorAll(sel); }
  function normalizePath(path) {
    if (!path) return "/";
    var normalized = path.replace(/\/+$/, "");
    return normalized || "/";
  }
  function getMenuPanel(control) {
    var sectionid = control.getAttribute("data-vf-js-mega-menu-section-id");
    if (!sectionid) return null;
    return document.querySelector('[data-vf-js-mega-menu-section="' + sectionid + '"]');
  }
  function setMenuExpanded(control, expanded) {
    var section = getMenuPanel(control);
    if (!section || !section.parentElement) return;
    section.parentElement.style.display = expanded ? "block" : "none";
    section.setAttribute("aria-hidden", expanded ? "false" : "true");
    control.classList.toggle("is-expanded", expanded);
    control.setAttribute("aria-expanded", expanded ? "true" : "false");
  }
  function setSearchExpanded(expanded) {
    var section = document.querySelector('[data-vf-js-mega-menu-section="search-menu-content-section"]');
    if (!section) return;
    section.style.display = expanded ? "block" : "none";
    section.setAttribute("aria-hidden", expanded ? "false" : "true");
    qAll('[data-vf-js-mega-menu-section-id="search-menu-content-section"]').forEach(function (control) {
      control.classList.toggle("is-expanded", expanded);
      control.setAttribute("aria-expanded", expanded ? "true" : "false");
    });
  }

  if (searchLink) {
    searchLink.addEventListener("click", function () {
      if (searchLink.classList.contains("search-expanded")) {
        if (menuLink) menuLink.classList.remove("megamenu-expanded");
        searchLink.classList.remove("search-expanded");
        hideEl(globalNav);
      } else {
        if (menuLink) menuLink.classList.remove("megamenu-expanded");
        searchLink.classList.add("search-expanded");
        showEl(globalNav);
        hideEl(document.querySelector("ul.vf-navigation__list :first-child"));
        showEl(searchbarSection);
      }
    });
  }

  if (menuLink) {
    menuLink.addEventListener("click", function () {
      if (menuLink.classList.contains("megamenu-expanded")) {
        if (searchLink) searchLink.classList.remove("search-expanded");
        menuLink.classList.remove("megamenu-expanded");
        hideEl(globalNav);
      } else {
        if (searchLink) searchLink.classList.remove("search-expanded");
        menuLink.classList.add("megamenu-expanded");
        showEl(globalNav);
        showEl(document.querySelector("ul.vf-navigation__list :first-child"));
        hideEl(searchbarSection);
        qAll(".responsive-only").forEach(function (el) { hideEl(el); });
      }
    });
  }

  qAll("ul.vf-navigation__list .vf-mega-menu__link--has-section").forEach(function (control) {
    control.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var expanded = control.getAttribute("aria-expanded") === "true";
      setMenuExpanded(control, !expanded);
    });
  });

  qAll('a[data-vf-js-mega-menu-section-id="search-menu-content-section"]').forEach(function (control) {
    control.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isExpanded = control.getAttribute("aria-expanded") === "true";
      setSearchExpanded(!isExpanded);
    });
  });

  var currentPath = normalizePath(window.location.pathname);
  qAll(".responsive-only a.vf-link").forEach(function (link) {
    if (normalizePath(link.pathname) !== currentPath) return;
    var section = link.closest("[data-vf-js-mega-menu-section]");
    if (!section || !section.parentElement) return;
    var container = section.parentElement;
    var item = container.previousElementSibling;
    if (!item) return;
    var control = item.querySelector(".vf-mega-menu__link--has-section");
    if (!control) return;
    setMenuExpanded(control, true);
  });
}());

// import { vfBannerElixir } from "vf-banner-elixir/vf-banner-elixir";
// vfBannerElixir();

// VF Masthead has been deprecated
// https://github.com/visual-framework/vf-core/pull/1406/
// import { vfMastheadSetStyle } from "vf-masthead/vf-masthead";
// vfMastheadSetStyle();

// import { vfGaIndicateLoaded } from "vf-analytics-google/vf-analytics-google";
// let vfGaTrackOptions = {
//   vfGaTrackPageLoad: true
// };
// vfGaIndicateLoaded(vfGaTrackOptions);

import { vfTabs } from "vf-tabs/vf-tabs";
vfTabs();

// import { vfTree } from "vf-tree/vf-tree";
// vfTree();

// import { vfFormFloatLabels } from 'form /assets/vf-form__float-labels.js';
// vfFormFloatLabels();

// import { vfSearchClientSide } from "vf-search-client-side/vf-search-client-side";
// No default invokation

// import { vfShowMore } from "vf-show-more/vf-show-more";
// vfShowMore();

// import { vfLocationNearest } from "vf-location-nearest/vf-location-nearest";
// Not invoked by default

// All EMBL JS
// import { emblContentHubLoaderHtmlImports } from "embl-content-hub-loader/embl-content-hub-loader__html-imports";
// import { emblContentHubFetch } from "embl-content-hub-loader/embl-content-hub-loader__fetch";
// import { emblContentHub } from "embl-content-hub-loader/embl-content-hub-loader";
// import { emblConditionalEdit } from "embl-conditional-edit/embl-conditional-edit";
// emblContentHub();

// import { emblBreadcrumbs } from "embl-breadcrumbs-lookup/embl-breadcrumbs-lookup";
// emblBreadcrumbs();

import { vfBackToTop } from "vf-back-to-top/vf-back-to-top.js";
vfBackToTop();

import { vfNavigationOnThisPage } from "vf-navigation/vf-navigation.js";
vfNavigationOnThisPage();
import { emblContentMetaProperties_Read } from "embl-content-meta-properties/embl-content-meta-properties";

initFeedbackForms();

// import { vfMegaMenu } from 'vf-mega-menu/vf-mega-menu';
// vfMegaMenu();

// No default invokation
