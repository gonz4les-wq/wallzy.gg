# Daily

A clean, friendly **Progressive Web App** with three tabs: a **To-Do** list, a
**Calendar** day-journal, and a **Shopping** list with multiple profiles. Built
in vanilla JavaScript — no build step, no dependencies, works offline, and
installs to your iPhone Home Screen.

> Three tabs at the bottom. Left: to-do. Middle: calendar. Right: shopping.

---

## Tabs

### 🗒 To-Do (left)
A typical to-do list. Type a task and tap **+** (or press Enter). Tap the box to
mark it done — completed tasks move to the bottom and strike through. Tap 🗑 to
delete. A small summary shows how many are open vs. done.

### 📅 Calendar (middle)
A day-journal that starts on **30 May 2026**. Tap any day from the start date up
to **today** to write a note about it, then look back on it anytime in the
future. Days with a note show a dot. Today is highlighted. Days that haven't
arrived yet are locked. Navigate months with ‹ / › or **Jump to today**.

### 🛒 Shopping (right)
Create different **lists** (profiles) — Groceries, Hardware store, Party, etc.
Tap **+ List** to make one, and tap a chip to switch. Add items, then mark each
one **To buy / Bought** with the toggle on the right (bought items move to the
bottom). Tap the *active* list chip again to rename/delete it.

Everything is saved locally on your device (via `localStorage`) and survives
refreshes and offline use.

---

## Install on iPhone

1. Open the deployed URL in **Safari**.
2. Tap the **Share** button → **Add to Home Screen**.
3. Launch **Daily** from your Home Screen — it runs full-screen, like an app,
   and works offline.

---

## Project structure

```
index.html            App shell: three views + bottom tab bar + day-note sheet
manifest.json         PWA metadata (name, icons, theme, standalone display)
service-worker.js     Offline-first cache of the app shell
css/styles.css        All styling (light + dark, iOS safe-area aware)
js/app.js             Tab navigation + module init + SW registration
js/store.js           localStorage helper (JSON + in-memory fallback)
js/todo.js            To-Do tab
js/calendar.js        Calendar day-journal tab
js/shopping.js        Shopping list tab (multiple profiles)
icons/                App icons (192, 512, maskable)
scripts/generate-icons.js   Regenerates the PNG icons (zero-dependency)
```

## Run locally

It's a static site — serve the folder with any static server:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

A service worker requires `http(s)` (or `localhost`), so open it through a
server rather than `file://`.

## Deploy (GitHub Pages)

The repo is plain static files at the root, so GitHub Pages can serve it
directly: **Settings → Pages → Build and deployment → Deploy from a branch →
`main` / root**.
