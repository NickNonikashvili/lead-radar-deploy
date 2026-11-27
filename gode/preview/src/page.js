"use strict";
// Preview-only glue in the page itself, around the unchanged app (public/app.js). Browser only:
// main.js start() installs it; nothing here runs under Node.
//
// 1. Downloads inside the viewer's frame. The Artifact host runs the page in a sandboxed iframe
//    without allow-downloads, so an image's Download link and Admin -> Export JSON would silently
//    do nothing. When the page is framed, a click on an a[download] (the media link, and the
//    anchor the export clicks from script) is stopped and a note says what to do instead; the
//    catalog export is copied to the clipboard (a selection copy, which the frame allows).
// 2. The welcome note opens at its top. The app keeps a conversation scrolled to its latest
//    message, which on a phone is the end of the welcome note (its heading and its "no AI model is
//    called" line off screen). The note is one message, so it is shown from its start instead.
//
// 3. The welcome note is a note, not a chat: a message sent from it starts a new chat (titled
//    after the question, like any first message) instead of continuing "Welcome to the Gode
//    preview". The text moves to the new chat's composer and is sent from there.
// 4. Focus before the viewer's first input, inside the frame. A sandboxed frame may not move focus
//    until the viewer has interacted with it: the app's focus on the message box when a chat opens
//    is refused there with a "Permissions policy violation: focus-without-user-activation" console
//    error. Until the first input in the frame, focus() calls are held back instead; a first key
//    typed with nothing focused (the host focused the frame) goes to the field the app wanted
//    focused, as it does at top level.
//
// Notes are shown in the app's own toast styling, in an element of their own outside #root (the
// app's React tree is never touched).

const WELCOME_TITLE = "Welcome to the Gode preview";
const NOTE_MS = 6500;

function isFramed(win) {
  try {
    return win.self !== win.top;
  } catch {
    return true; // a cross-origin parent: framed
  }
}

/** A toast in the app's styling, outside the React tree. */
function createNotes(win) {
  const doc = win.document;
  let stack = null;
  return function note(message, tone = "info") {
    if (!stack || !stack.isConnected) {
      stack = doc.createElement("div");
      stack.className = "toast-stack preview-notes";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      doc.body.appendChild(stack);
    }
    const el = doc.createElement("div");
    el.className = `toast toast-${tone} preview-note`;
    el.textContent = message;
    stack.appendChild(el);
    while (stack.children.length > 2) stack.firstElementChild.remove();
    win.setTimeout(() => el.remove(), NOTE_MS);
  };
}

/** Copy through a hidden textarea: works in a sandboxed frame that refuses the async clipboard. */
function selectionCopy(doc, text) {
  const ta = doc.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "fixed";
  ta.style.top = "0";
  ta.style.opacity = "0";
  doc.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = doc.execCommand("copy");
  } catch {
    ok = false;
  }
  ta.remove();
  return ok;
}

const MEDIA_NOTE =
  "Downloads are blocked inside this preview frame. Right-click (or long-press) the file to save it, or open the preview in its own tab.";

function guardDownloads(win, note) {
  const doc = win.document;
  doc.addEventListener(
    "click",
    (e) => {
      const a = e.target && typeof e.target.closest === "function" ? e.target.closest("a[download]") : null;
      if (!a) return;
      e.preventDefault();
      const name = String(a.getAttribute("download") || "");
      if (!/^gode-catalog-/.test(name)) {
        note(MEDIA_NOTE);
        return;
      }
      // The admin's catalog export: the same JSON the app would save (its doExport), from the
      // simulated backend (a fetch of the blob: URL would not pass the page's connect-src).
      win
        .fetch("/api/admin/catalog/export", { headers: { Accept: "application/json" } })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((data) => {
          const copied = selectionCopy(doc, JSON.stringify(data, null, 2) + "\n");
          note(
            copied
              ? "Downloads are blocked inside this preview frame, so the catalog JSON was copied to your clipboard instead."
              : "Downloads are blocked inside this preview frame. Open the preview in its own tab to export the catalog."
          );
        })
        .catch(() => note("Downloads are blocked inside this preview frame. Open the preview in its own tab to export the catalog."));
    },
    true
  );
}

/** The welcome note is on screen, alone: its single message under the welcome heading. */
function onWelcomeNote(doc) {
  const msgs = doc.querySelectorAll(".messages .msg");
  if (msgs.length !== 1) return false;
  const heading = msgs[0].querySelector(".md-h");
  return Boolean(heading && heading.textContent.trim() === WELCOME_TITLE);
}

/** Set a React-controlled text field's value the way typing does (the app sees an input event). */
function typeInto(win, el, text) {
  const proto = el instanceof win.HTMLTextAreaElement ? win.HTMLTextAreaElement.prototype : win.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  setter.call(el, text);
  el.dispatchEvent(new win.Event("input", { bubbles: true }));
}

/**
 * Sending from the welcome note starts a new chat: the send is stopped before the app sees it, the
 * welcome note's composer is emptied, and the text is sent from a new chat's composer.
 */
