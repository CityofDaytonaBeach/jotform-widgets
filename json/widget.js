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
// Build mappings from widget settings
// EXPECTS QUESTION IDs (e.g. "4")
// ==================================
function buildMappings(settings) {
  const mappings = [];

  for (let i = 1; i <= 10; i++) {
    const jsonKey = settings[`map${i}_jsonKey`];
    const qid = settings[`map${i}_fieldId`];

    if (
      !jsonKey ||
      !qid ||
      jsonKey === `map${i}_jsonKey` ||
      qid === `map${i}_fieldId`
    ) {
      continue;
    }

    mappings.push({
      jsonKey: jsonKey.trim(),
      questionId: String(qid).trim(),
      domId: `input_${String(qid).trim()}`
    });
  }

  return mappings;
}

// ==================================
// Widget Initialization
// ==================================
JFCustomWidget.subscribe("ready", function () {
  console.group("Widget Init");

  const settings = JFCustomWidget.getWidgetSettings() || {};
  console.log("Settings received:", settings);

  const jsonURL = settings.jsonURL;
  const searchKey = (settings.searchKey || "").trim();
  const idKey = (settings.idKey || searchKey).trim();
  const minChars = Number(settings.minChars || 2);
  const returnFormat = (settings.returnFormat || "value").toLowerCase();

  if (!jsonURL || !searchKey || !idKey) {
    console.error("Missing required widget settings");
    console.groupEnd();
    return;
  }

  const FIELD_MAPPINGS = buildMappings(settings);
  console.log("Resolved mappings:", FIELD_MAPPINGS);

  if (!FIELD_MAPPINGS.length) {
    console.warn(
      "No mappings resolved. Auto-population will not occur until mapX_* parameters are bound to this widget instance."
    );
  }

  const input = document.getElementById("searchBox");
  const results = document.getElementById("results");
  const statusEl = document.getElementById("status");

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
  console.group("Load JSON");
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
      console.groupEnd();
      resize();
    })
    .catch(err => {
      console.error("JSON load failed", err);
      console.groupEnd();
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

    renderList(filtered);
  }

  function renderList(list) {
    results.innerHTML = "";
    list.forEach(entry => {
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
    console.group("Selection");

    const flat = entry.flat;
    console.log("Selected record:", flat);

    const byQuestionId = [];

    FIELD_MAPPINGS.forEach(map => {
      const value = flat[map.jsonKey];

      if (value === undefined) {
        console.warn(`JSON key not found: ${map.jsonKey}`);
        return;
      }

      console.log("Applying mapping:", map, value);

      byQuestionId.push({
        id: map.questionId,
        value: String(value)
      });

      // DOM-level fallback (official pattern)
      try {
        JFCustomWidget.storeToField(map.domId, String(value));
      } catch (e) {
        console.error("storeToField failed:", map.domId, e);
      }
    });

    console.log("Question-ID payload:", byQuestionId);

    if (byQuestionId.length) {
      try {
        JFCustomWidget.setFieldsValueById(byQuestionId);
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
