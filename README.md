# 🧩 Jotform + Supabase Custom Widgets

This repository contains custom **Jotform Widgets** that integrate with **Supabase** for dynamic form functionality — such as fetching data from APIs, populating dropdowns, or auto-filling fields based on live data.

---

## 🚀 Overview

**Goal:**  
Enable Jotform forms to interact with live Supabase data or functions (Edge Functions, REST APIs, etc.) using custom iFrame widgets.

Each widget is a standalone **HTML/JavaScript file** hosted on GitHub Pages (or another static host) and embedded in Jotform using an iFrame.

---

## 📦 Example Widgets

| Widget File | Description |
|--------------|-------------|
| `<a href="https://cityofdaytonabeach.github.io/jotform-widgets/search>search-users-widget.html</a>` | Fetches user data from a Supabase Edge Function connected to the Microsoft Graph API. Allows searching by last name, first name (`Lastname, Firstname` format) and auto-fills Jotform fields. |

---

## 🧠 How It Works

1. **Supabase Function:**  
   A Supabase Edge Function (e.g. `get-users-from-graph-api`) fetches and filters user data, returning a JSON response.

   Example endpoint:  
