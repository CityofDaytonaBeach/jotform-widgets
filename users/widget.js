console.clear();
console.log("🚀 Employee Lookup Widget Bootstrapped");

// CONFIG
const API_URL = "https://myefnonvpjbggqqurvhy.supabase.co/functions/v1/users";
let users = [];

const searchInput = document.getElementById("searchUser");
const resultsContainer = document.getElementById("resultsContainer");

// SAFE SEND
function sendWidgetData(data) {
  try {
    if (window.JFCustomWidget) {
      console.log("📤 Sending data to Jotform:", data);
      JFCustomWidget.sendData(data);
    }
  } catch (err) {
    console.warn("⚠ sendData error:", err);
  }
}

// LOAD USER DATA
async function loadUsers() {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error("Fetch failed: " + res.status);

    users = await res.json();
    console.log(`📦 Loaded ${users.length} users from Supabase`);
  } catch (err) {
    console.error("❌ Error fetching users:", err);
  }
}

loadUsers();

// AUTOCOMPLETE
let debounceTimer;

searchInput.addEventListener("input", (e) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    handleSearch(e.target.value.trim().toLowerCase());
  }, 150);
});

function handleSearch(query) {
  resultsContainer.querySelectorAll(".dropdown").forEach(el => el.remove());
  if (!query) return;

  const matches = users
    .filter(u => (u.displayname || "").toLowerCase().includes(query))
    .slice(0, 8);

  console.log("🔎 Search query:", query, "| Matches found:", matches.length);

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
      console.log("🟢 User selected:", u);

      // Autofill JotForm mapping
      if (window.JFCustomWidget) {
        const mapping = {
          input_6:  u.displayname || "",
          input_7:  u.email || "",
          input_8:  u.title || "",
          input_9:  u.department || "",
          input_10: u.manager || "",
          input_11: u.manager_email || "",
          input_12: u.employee_id || "",
          input_13: u.division || ""
        };

        console.log("📥 Autofilling Jotform fields:", mapping);

        JFCustomWidget.setFieldsValue(mapping);
      }

      // Send raw record for storage
      sendWidgetData({ valid: true, value: JSON.stringify(u) });
    });

    dropdown.appendChild(item);
  });

  resultsContainer.appendChild(dropdown);
}

// CLICK OUTSIDE TO CLOSE
document.addEventListener("click", (e) => {
  if (!resultsContainer.contains(e.target)) {
    resultsContainer.querySelectorAll(".dropdown").forEach(el => el.remove());
  }
});

// JOTFORM READY EVENT
if (window.JFCustomWidget) {
  JFCustomWidget.subscribe("ready", () => {
    console.log("🟩 Jotform Widget Ready");
    sendWidgetData({ valid: true, value: "" });
  });
}
