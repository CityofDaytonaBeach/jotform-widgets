// === CONFIG ===
const backendUrl =
  "https://myefnonvpjbggqqurvhy.supabase.co/functions/v1/getaddress-withoutredevelopment";

const UI_SUGGESTION_LIMIT = 5;

// Your widget UI input (inside the widget iframe)
const WIDGET_INPUT_ID = "addressInput";
const SUGGESTIONS_ID = "suggestions";

// === STATE ===
let debounceTimer = null;
let selectedAddress = ""; // FINAL single value (what gets submitted)
let activeAbort = null; // abort in-flight fetches to prevent races

function $(id) {
  return document.getElementById(id);
}

function abortActiveRequest() {
  if (activeAbort) {
    try {
      activeAbort.abort();
    } catch {}
  }
  activeAbort = null;
}

/**
 * Live-update the widget value (what conditions can read while filling).
 * This is NOT the final submit handshake.
 */
function sendValueToJotform(value) {
  selectedAddress = value || "";

  if (window.JFCustomWidget && typeof window.JFCustomWidget.sendData === "function") {
    window.JFCustomWidget.sendData({ value: selectedAddress });
  }
}

/**
 * REQUIRED FIELD: final submit handshake.
 * If the field is required, set valid=false unless there's a selectedAddress.
 * This prevents Jotform from submitting only when it's actually empty,
 * and prevents the "widget blocks submission" issue by responding properly.
 */
function sendSubmitToJotform() {
  if (!window.JFCustomWidget || typeof window.JFCustomWidget.sendSubmit !== "function") return;

  const isValid = Boolean(selectedAddress && selectedAddress.trim());

  window.JFCustomWidget.sendSubmit({
    valid: isValid,
    value: selectedAddress,
    // Optional: some widget templates show this message when valid=false
    error: isValid ? "" : "Please select an address from the suggestions.",
  });
}

/**
 * Keep the widget input UI synced (inside iframe)
 */
function setWidgetInputValue(value) {
  const el = $(WIDGET_INPUT_ID);
  if (!el) return;
  el.value = value || "";
}

function renderSuggestions(list) {
  const box = $(SUGGESTIONS_ID);
  if (!box) return;

  box.innerHTML = "";

  if (!Array.isArray(list) || !list.length) {
    box.style.display = "none";
    return;
  }

  list.slice(0, UI_SUGGESTION_LIMIT).forEach((item) => {
    const div = document.createElement("div");
    div.className = "suggestion-item";
    div.textContent = item?.label ?? "";

    // pointerdown/mousedown prevents blur/click issues in iframes/mobile
    div.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      if (item?.magicKey) resolveAddress(item.magicKey);
    });

    box.appendChild(div);
  });

  box.style.display = "block";
}

async function fetchSuggestions(query) {
  abortActiveRequest();
  activeAbort = new AbortController();

  try {
    const res = await fetch(`${backendUrl}?query=${encodeURIComponent(query)}`, {
      signal: activeAbort.signal,
    });

    if (!res.ok) return renderSuggestions([]);

    const data = await res.json().catch(() => null);
    renderSuggestions(data?.addresses || []);
  } catch (err) {
    // Abort is expected during fast typing; ignore it.
    if (err?.name !== "AbortError") console.error(err);
    renderSuggestions([]);
  }
}

async function resolveAddress(magicKey) {
  abortActiveRequest();
  activeAbort = new AbortController();

  try {
    const res = await fetch(`${backendUrl}?magicKey=${encodeURIComponent(magicKey)}`, {
      signal: activeAbort.signal,
    });

    if (!res.ok) return;

    const data = await res.json().catch(() => null);
    const item = data?.addresses?.[0];
    if (!item?.label) return;

    const finalAddress = item.label;

    // Update widget UI
    setWidgetInputValue(finalAddress);
    renderSuggestions([]);

    // Send to Jotform as the widget's answer (conditions read this)
    sendValueToJotform(finalAddress);
  } catch (err) {
    if (err?.name !== "AbortError") console.error(err);
  }
}

function wireUi() {
  const input = $(WIDGET_INPUT_ID);
  if (!input) {
    console.warn(`Widget input #${WIDGET_INPUT_ID} not found.`);
    return;
  }

  input.addEventListener("input", (e) => {
    const query = String(e.target.value || "").trim().toUpperCase();

    // User is typing; clear the stored "final" value (prevents stale selection)
    sendValueToJotform("");

    if (query.length < 3) return renderSuggestions([]);

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fetchSuggestions(query), 250);
  });

  /** Optional UX: hide suggestions when clicking outside */
  document.addEventListener("click", (e) => {
    const box = $(SUGGESTIONS_ID);
    const inp = $(WIDGET_INPUT_ID);
    if (!box || !inp) return;

    if (!box.contains(e.target) && e.target !== inp) {
      box.style.display = "none";
    }
  });
}

// === JOTFORM WIDGET LIFECYCLE ===
// Best practice: do setup inside "ready" so DOM is available in the iframe.
if (window.JFCustomWidget && typeof window.JFCustomWidget.subscribe === "function") {
  window.JFCustomWidget.subscribe("ready", function () {
    wireUi();

    // Initialize as empty required field until user selects something
    sendValueToJotform("");
  });

  window.JFCustomWidget.subscribe("submit", function () {
    // Critical: respond via sendSubmit so Jotform can finish submission
    sendSubmitToJotform();
  });
} else {
  // Non-Jotform preview environment
  document.addEventListener("DOMContentLoaded", wireUi);
}
