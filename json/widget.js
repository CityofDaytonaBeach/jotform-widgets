// ----------------------------------
// Utilities
// ----------------------------------
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

// ----------------------------------
// Build Field-ID Mappings from Settings
// ----------------------------------
function buildMappings(settings) {
  const mappings = [];

  for (let i = 1; i <= 15; i++) {
    const jsonKey = settings[`map${i}_jsonKey`];
    const fieldId = settings[`map${i}_fieldId`];

    if (jsonKey && fieldId) {
      mappings.push({
        jsonKey: jsonKey.trim(),
        fieldId: fieldId.trim()
      });
    }
  }

  return mappings;
}

// ----------------------------------
// Widget Initialization
// ----------------------------------
JFCustomWidget.subscribe("ready", async () => {
  const settings = JFCustomWidget.getWidgetSettings() || {};

  const jsonURL = settings.jsonURL;
  const searchKey = (settings.searchKey || "").trim();
  const idKey = (settings.idKey || searchKey).trim();
  const returnFormat = (settings.returnFormat || "value").toLowerCase();
  const widgetWidth = settings.widgetWidth;
  const minChars = Number(settings.minChars || 2);

  if (!jsonURL || !searchKey || !idKey) {
    console.error("Missing required widget parameters", settings);
    return;
  }

  const FIELD_MAPPINGS = buildMappings(settings);

  const input = document.getElementById("searchBox");
  const results = document.getElementById("results");
  const statusEl = document.getElementById("status");
  const container = document.getElementById("widget");

  if (widgetWidth) {
    container.style.maxWidth = widgetWidth;
  }

  let entries = [];
  let currentList = [];
  let activeIndex = -1;
  let selectedEntry = null;

  function setStatus(msg, type = "") {
    statusEl.textContent = msg;
    statusEl.className = "status" + (type ? ` ${type}` : "");
  }

  function resize() {
    JFCustomWidget.requestFrameResize({
      height: document.body.scrollHeight
    });
  }

  function displayLabel(entry) {
    return String(entry.flat[searchKey] ?? "");
  }

  // ----------------------------------
  // Load Data
  // ----------------------------------
  async function loadData() {
    try {
      const res = await fetch(jsonURL, { cache: "no-store" });
      const json = await res.json();

      const data = Array.isArray(json)
        ? json
        : Object.values(json).find(Array.isArray) || [];

      entries = data.map(item => ({
        item,
        flat: flatten(item)
      }));

      resize();
    } catch (err) {
      console.error(err);
      setStatus("Failed to load data.", "error");
    }
  }

  // ----------------------------------
  // Search
  // ----------------------------------
  function search() {
    const q = input.value.trim().toLowerCase();

    if (q.length < minChars) {
      results.innerHTML = "";
      resize();
      return;
    }

    renderList(
      entries.filter(entry => {
        const v = entry.flat[searchKey];
        return v && String(v).toLowerCase().includes(q);
      })
    );
  }

  function renderList(list) {
    results.innerHTML = "";
    currentList = list;

    if (!list.length) {
      results.innerHTML = `<div class="empty">No matches</div>`;
      resize();
      return;
    }

    activeIndex = 0;

    list.forEach((entry, idx) => {
      const div = document.createElement("div");
      div.className = `result ${idx === 0 ? "selected" : ""}`;
      div.textContent = displayLabel(entry);
      div.onclick = () => selectEntry(entry);
      results.appendChild(div);
    });

    resize();
  }

  // ----------------------------------
  // Selection + ID-Based Population
  // ----------------------------------
  function selectEntry(entry) {
    const flat = entry.flat;
    const identifier = flat[idKey];

    if (identifier == null) {
      setStatus(`Missing ID field: ${idKey}`, "error");
      return;
    }

    const byId = [];

    FIELD_MAPPINGS.forEach(map => {
      const value = flat[map.jsonKey];
      if (value != null) {
        byId.push({ id: map.fieldId, value });
      }
    });

    if (byId.length) {
      JFCustomWidget.setFieldsValueById(byId);
    }

    let value;
    if (returnFormat === "json") value = entry.item;
    else if (returnFormat === "flat") value = flat;
    else value = identifier;

    JFCustomWidget.sendData({ value });

    selectedEntry = entry;
    input.value = displayLabel(entry);
    setStatus("Selected.", "success");

    results.innerHTML = "";
    activeIndex = -1;
    resize();
  }

  // ----------------------------------
  // Events
  // ----------------------------------
  input.addEventListener("input", debounce(search, 150));

  input.addEventListener("keydown", e => {
    if (!currentList.length) return;

    if (e.key === "ArrowDown") {
      activeIndex = Math.min(activeIndex + 1, currentList.length - 1);
    } else if (e.key === "ArrowUp") {
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectEntry(currentList[activeIndex]);
    }

    [...results.querySelectorAll(".result")].forEach((row, idx) =>
      row.classList.toggle("selected", idx === activeIndex)
    );
  });

  // ----------------------------------
  // Submit Enforcement
  // ----------------------------------
  JFCustomWidget.subscribe("submit", () => {
    if (!selectedEntry) {
      JFCustomWidget.sendSubmit({ valid: false, value: "" });
      return;
    }

    const flat = selectedEntry.flat;
    const identifier = flat[idKey];

    let value;
    if (returnFormat === "json") value = selectedEntry.item;
    else if (returnFormat === "flat") value = flat;
    else value = identifier;

    JFCustomWidget.sendSubmit({ valid: true, value });
  });

  loadData();
});