function welcomeSendsToNewChat(win) {
  const doc = win.document;
  let moving = false;
  const composerText = () => {
    const el = doc.getElementById("composer-input");
    return el ? el.value : "";
  };
  const send = (text) => {
    moving = true;
    const box = doc.getElementById("composer-input");
    if (box) typeInto(win, box, "");
    win.location.hash = "#/";
    const started = Date.now();
    const tick = () => {
      const el = doc.getElementById("composer-input");
      const fresh = el && doc.querySelector(".empty-state") && /^#\/?$/.test(win.location.hash || "#/");
      if (!fresh) {
        if (Date.now() - started < 4000) win.setTimeout(tick, 30);
        else moving = false;
        return;
      }
      typeInto(win, el, text);
      // After the app has rendered the new text (its Send reads the composer's state).
      win.setTimeout(() => {
        moving = false;
        el.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }));
      }, 30);
    };
    win.setTimeout(tick, 0);
  };
  const intercept = (e) => {
    if (moving) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (!/^#\/c\//.test(win.location.hash || "") || !onWelcomeNote(doc)) return;
    const text = composerText();
    if (!text.trim()) return;
    e.preventDefault();
    e.stopPropagation();
    send(text);
  };
  doc.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || !e.target || e.target.id !== "composer-input") return;
      intercept(e);
    },
    true
  );
  doc.addEventListener(
    "submit",
    (e) => {
      if (e.target && e.target.classList && e.target.classList.contains("composer")) intercept(e);
    },
    true
  );
}

/**
 * Whenever a conversation opens, watch briefly for the welcome note (a single assistant message
 * under its heading) and show it from its top. Once per opening; scrolling afterwards is the app's.
 */
function welcomeFromTop(win) {
  const doc = win.document;
  if (typeof win.MutationObserver !== "function") return;
  let observer = null;
  let timer = null;
  let release = () => {};
  // The messages on screen when the route changed: the chat being left, never the welcome note
  // being opened (React makes new elements for another conversation's messages).
  let stale = new Set();
  const stop = () => {
    if (observer) observer.disconnect();
    observer = null;
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
  };
  const check = () => {
    const el = doc.querySelector(".messages");
    if (!el) return false;
    // Still the previous chat, or another one: keep watching until the timer ends.
    const msgs = el.querySelectorAll(".msg");
    if (msgs.length !== 1 || stale.has(msgs[0])) return false;
    const heading = msgs[0].querySelector(".msg-assistant .md-h, .md-h");
    if (!heading || heading.textContent.trim() !== WELCOME_TITLE) return false;
    el.scrollTop = 0;
    // Synchronously, so the app's own scroll handler sees it before its next render (it then
    // stops keeping the view at the bottom, unless the note almost fits).
    el.dispatchEvent(new win.Event("scroll"));
    holdTop(el);
    return true;
  };
  // While the page settles, the app may scroll the note back to its end (it keeps a chat at its
  // latest message when the view is near the bottom). Until the viewer scrolls, types or taps,
  // the note stays at its top.
  const holdTop = (el) => {
    let moved = false;
    const events = ["wheel", "touchstart", "keydown", "mousedown"];
    const onMove = () => {
      moved = true;
    };
    const onScroll = () => {
      if (!moved && el.scrollTop !== 0) el.scrollTop = 0;
    };
    events.forEach((t) => win.addEventListener(t, onMove, true));
    el.addEventListener("scroll", onScroll);
    const end = win.setTimeout(() => release(), 2500);
    release = () => {
      win.clearTimeout(end);
      events.forEach((t) => win.removeEventListener(t, onMove, true));
      el.removeEventListener("scroll", onScroll);
      release = () => {};
    };
  };
  const watch = () => {
    stop();
    release();
    stale = new Set(doc.querySelectorAll(".messages .msg"));
    if (!/^#\/c\//.test(win.location.hash || "")) return;
    if (check()) return;
    observer = new win.MutationObserver(() => {
      if (check()) stop();
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    timer = win.setTimeout(stop, 8000);
  };
  win.addEventListener("hashchange", watch);
  watch();
}

/**
 * Framed, before any user activation: hold back programmatic focus() (the browser would refuse it
 * and log a policy error). The first pointer press ends this (focus then goes where the press
 * lands, as usual); a first printable key with nothing focused focuses the held-back field first,
 * so the key is typed into it.
 */
function deferFocusUntilActivation(win) {
  const activation = win.navigator && win.navigator.userActivation;
  const proto = win.HTMLElement && win.HTMLElement.prototype;
  if (!activation || activation.hasBeenActive || !proto || typeof proto.focus !== "function") return;
  const doc = win.document;
  const realFocus = proto.focus;
  let pending = null;
  function heldFocus(...args) {
    if (activation.hasBeenActive) return realFocus.apply(this, args);
    pending = this;
    return undefined;
  }
  const done = () => {
    if (proto.focus === heldFocus) proto.focus = realFocus;
    doc.removeEventListener("keydown", onKey, true);
    doc.removeEventListener("pointerdown", done, true);
    pending = null;
  };
  function onKey(e) {
    const el = pending;
    done();
    const active = doc.activeElement;
    const printable = e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (printable && el && el.isConnected && (!active || active === doc.body)) realFocus.call(el);
  }
  proto.focus = heldFocus;
  doc.addEventListener("keydown", onKey, true);
  doc.addEventListener("pointerdown", done, true);
}

function installPage(win) {
  try {
    if (!win || !win.document || !win.document.body) return;
    const note = createNotes(win);
    if (isFramed(win)) {
      deferFocusUntilActivation(win);
      guardDownloads(win, note);
    }
    welcomeFromTop(win);
    welcomeSendsToNewChat(win);
  } catch {
    // The preview still works without these niceties.
  }
}

module.exports = { installPage, isFramed, selectionCopy, deferFocusUntilActivation, WELCOME_TITLE, MEDIA_NOTE };
