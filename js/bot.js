// Bot AI: alpha-beta minimax over pawn moves and walls, with iterative
// deepening under a per-turn time budget. Wall candidates are pruned to the
// walls that actually intersect the opponent's current shortest path, which
// keeps the branching factor sane and the bot's walls purposeful (it only
// spends one when it still pays off after the human's best reply).

import { GameEngine } from './engine.js';

export const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'expert'];

const LEVELS = {
  easy: { maxDepth: 1, blunder: 0.35, maxWalls: 6, timeMs: 60 },
  medium: { maxDepth: 2, blunder: 0.06, maxWalls: 10, timeMs: 150 },
  hard: { maxDepth: 3, blunder: 0, maxWalls: 12, timeMs: 320 },
  expert: { maxDepth: 4, blunder: 0, maxWalls: 14, timeMs: 600 },
};

const WIN = 1e6;

// ---- search state (a lightweight clone of the live engine) ----

function cloneEngine(e) {
  const c = new GameEngine();
  c.size = e.size;
  c.players = { human: { ...e.players.human }, bot: { ...e.players.bot } };
  c.hWalls = new Set(e.hWalls);
  c.vWalls = new Set(e.vWalls);
  c.turn = e.turn;
  c.winner = e.winner;
  return c;
}

function applyAction(s, a) {
  const who = s.turn;
  if (a.type === 'move') {
    const p = s.players[who];
    const undo = { type: 'move', who, row: p.row, col: p.col, winner: s.winner };
    p.row = a.row;
    p.col = a.col;
    if (p.row === p.goalRow) s.winner = { who, reason: 'goal' };
    else s.turn = s.opponentOf(who);
    return undo;
  }
  const set = a.orientation === 'h' ? s.hWalls : s.vWalls;
  const key = `${a.r},${a.c}`;
  set.add(key);
  s.players[who].walls -= 1;
  s.turn = s.opponentOf(who);
  return { type: 'wall', who, orientation: a.orientation, key };
}

function undoAction(s, u) {
  if (u.type === 'move') {
    const p = s.players[u.who];
    p.row = u.row;
    p.col = u.col;
    s.winner = u.winner;
    s.turn = u.who;
  } else {
    const set = u.orientation === 'h' ? s.hWalls : s.vWalls;
    set.delete(u.key);
    s.players[u.who].walls += 1;
    s.turn = u.who;
  }
}

// Evaluation from the bot's perspective (higher = better for the bot).
function evaluate(s) {
  const botDist = s.shortestPathLength('bot');
  const humanDist = s.shortestPathLength('human');
  // Mild preference to keep walls in reserve so ties favor advancing.
  const wallEconomy = 0.05 * (s.players.bot.walls - s.players.human.walls);
  return humanDist - botDist + wallEconomy;
}

// One shortest path (list of cells) for a player, using BFS with parents.
function shortestPathCells(s, who) {
  const start = s.players[who];
  const goalRow = start.goalRow;
  const N = s.size;
  if (start.row === goalRow) return [{ row: start.row, col: start.col }];

  const prev = new Array(N * N).fill(-1);
  const visited = new Uint8Array(N * N);
  const q = [start.row * N + start.col];
  visited[q[0]] = 1;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  let goalIdx = -1;

  for (let h = 0; h < q.length; h++) {
    const idx = q[h];
    const r = (idx / N) | 0;
    const c = idx % N;
    if (r === goalRow) {
      goalIdx = idx;
      break;
    }
    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N) continue;
      const ni = nr * N + nc;
      if (visited[ni] || s.isBlocked(r, c, nr, nc)) continue;
      visited[ni] = 1;
      prev[ni] = idx;
      q.push(ni);
    }
  }
  if (goalIdx === -1) return [];

  const path = [];
  for (let cur = goalIdx; cur !== -1; cur = prev[cur]) {
    path.push({ row: (cur / N) | 0, col: cur % N });
  }
  return path.reverse();
}

