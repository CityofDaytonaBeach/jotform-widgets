// ==================================
// Utilities
// ==================================
function flatten(obj, prefix = "", out = {}) {
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;

    const val = obj[key];
    const path = prefix ? `${prefix}.${key}` : key;

    if (val && typeof val === "object" && !Array.isArray(val)) {
      flatten(val, path, out);
    } else {
      out[path] = val;
    }
  }
  return out;
}

function debounce(fn, delay = 150) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// ==================================
// Normalize mapping slots (1–10)
// ==================================
function extractMappings(settings) {
  const mappings = [];

  for (let i = 1; i <= 10; i++) {
    const rawJsonKey = settings[`map${i}_jsonKey`];
    const rawFieldId = settings[`map${i}_fieldId`];

    const jsonKey =
      rawJsonKey != null && String(rawJsonKey).trim() !== ""
        ? String(rawJsonKey).trim()
        : null;

    const fieldId =
      rawFieldId != null && String(rawFieldId).trim() !== ""
        ? String(rawFieldId).trim()
        : null;

    const isActive = Boolean(jsonKey && fieldId);

    mappings.push({
      index: i,
      jsonKey,
      fieldId,
      questionId: fieldId,
      domId: fieldId ? `input_${fieldId}` : null,
      isActive
    });
  }

  // Diagnostic visibility
  console.group("📋 Normalized Mapping Slots");
  mappings.forEach(m => {
    console.log(
      `Map ${m.index}: ${m.isActive ? "ACTIVE" : "inactive"}`,
      {
        jsonKey: m.jsonKey,
        fieldId: m.fieldId
      }
    );
  });
  console.groupEnd();

  return mappings;
}

// ==================================
// Widget Initialization
// ==================================
JFCustomWidget.subscribe("ready", function () {
  console.group("🧩 Widget Ready");

  const settings = JFCustomWidget.getWidgetSettings() || {};
  console.log("Widget settings:", settings);

  const jsonURL = settings.jsonURL;
  const searchKey = (settings.searchKey || "").trim();
  const idKey = (settings.idKey || searchKey).trim();
  const minChars = Number(settings.minChars || 2);
  const returnFormat = (settings.returnFormat || "value").toLowerCase();

  const input = document.getElementById("searchBox");
  const results = document.getElementById("results");
  const statusEl = document.getElementById("status");

  if (!jsonURL || !searchKey || !idKey) {
    statusEl.textContent =
      "Configuration error: jsonURL, searchKey, or idKey missing.";
    statusEl.style.color = "red";
    console.error("Missing required settings");
    console.groupEnd();
    return;
  }

  const FIELD_MAPPINGS = extractMappings(settings);
  const ACTIVE_MAPPINGS = FIELD_MAPPINGS.filter(m => m.isActive);

  if (!ACTIVE_MAPPINGS.length) {
    statusEl.textContent =
      "Configuration error: No active field mappings defined.";
    statusEl.style.color = "red";
    console.error("No active mappings");
  }

  let entries = [];
  let selectedEntry = null;

  function resize() {
    JFCustomWidget.requestFrameResize({
      height: document.body.scrollHeight
    });
  }

  function displayLabel(entry) {
    return String(entry.flat[searchKey] ?? "");
  }

  // ==================================
  // Load JSON
  // ==================================
  fetch(jsonURL, { cache: "no-store" })
    .then(r => r.json())
    .then(json => {
      const data = Array.isArray(json)
        ? json
        : Object.values(json).find(Array.isArray) || [];

      console.log("Sample record:", data[0]);

      entries = data.map(item => ({
        item,
        flat: flatten(item)
      }));

      console.log("Flattened keys:", Object.keys(entries[0]?.flat || {}));
      resize();
    })
    .catch(err => {
      console.error("JSON load failed", err);
      statusEl.textContent = "Failed to load data source.";
      statusEl.style.color = "red";
    });

  // ==================================
  // Search
  // ==================================
  function search() {
    const q = input.value.trim().toLowerCase();
    if (q.length < minChars) return;

    const filtered = entries.filter(e => {
      const v = e.flat[searchKey];
      return v && String(v).toLowerCase().includes(q);
    });

    results.innerHTML = "";
    filtered.forEach(entry => {
      const div = document.createElement("div");
      div.className = "result";
      div.textContent = displayLabel(entry);
      div.onclick = () => selectEntry(entry);
      results.appendChild(div);
    });

    resize();
  }

  // ==================================
  // Selection + Auto-population
  // ==================================
  function selectEntry(entry) {
    console.group("🎯 Selection");

    if (!ACTIVE_MAPPINGS.length) {
      console.warn("Selection ignored: no active mappings");
      console.groupEnd();
      return;
    }

    const flat = entry.flat;
    console.log("Selected record:", flat);

    const payload = [];

    ACTIVE_MAPPINGS.forEach(m => {
      const value = flat[m.jsonKey];
      if (value == null) return;

      payload.push({
        id: m.questionId,
        value: String(value)
      });

      // DOM-level fallback (Jotform-supported)
      try {
        JFCustomWidget.storeToField(m.domId, String(value));
      } catch (e) {
        console.error("storeToField failed:", m.domId, e);
      }
    });

    console.log("Question-ID payload:", payload);

    if (payload.length) {
      try {
        JFCustomWidget.setFieldsValueById(payload);
      } catch (e) {
        console.error("setFieldsValueById failed", e);
      }
    }

    let returnValue;
    if (returnFormat === "json") returnValue = entry.item;
    else if (returnFormat === "flat") returnValue = flat;
    else returnValue = flat[idKey];

    JFCustomWidget.sendData({ value: returnValue });

    selectedEntry = entry;
    input.value = displayLabel(entry);
    results.innerHTML = "";
    resize();

    console.groupEnd();
  }

  input.addEventListener("input", debounce(search, 150));

  // ==================================
  // Submit
  // ==================================
  JFCustomWidget.subscribe("submit", function () {
    if (!selectedEntry) {
      JFCustomWidget.sendSubmit({ valid: false, value: "" });
      return;
    }

    JFCustomWidget.sendSubmit({
      valid: true,
      value: selectedEntry.flat[idKey]
    });
  });

  console.groupEnd();
});
