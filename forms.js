"use strict";

/*
 * Error history. One entry is added for each invalid field on each failed
 * submission attempt. It never stores the user's name, email, or message.
 * It lives only as long as the page is open.
 */
const form_errors = [];

(function () {
  const form = document.querySelector(".contact-form");
  if (!form) return;

  /* ---------- Setup ---------- */
  const LABELS = { name: "Name", email: "Email address", comments: "Comments" };
  const FIELD_NAMES = Object.keys(LABELS);
  const fields = FIELD_NAMES.map((n) => form.elements[n]);
  const comments = form.elements.comments;

  const infoArea = document.getElementById("info-area");
  const countEl = document.getElementById("char-count");
  const warningEl = document.getElementById("length-warning");
  const errorPanel = document.getElementById("error-panel");
  const errorList = document.getElementById("error-list");

  const WARN_AT = 100; // warn when this many characters (or fewer) remain

  const dirty = new Set();      // fields the user has edited
  const displayed = new Set();  // fields whose error is currently showing

  /* ---------- Validation messages ---------- */
  function plural(n, word) {
    return n + " " + word + (n === 1 ? "" : "s");
  }

  /*
   * Inspects a field's validity state and returns {type, message}, or null if
   * the field is valid. It also sets (or clears) the custom validity message so
   * the browser's own bubble uses our wording and a corrected field can submit.
   */
  function checkField(field) {
    field.setCustomValidity(""); // clear any old message before rechecking

    const v = field.validity;
    const value = field.value;
    const label = LABELS[field.name];
    let result = null;

    if (v.valueMissing || (field.required && value.trim() === "")) {
      if (field.type === "email") {
        result = { type: "missing", message: "Enter your email address, for example name@example.com." };
      } else if (field.name === "comments") {
        result = { type: "missing", message: "Enter a message. Comments must be at least " + plural(field.minLength, "character") + " long." };
      } else {
        result = { type: "missing", message: "Enter your name. This field can't be left blank." };
      }
    } else if (v.typeMismatch) {
      result = { type: "invalid-email", message: "Enter a valid email address in the form name@example.com." };
    } else if (v.tooShort || (field.minLength > 0 && value.length > 0 && value.length < field.minLength)) {
      result = { type: "too-short", message: label + " must be at least " + plural(field.minLength, "character") + " long. Add a little more detail." };
    } else if (!v.valid) {
      result = { type: "other", message: field.validationMessage };
    }

    if (result) field.setCustomValidity(result.message);
    return result;
  }

  /* ---------- Showing and clearing errors ---------- */
  function setText(el, text) {
    if (el.textContent !== text) el.textContent = text; // avoid needless live-region updates
  }

  function setDescribedBy(field, errorId) {
    const ids = [];
    if (field === comments) ids.push("char-count");
    if (errorId) ids.push(errorId);
    if (ids.length) field.setAttribute("aria-describedby", ids.join(" "));
    else field.removeAttribute("aria-describedby");
  }

  function upsertSummaryItem(field, message) {
    const id = "summary-" + field.name;
    let item = document.getElementById(id);

    if (!item) {
      // Reveal the panel first so the new item is announced by the live region
      errorPanel.hidden = false;

      item = document.createElement("li");
      item.id = id;
      const link = document.createElement("a");
      link.href = "#" + field.id;
      link.textContent = LABELS[field.name] + ":";
      link.addEventListener("click", (e) => {
        e.preventDefault();
        field.focus();
      });
      const text = document.createElement("span");
      text.className = "summary-message";
      item.append(link, " ", text);

      // Keep items in the same order as the form fields
      const myIndex = FIELD_NAMES.indexOf(field.name);
      let before = null;
      for (const n of FIELD_NAMES.slice(myIndex + 1)) {
        before = document.getElementById("summary-" + n);
        if (before) break;
      }
      errorList.insertBefore(item, before);
    }
    setText(item.querySelector(".summary-message"), message);
  }

  function removeSummaryItem(field) {
    const item = document.getElementById("summary-" + field.name);
    if (item) item.remove();
    if (!errorList.children.length) errorPanel.hidden = true;
  }

  function render(field, result) {
    const inline = document.getElementById(field.name + "-error");

    if (result) {
      displayed.add(field.name);
      setText(inline, result.message);
      field.setAttribute("aria-invalid", "true");
      setDescribedBy(field, inline.id);
      upsertSummaryItem(field, result.message);
    } else {
      displayed.delete(field.name);
      setText(inline, "");
      field.removeAttribute("aria-invalid");
      setDescribedBy(field, null);
      removeSummaryItem(field);
    }
  }

  /* ---------- Character count ---------- */
  let currentState = null;

  function updateCount() {
    const max = comments.maxLength;
    if (max < 0) return;
    const remaining = max - comments.value.length;
    setText(countEl, plural(remaining, "character") + " remaining");

    const state = remaining <= 0 ? "limit" : remaining <= WARN_AT ? "warning" : "normal";
    if (state === currentState) return; // only touch the live region when the state changes
    currentState = state;
    infoArea.dataset.state = state;

    if (state === "warning") {
      warningEl.textContent = "Warning: you are close to the " + max.toLocaleString() + "-character limit.";
    } else if (state === "limit") {
      warningEl.textContent = "Limit reached: you have used all " + max.toLocaleString() + " characters. No more text can be added.";
    } else {
      warningEl.textContent = "";
    }
  }

  /* ---------- Events ---------- */

  // Typing, pasting, cutting, or deleting: keep validity current and update the count
  form.addEventListener("input", (e) => {
    const field = e.target;
    if (!fields.includes(field)) return;
    dirty.add(field.name);
    const result = checkField(field);
    if (displayed.has(field.name)) render(field, result); // update or clear a visible error
    if (field === comments) updateCount();
  });

  // Leaving a field the user has edited: show its error, if any
  form.addEventListener("focusout", (e) => {
    const field = e.target;
    if (!fields.includes(field) || !dirty.has(field.name)) return;
    render(field, checkField(field));
  });

  /*
   * Failed submissions. Native validation blocks the submit event, but it fires
   * "invalid" on every invalid control, all in the same task. Only the first
   * invalid event of a task starts a new attempt, and each field is recorded
   * once per attempt. We never call checkValidity() or reportValidity(), so
   * editing checks cannot create history entries.
   */
  let attemptOpen = false;
  let attemptNumber = 0;
  const recorded = new Set();

  function onInvalid(e) {
    const field = e.target;
    const result = checkField(field);

    if (!attemptOpen) {
      attemptOpen = true;
      attemptNumber += 1;
      recorded.clear();
      setTimeout(() => { attemptOpen = false; }, 0);
    }

    if (result && !recorded.has(field.name)) {
      recorded.add(field.name);
      form_errors.push({
        field: field.name,
        error: result.message,
        type: result.type,
        attempt: attemptNumber,
        time: new Date().toISOString()
      });
    }
    render(field, result);
  }

  fields.forEach((field) => field.addEventListener("invalid", onInvalid));

  // Successful submission: attach the history, then let the normal POST continue
  form.addEventListener("submit", () => {
    let hidden = form.elements["form-errors"];
    if (!hidden) {
      hidden = document.createElement("input");
      hidden.type = "hidden";
      hidden.name = "form-errors";
      form.appendChild(hidden);
    }
    hidden.value = JSON.stringify(form_errors);
  });

  /* ---------- Initialize ---------- */
  // Set our custom messages up front (silently) so the browser's bubble uses them
  fields.forEach(checkField);
  updateCount();
  document.querySelectorAll(".js-only").forEach((el) => { el.hidden = false; });
})();