// Legal walls that block an edge along the opponent's shortest path.
function wallCandidates(s, player, maxWalls) {
  const target = s.opponentOf(player);
  const path = shortestPathCells(s, target);
  const seen = new Set();
  const out = [];

  for (let i = 0; i < path.length - 1 && out.length < maxWalls; i++) {
    const a = path[i];
    const b = path[i + 1];
    let posts;
    if (a.col === b.col) {
      // vertical step -> a horizontal wall blocks it
      const r = Math.min(a.row, b.row);
      posts = [['h', r, a.col], ['h', r, a.col - 1]];
    } else {
      // horizontal step -> a vertical wall blocks it
      const c = Math.min(a.col, b.col);
      posts = [['v', a.row, c], ['v', a.row - 1, c]];
    }
    for (const [o, r, c] of posts) {
      const k = `${o},${r},${c}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (s.canPlaceWall(o, r, c)) out.push({ type: 'wall', orientation: o, r, c });
      if (out.length >= maxWalls) break;
    }
  }
  return out;
}

function generateActions(s, player, cfg) {
  const goalRow = s.players[player].goalRow;
  const moves = s
    .getValidMoves(player)
    .map((m) => ({ a: { type: 'move', row: m.row, col: m.col }, d: s.distanceFrom(m.row, m.col, goalRow) }))
    .sort((x, y) => x.d - y.d)
    .map((x) => x.a);

  if (s.players[player].walls > 0) {
    return moves.concat(wallCandidates(s, player, cfg.maxWalls));
  }
  return moves;
}

function alphabeta(s, depth, alpha, beta, deadline, cfg) {
  if (s.winner) {
    return { score: s.winner.who === 'bot' ? WIN + depth : -(WIN + depth) };
  }
  if (depth === 0 || performance.now() > deadline) {
    return { score: evaluate(s) };
  }

  const maximizing = s.turn === 'bot';
  const actions = generateActions(s, s.turn, cfg);
  let best = maximizing ? -Infinity : Infinity;
  let bestAction = null;

  for (const a of actions) {
    const undo = applyAction(s, a);
    const score = alphabeta(s, depth - 1, alpha, beta, deadline, cfg).score;
    undoAction(s, undo);

    if (maximizing) {
      if (score > best) {
        best = score;
        bestAction = a;
      }
      if (best > alpha) alpha = best;
    } else {
      if (score < best) {
        best = score;
        bestAction = a;
      }
      if (best < beta) beta = best;
    }
    if (beta <= alpha) break;
    if (performance.now() > deadline) break;
  }
  return { score: best, action: bestAction };
}

function searchMove(engine, cfg) {
  const root = cloneEngine(engine);
  const deadline = performance.now() + cfg.timeMs;
  let best = null;
  for (let depth = 2; depth <= cfg.maxDepth; depth++) {
    const res = alphabeta(root, depth, -Infinity, Infinity, deadline, cfg);
    if (res.action) best = res.action;
    if (performance.now() > deadline) break;
  }
  return best || greedyMove(engine);
}

function greedyMove(engine) {
  const moves = engine.getValidMoves('bot');
  if (!moves.length) return fallbackWall(engine);
  const goalRow = engine.players.bot.goalRow;
  let best = moves[0];
  let bestDist = Infinity;
  for (const m of moves) {
    const d = engine.distanceFrom(m.row, m.col, goalRow);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return { type: 'move', row: best.row, col: best.col };
}

function easyMove(engine, cfg) {
  const moves = engine.getValidMoves('bot');
  if (!moves.length) return fallbackWall(engine);

  if (Math.random() < cfg.blunder) {
    const m = moves[Math.floor(Math.random() * moves.length)];
    return { type: 'move', row: m.row, col: m.col };
  }

  // Defend only when the human is about to win.
  const humanDist = engine.shortestPathLength('human');
  if (humanDist <= 2 && engine.players.bot.walls > 0) {
    const cands = wallCandidates(engine, 'bot', cfg.maxWalls);
    let bestWall = null;
    let bestHuman = humanDist;
    for (const w of cands) {
      const set = w.orientation === 'h' ? engine.hWalls : engine.vWalls;
      const key = `${w.r},${w.c}`;
      set.add(key);
      const nh = engine.shortestPathLength('human');
      set.delete(key);
      if (nh > bestHuman) {
        bestHuman = nh;
        bestWall = w;
      }
    }
    if (bestWall) return bestWall;
  }
  return greedyMove(engine);
}

function fallbackWall(engine) {
  for (const orientation of ['h', 'v']) {
    for (let r = 0; r < engine.size - 1; r++) {
      for (let c = 0; c < engine.size - 1; c++) {
        if (engine.canPlaceWall(orientation, r, c)) {
          return { type: 'wall', orientation, r, c };
        }
      }
    }
  }
  return null;
}

// Decide the bot's action. Returns { type:'move', row, col } or
// { type:'wall', orientation, r, c }.
export function chooseBotMove(engine, level = 'medium') {
  const cfg = LEVELS[level] || LEVELS.medium;
  if (cfg.maxDepth <= 1) return easyMove(engine, cfg);

  // A touch of randomness keeps medium from feeling robotic.
  if (cfg.blunder > 0 && Math.random() < cfg.blunder) {
    const moves = engine.getValidMoves('bot');
    if (moves.length) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      return { type: 'move', row: m.row, col: m.col };
    }
  }
  return searchMove(engine, cfg);
}
