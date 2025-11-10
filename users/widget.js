console.clear();
console.log("🔍 Loading Employee Lookup Widget...");

// ===== CONFIG =====
const API_URL = "https://myefnonvpjbggqqurvhy.supabase.co/functions/v1/users";
let users = [];

const searchInput = document.getElementById("searchUser");
const resultsContainer = document.getElementById("resultsContainer");

// ===== SAFE DATA SEND =====
function sendWidgetData(data) {
  try {
    if (window.JFCustomWidget) JFCustomWidget.sendData(data);
  } catch (err) {
    console.warn("⚠ sendData failed:", err);
  }
}

// ===== AUTOFILL JOTFORM FIELDS =====
function fillFormFields(user) {
  const fieldMappings = {
    input_5: user.displayname || "",
    input_6: user.mail || "",
    input_7: user.jobtitle || "",
    input_8: user.department || "",
    input_9: user.manager || "",
    input_10: user.managermail || "",
    input_11: user.employeeId || "",
    input_12: user.division || ""
  };

  Object.entries(fieldMappings).forEach(([id, value]) => {
    try {
      if (window.JFCustomWidget && typeof JFCustomWidget.setFieldValue === "function") {
        // HIPAA-safe internal API call
        JFCustomWidget.setFieldValue(id, value);
      } else {
        // fallback for non-HIPAA forms
        window.parent.postMessage({ type: "populate", qid: id, value }, "*");
      }
    } catch (err) {
      console.warn("⚠ Failed to set field:", id, err);
    }
  });

  console.log("✅ Sent field data to parent form:", fieldMappings);
}

// ===== LOAD USERS =====
async function loadUsers() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    users = await res.json();
    console.log(`✅ Loaded ${users.length} users`);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
  }
}

loadUsers();

// ===== AUTOCOMPLETE LOGIC =====
searchInput.addEventListener("input", (e) => {
  const query = e.target.value.trim().toLowerCase();
  resultsContainer.querySelectorAll(".dropdown").forEach(d => d.remove());
  if (!query) return;

  const matches = users
    .filter(u => (u.displayname || "").toLowerCase().includes(query))
    .slice(0, 8);
  if (!matches.length) return;

  const dropdown = document.createElement("div");
  dropdown.className = "dropdown";

  matches.forEach(u => {
    const item = document.createElement("div");
    item.className = "dropdown-item";
    item.textContent = u.displayname || "(No Name)";
    item.addEventListener("click", () => {
      searchInput.value = u.displayname || "";
      dropdown.remove();
      console.log("✅ Selected user:", u);

      fillFormFields(u);
      sendWidgetData({ valid: true, value: JSON.stringify(u) });
    });
    dropdown.appendChild(item);
  });

  resultsContainer.appendChild(dropdown);
});

// ===== CLICK OUTSIDE TO CLOSE =====
document.addEventListener("click", (e) => {
  if (!resultsContainer.contains(e.target) && e.target !== searchInput) {
    resultsContainer.querySelectorAll(".dropdown").forEach(d => d.remove());
  }
});

// ===== JOTFORM WIDGET READY =====
if (window.JFCustomWidget) {
  JFCustomWidget.subscribe("ready", function () {
    console.log("✅ Jotform Widget Ready");
    sendWidgetData({ valid: true, value: "" });
  });
}
