# Wallzy.gg

A turn-based **wall-and-race strategy game** (a Quoridor-style game with a jump
rule) you play against a search-based bot. Multiple game modes, four difficulty
tiers, XP/leveling, coins, and a cosmetics shop. Built as an installable,
**offline-ready Progressive Web App** in vanilla JavaScript — no build step, no
dependencies.

> Race to the far side of the board before the bot does. Drop two-tile walls to
> stall it, jump over it when you meet face-to-face, and don't let your clock
> hit zero. Win games to earn XP and coins, then spend them in the shop.

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

- Each player gets a **wall budget** (10 in Classic; varies by mode). Walls are
  **two tiles long** and block movement.
- Walls **cannot overlap** or partially overlap, and **cannot cross** another wall.
- A wall can **never completely block** a player from reaching their goal — every
  placement is validated with breadth-first search before it's allowed.

### Timer

- Each player has a separate time pool (60s in Classic; varies by mode) that
  **only ticks down during that player's turns**.
- Run out of time and you lose.

### Win conditions

- Reach the opponent's starting row, **or**
- The opponent's clock reaches zero.

---

## Game modes

Choose a mode on the **Play** screen:

| Mode | Board | Clock | Walls | Vibe |
| --- | --- | --- | --- | --- |
| **Classic** | 9×9 | 60s | 10 | The standard, balanced duel. |
| **Blitz** | 9×9 | 30s | 6 | Fast and aggressive — half the clock. |
| **Fortress** | 9×9 | 90s | 16 | Wall-heavy tactics; build mazes. |
| **Grand** | 11×11 | 90s | 14 | Bigger board, longer strategy. |

## Difficulty

The bot is an **alpha-beta minimax** that searches pawn moves and walls, pruning
wall candidates to those that actually block your shortest path. Pick a tier:

- **Easy** — depth-1 greedy with frequent random moves; only walls to survive.
- **Medium** — 2-ply search with a touch of randomness.
- **Hard** — 3-ply search, no mistakes, purposeful walls.
- **Expert** — 4-ply search; plans walls several moves ahead.

It only spends a wall when it still pays off after your best reply (so it no
longer dumps its whole wall stock), and it never places a wall that traps anyone.

## Progression & shop

- **XP & levels** — every game grants XP (more for a win); fill the bar to level
  up and earn bonus coins.
- **Coins** — earned each game (and on level-up). Spend them in the **Shop**.
- **Cosmetics** — buy and equip **pawn skins**, **board themes**, and **wall
  styles**. Equipped cosmetics reskin the whole game instantly.
- Progress is saved to `localStorage`, so it persists across sessions and works
  fully offline.

You can return to the home screen any time with the **Menu** button (top-right)
or **Home** on the win screen.

## Controls

| Action | Mouse / Touch | Keyboard |
| --- | --- | --- |
| Move | Tap a highlighted tile | Arrow keys |
| Toggle wall mode | "Place Wall" button | `W` |
| Rotate wall | "Horizontal / Vertical" | `R` |
| Place wall | Tap a board groove | — |
| Open menu | "Menu" button | — |

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
│   ├── bot.js            # Bot AI: alpha-beta minimax with wall-candidate pruning
│   ├── timer.js          # Per-player countdown pools
│   ├── renderer.js       # Board rendering (any size), highlights, wall preview, input
│   ├── modes.js          # Game-mode definitions (board size, clock, walls, rewards)
│   ├── cosmetics.js      # Cosmetic catalog + CSS-variable theming
│   ├── profile.js        # XP/level math, coins, ownership, localStorage persistence
│   └── main.js           # Screens, turn manager, shop, HUD, service-worker registration
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
> a versioned cache (`wallzy-v3` in `service-worker.js`). When you ship changes,
> bump that version string so clients fetch the new files.

---

## Tech notes

- **Vanilla JS + ES modules**, no framework, no bundler, no runtime dependencies.
- **Wall geometry** is anchored at intersection posts `(r, c)` for `r, c ∈ [0, 7]`;
  overlap, crossing, and collinear conflicts are rejected, and a BFS confirms both
  players still have a path before any wall is committed.
- **Bot AI** is an iterative-deepening **alpha-beta minimax** under a per-turn
  time budget. The evaluation is the BFS shortest-path difference between the two
  players (plus a small wall-economy term). Wall candidates are pruned to the
  walls that block an edge of the opponent's current shortest path, which keeps
  the branching factor manageable and the bot's walls purposeful. Difficulty maps
  to search depth, randomness, and wall-candidate breadth.
- **Board size is parameterized**, so the engine, renderer, and AI all work for
  9×9 and 11×11 alike.
- **Progression** (XP, coins, owned/equipped cosmetics) is persisted to
  `localStorage`; cosmetics are applied by writing CSS custom properties on
  `:root`, so a theme swap restyles the whole UI with no re-render.
