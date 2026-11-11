"use strict";
 
/*
 * Theme switcher.
 * - Loaded WITHOUT defer, in <head>, so the saved theme is applied before the
 *   page paints (no flash of the wrong theme).
 * - The control is created here, so it simply does not exist when JavaScript
 *   is off. Pages without this script (form-no-js.html) stay on the light theme.
 * - Every localStorage read/write is wrapped in try/catch. If storage is
 *   blocked, switching still works for the current page.
 */
(function () {
  const KEY = "theme";
  const root = document.documentElement;
  let button = null;
 
  function readSaved() {
    try {
      const value = localStorage.getItem(KEY);
      return value === "dark" || value === "light" ? value : null;
    } catch (err) {
      return null; // storage blocked or unavailable
    }
  }
 
  function save(theme) {
    try {
      localStorage.setItem(KEY, theme);
    } catch (err) {
      /* ignore: the theme was already applied for this page */
    }
  }
 
  function updateButton(theme) {
    if (!button) return;
    const next = theme === "dark" ? "light" : "dark";
    button.querySelector(".theme-toggle-icon").textContent = next === "dark" ? "\u263E" : "\u2600";
    button.querySelector(".theme-toggle-text").textContent = "Switch to " + next + " theme";
  }
 
  // Apply first, save second, so a failed save never blocks the switch
  function apply(theme, persist) {
    root.setAttribute("data-theme", theme);
    updateButton(theme);
    if (persist) save(theme);
  }
 
  // Default is light. We deliberately do not follow the operating system setting.
  root.setAttribute("data-theme", readSaved() || "light");
 
  function buildControl() {
    button = document.createElement("button");
    button.type = "button";
    button.className = "theme-toggle";
 
    const icon = document.createElement("span");
    icon.className = "theme-toggle-icon";
    icon.setAttribute("aria-hidden", "true");
    const text = document.createElement("span");
    text.className = "theme-toggle-text";
    button.append(icon, " ", text);
 
    button.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
 
      // Use a view transition only where the API exists and the user has not
      // asked for reduced motion. Otherwise the switch is applied directly,
      // so the control always works.
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (document.startViewTransition && !reduceMotion) {
        document.startViewTransition(() => apply(next, true));
      } else {
        apply(next, true);
      }
    });
 
    const list = document.querySelector("header nav ul");
    if (list) {
      const item = document.createElement("li");
      item.append(button);
      list.append(item);
    } else {
      (document.querySelector("header nav") || document.querySelector("header") || document.body).append(button);
    }
    updateButton(root.getAttribute("data-theme"));
  }
 
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildControl);
  } else {
    buildControl();
  }
 
  // Another tab changed the theme
  window.addEventListener("storage", (e) => {
    if (e.key === KEY && (e.newValue === "dark" || e.newValue === "light")) apply(e.newValue, false);
  });
 
  // Page restored from the back/forward cache: pick up the latest saved theme
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) apply(readSaved() || root.getAttribute("data-theme") || "light", false);
  });
})();