JFCustomWidget.subscribe("ready", async () => {
  const params = JFCustomWidget.getWidgetSettings() || {};

  const {
    jsonURL,
    labelKey,
    valueKey,
    placeholderText = "Select an option",
    enableSearch = false,
    sort = false
  } = params;

  const dropdown = document.getElementById("dropdown");
  const searchInput = document.getElementById("search");
  const statusEl = document.getElementById("status");

  function setError(msg) {
    statusEl.textContent = msg;
  }

  function getValue(obj, path) {
    return path.split(".").reduce((o, k) => (o ? o[k] : undefined), obj);
  }

  function findArray(obj) {
    if (Array.isArray(obj)) return obj;
    if (obj && typeof obj === "object") {
      for (const key in obj) {
        const found = findArray(obj[key]);
        if (found) return found;
      }
    }
    return null;
  }

  if (!jsonURL || !labelKey || !valueKey) {
    setError("Missing widget parameters");
    return;
  }

  try {
    const res = await fetch(jsonURL, { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed");

    const json = await res.json();
    let data = findArray(json);

    if (!Array.isArray(data)) {
      throw new Error("No array found in JSON");
    }

    if (sort) {
      data = [...data].sort((a, b) =>
        String(getValue(a, labelKey) || "").localeCompare(
          String(getValue(b, labelKey) || "")
        )
      );
    }

    dropdown.innerHTML = `<option value="">${placeholderText}</option>`;

    data.forEach(item => {
      const label = getValue(item, labelKey);
      const value = getValue(item, valueKey);
      if (label == null || value == null) return;

      const opt = document.createElement("option");
      opt.value = String(value);
      opt.textContent = String(label);
      dropdown.appendChild(opt);
    });

    // Initialize condition value
    JFCustomWidget.sendData("");

  } catch (err) {
    console.error(err);
    setError("Unable to load dropdown data");
    return;
  }

  if (enableSearch) {
    searchInput.style.display = "block";

    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase();
      Array.from(dropdown.options).forEach((opt, i) => {
        if (i === 0) return;
        opt.hidden = !opt.textContent.toLowerCase().includes(term);
      });
    });
  }

  // CONDITION VALUE EMISSION
  dropdown.addEventListener("change", () => {
    const value = dropdown.value || "";
    JFCustomWidget.sendData(String(value));
  });

  // SUBMIT HANDLING
  JFCustomWidget.subscribe("submit", () => {
    const value = dropdown.value || "";

    JFCustomWidget.sendSubmit({
      valid: !!value,
      value: String(value)
    });
  });
});