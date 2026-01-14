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
// Robust mapping extraction
// ==================================
function extractMappings(settings) {
  const mappings = [];
  const keys = Object.keys(settings);

  console.group("🔍 Mapping discovery");
  console.log("All setting keys:", keys);

  // Find all mapX_jsonKey entries dynamically
  keys.forEach(k => {
    const match = k.match(/^map(\d+)_jsonkey$/i);
    if (!match) return;

    const index = match[1];
    const jsonKey = settings[k];
    const fieldId =
      settings[`map${index}_fieldId`] ||
      settings[`map${index}_fieldid`];

    if (!jsonKey || !fieldId) {
      console.warn(`⚠️ Incomplete mapping at index ${index}`, {
        jsonKey,
        fieldId
      });
      return;
    }

    mappings.push({
      jsonKey: String(jsonKey).trim(),
      questionId: String(fieldId).trim(),
      domId: `input_${String(fieldId).trim()}`
    });

    console.log(`✔ Mapping ${index} resolved`, {
      jsonKey,
      questionId: fieldId
    });
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
  console.log("Settings received:", settings);

  const jsonURL = settings.jsonURL;
  const searchKey = (settings.searchKey || "").trim();
  const idKey = (settings.idKey || searchKey).trim();
  const minChars = Number(settings.minChars || 2);
  const returnFormat = (settings.returnFormat || "value").toLowerCase();

  const input = document.getElementById("searchBox");
  const results = document.getElementById("results");
  const statusEl = document.getElementById("status");

  if (!jsonURL || !searchKey || !idKey) {
    console.error("❌ Missing required settings");
    statusEl.textContent =
      "Widget configuration error: jsonURL, searchKey, or idKey missing.";
    statusEl.style.color = "red";
    console.groupEnd();
    return;
  }

  const FIELD_MAPPINGS = extractMappings(settings);
  console.log("Resolved mappings:", FIELD_MAPPINGS);

  if (!FIELD_MAPPINGS.length) {
    console.error("❌ No mappings received at runtime");
    statusEl.textContent =
      "Configuration error: No field mappings detected. Delete and re-add the widget, then re-save mapping fields.";
    statusEl.style.color = "red";
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
      console.error("❌ JSON load failed", err);
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

    if (!FIELD_MAPPINGS.length) {
      console.warn("Selection aborted: no mappings available");
      console.groupEnd();
      return;
    }

    const flat = entry.flat;
    console.log("Selected record:", flat);

    const payload = [];

    FIELD_MAPPINGS.forEach(map => {
      const value = flat[map.jsonKey];
      if (value === undefined) {
        console.warn(`JSON key missing: ${map.jsonKey}`);
        return;
      }

      payload.push({
        id: map.questionId,
        value: String(value)
      });

      // DOM fallback
      JFCustomWidget.storeToField(map.domId, String(value));
    });

    console.log("Question-ID payload:", payload);

    if (payload.length) {
      JFCustomWidget.setFieldsValueById(payload);
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
