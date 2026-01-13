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
// Build mappings (QUESTION ID source of truth)
// ----------------------------------
function buildMappings(settings) {
  const mappings = [];

  for (let i = 1; i <= 15; i++) {
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

// ----------------------------------
// Widget Initialization
// ----------------------------------
JFCustomWidget.subscribe("ready", function () {
  console.group("🧩 Widget Ready");

  const settings = JFCustomWidget.getWidgetSettings() || {};
  console.log("Widget settings received:", settings);

  const jsonURL = settings.jsonURL;
  const searchKey = (settings.searchKey || "").trim();
  const idKey = (settings.idKey || searchKey).trim();
  const returnFormat = (settings.returnFormat || "value").toLowerCase();
  const minChars = Number(settings.minChars || 2);

  if (!jsonURL || !searchKey || !idKey) {
    console.error("❌ REQUIRED SETTINGS MISSING", {
      jsonURL,
      searchKey,
      idKey
    });
    console.groupEnd();
    return;
  }

  const FIELD_MAPPINGS = buildMappings(settings);
  console.log("Resolved mappings:", FIELD_MAPPINGS);

  if (!FIELD_MAPPINGS.length) {
    console.warn("⚠️ No valid field mappings detected");
  }

  const input = document.getElementById("searchBox");
  const results = document.getElementById("results");
  const statusEl = document.getElementById("status");

  let entries = [];
  let selectedEntry = null;

  function setStatus(msg) {
    statusEl.textContent = msg || "";
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
  // Load JSON
  // ----------------------------------
  console.group("📡 Loading JSON");
  fetch(jsonURL, { cache: "no-store" })
    .then(r => r.json())
    .then(json => {
      const data = Array.isArray(json)
        ? json
        : Object.values(json).find(Array.isArray) || [];

      console.log("Raw JSON record sample:", data[0]);

      entries = data.map(item => ({
        item,
        flat: flatten(item)
      }));

      console.log("Flattened keys:", Object.keys(entries[0]?.flat || {}));
      console.groupEnd();
      resize();
    })
    .catch(err => {
      console.error("❌ JSON LOAD FAILED", err);
      console.groupEnd();
    });

  // ----------------------------------
  // Search
  // ----------------------------------
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

  // ----------------------------------
  // Selection + FULL DIAGNOSTICS
  // ----------------------------------
  function selectEntry(entry) {
    console.group("🎯 Selection Event");

    const flat = entry.flat;
    console.log("Selected flat record:", flat);

    const byQuestionId = [];

    FIELD_MAPPINGS.forEach(map => {
      const value = flat[map.jsonKey];

      if (value === undefined) {
        console.warn(`❌ JSON key missing: ${map.jsonKey}`);
        return;
      }

      console.log(`✅ Mapping JSON → Field`, {
        jsonKey: map.jsonKey,
        value,
        questionId: map.questionId,
        domId: map.domId
      });

      byQuestionId.push({
        id: map.questionId,
        value: String(value)
      });

      try {
        JFCustomWidget.storeToField(map.domId, String(value));
        console.log(`✔ storeToField executed for ${map.domId}`);
      } catch (e) {
        console.error(`❌ storeToField failed for ${map.domId}`, e);
      }
    });

    console.log("Question-ID payload:", byQuestionId);

    try {
      JFCustomWidget.setFieldsValueById(byQuestionId);
      console.log("✔ setFieldsValueById executed");
    } catch (e) {
      console.error("❌ setFieldsValueById threw error", e);
    }

    let returnValue;
    if (returnFormat === "json") returnValue = entry.item;
    else if (returnFormat === "flat") returnValue = flat;
    else returnValue = flat[idKey];

    console.log("Widget return value:", returnValue);
    JFCustomWidget.sendData({ value: returnValue });

    selectedEntry = entry;
    input.value = displayLabel(entry);
    setStatus("Selected");
    results.innerHTML = "";

    console.groupEnd();
    resize();
  }

  input.addEventListener("input", debounce(search, 150));

  // ----------------------------------
  // Submit
  // ----------------------------------
  JFCustomWidget.subscribe("submit", function () {
    console.group("📨 Submit Event");

    if (!selectedEntry) {
      console.error("❌ Submit blocked: no selection");
      JFCustomWidget.sendSubmit({ valid: false, value: "" });
      console.groupEnd();
      return;
    }

    console.log("Submitting value:", selectedEntry.flat[idKey]);
    JFCustomWidget.sendSubmit({
      valid: true,
      value: selectedEntry.flat[idKey]
    });

    console.groupEnd();
  });

  console.groupEnd();
});
