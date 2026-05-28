# Wallzy.gg

A 9×9 turn-based **wall-and-race strategy game** (a Quoridor-style game with a
jump rule) you play against a bot. Built as an installable, **offline-ready
Progressive Web App** in vanilla JavaScript — no build step, no dependencies.

> Race to the far side of the board before the bot does. Drop two-tile walls to
> stall it, jump over it when you meet face-to-face, and don't let your 60-second
> clock hit zero.

---

## Gameplay

- **You** start at the bottom-middle and win by reaching the **top row**.
- **The bot** starts at the top-middle and wins by reaching the **bottom row**.
- Players alternate turns. **Each turn you do exactly one thing:**
  1. **Move** one tile (up / down / left / right — no diagonals), or
  2. **Place a wall**.

### Jump rule

If the opponent is directly adjacent in the direction you move, you **jump over
it** to the tile behind it (if that tile is free and not blocked by a wall).
If the straight jump is blocked (board edge or a wall behind the opponent), you
may instead step to either tile **beside** the opponent. Jump destinations are
highlighted in amber.

### Walls

- Each player has **10 walls**. Walls are **two tiles long** and block movement.
- Walls **cannot overlap** or partially overlap, and **cannot cross** another wall.
- A wall can **never completely block** a player from reaching their goal — every
  placement is validated with breadth-first search before it's allowed.

### Timer

- Each player has a separate **60-second pool** that **only ticks down during
  that player's turns**.
- Run out of time and you lose.

### Win conditions

- Reach the opponent's starting row, **or**
- The opponent's clock reaches zero.

---

## Controls

| Action | Mouse / Touch | Keyboard |
| --- | --- | --- |
| Move | Tap a highlighted tile | Arrow keys |
| Toggle wall mode | "Place Wall" button | `W` |
| Rotate wall | "Horizontal / Vertical" | `R` |
| Place wall | Tap a board groove | — |
| New game | "New Game" button | — |

---

## Project structure

```
.
├── index.html            # App shell + HUD
├── manifest.json         # PWA manifest (installability)
├── service-worker.js     # Offline-first caching of the app shell
├── css/
│   └── styles.css        # Dark theme, responsive board + UI
├── js/
│   ├── engine.js         # Grid, movement, jump logic, wall system + BFS validator, win checks
│   ├── bot.js            # Bot AI: BFS shortest-path racing + strategic wall placement
│   ├── timer.js          # Per-player countdown pools
│   ├── renderer.js       # Board rendering, highlights, wall preview, input
│   └── main.js           # Turn manager, HUD, win screen, service-worker registration
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

The architecture maps directly onto the requested systems: **grid system**,
**movement engine**, **jump logic**, **wall system + validator**, **turn
manager**, **timer system**, **bot AI**, and **renderer/UI layer**.

---

## Run locally

The app uses native ES modules, so it must be served over HTTP (opening
`index.html` from the filesystem will not load the modules). Any static server
works:

```bash
# Python 3
python3 -m http.server 8000

# or Node
npx serve .
```

Then open <http://localhost:8000>. The service worker (and full offline support)
is active on `http://localhost` and on any HTTPS origin.

---

## Deploy to GitHub Pages

The project is a static site with `index.html` at the repository root, so it
deploys to GitHub Pages as-is — no build step.

1. Push this project to your repository's **`main`** branch (the `index.html`
   must be at the repo root).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Set **Branch** to **`main`** and the folder to **`/ (root)`**, then **Save**.
5. Wait for the deployment to finish, then open the published URL
   (`https://<your-username>.github.io/<repo-name>/`).

Because every asset path is **relative** (`./...`), the app works correctly when
served from a repository subpath such as `/<repo-name>/`.

### Installing the PWA

Once the page is open over HTTPS (GitHub Pages serves HTTPS automatically), use
your browser's **Install app** / **Add to Home Screen** option. After the first
load the game is fully playable offline.

> **Updating the deployed app:** the service worker precaches the app shell under
> a versioned cache (`wallzy-v1` in `service-worker.js`). When you ship changes,
> bump that version string so clients fetch the new files.

---

## Tech notes

- **Vanilla JS + ES modules**, no framework, no bundler, no runtime dependencies.
- **Wall geometry** is anchored at intersection posts `(r, c)` for `r, c ∈ [0, 7]`;
  overlap, crossing, and collinear conflicts are rejected, and a BFS confirms both
  players still have a path before any wall is committed.
- **Bot AI** computes BFS shortest paths for both players each turn: it races when
  it's level or ahead, and otherwise searches all legal walls for the one that
  delays you most without hurting its own route (and never one that traps anyone).
