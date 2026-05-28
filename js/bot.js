// Bot AI: races along its shortest path (BFS) and strategically places walls
// to delay the human. Behavior is tuned by difficulty. The engine's
// canPlaceWall guarantees no wall ever traps either player.

// Per-difficulty knobs:
//   blunder   - chance the bot plays a random legal move instead of the best one
//   wallStyle - how eagerly it spends walls: 'desperate' | 'reactive' | 'aggressive'
const DIFFICULTY = {
  easy: { blunder: 0.4, wallStyle: 'desperate' },
  medium: { blunder: 0.0, wallStyle: 'reactive' },
  hard: { blunder: 0.0, wallStyle: 'aggressive' },
};

function distAt(engine, who, row, col) {
  return engine.distanceFrom(row, col, engine.players[who].goalRow);
}

// Best legal step for the bot: the move that minimizes its distance to goal.
function bestAdvanceMove(engine) {
  const moves = engine.getValidMoves('bot');
  let best = null;
  let bestDist = Infinity;
  for (const m of moves) {
    const d = distAt(engine, 'bot', m.row, m.col);
    if (d < bestDist) {
      bestDist = d;
      best = m;
    }
  }
  return best ? { move: best, dist: bestDist } : null;
}

// Search every legal wall for the one that most improves the bot's standing
// (maximizes newHumanDist - newBotDist). Returns the candidate or null.
function bestDelayWall(engine, humanDist, botDist) {
  if (engine.players.bot.walls <= 0) return null;

  let best = null;
  let bestScore = -Infinity;

  for (const orientation of ['h', 'v']) {
    const set = orientation === 'h' ? engine.hWalls : engine.vWalls;
    for (let r = 0; r < engine.size - 1; r++) {
      for (let c = 0; c < engine.size - 1; c++) {
        if (!engine.canPlaceWall(orientation, r, c)) continue;

        const k = `${r},${c}`;
        set.add(k);
        const newHuman = engine.shortestPathLength('human');
        const newBot = engine.shortestPathLength('bot');
        set.delete(k);

        if (newHuman === Infinity || newBot === Infinity) continue;
        if (newHuman <= humanDist) continue; // wall must actually delay the human

        // Relative standing after walling (lower bot distance is better for bot).
        const score = newHuman - newBot;
        if (score > bestScore) {
          bestScore = score;
          best = { orientation, r, c, newHuman, newBot };
        }
      }
    }
  }
  return best;
}

// Should the bot wall instead of advancing, given a candidate wall?
// net = how much the wall delays the human, minus the detour it costs the bot.
//   net >= 2  -> walling improves the bot's standing more than advancing does
//   net == 1  -> walling roughly matches advancing (useful as defense)
function shouldWall(wallStyle, wall, humanDist, botDist) {
  const gain = wall.newHuman - humanDist; // human delay
  const selfCost = wall.newBot - botDist; // bot's own detour
  const net = gain - selfCost;
  if (gain <= 0) return false;

  if (wallStyle === 'desperate') {
    // Easy: only wall to survive when the human is about to win.
    return humanDist <= 2 && net >= 1;
  }
  if (wallStyle === 'aggressive') {
    // Hard: proactive walls, generous defense, and walls whenever behind.
    return net >= 2 || (humanDist <= 4 && net >= 1) || (humanDist < botDist && net >= 1);
  }
  // Reactive (medium): proactive walls plus defense as the human nears its goal.
  return net >= 2 || (humanDist <= 3 && net >= 1);
}

// Decide the bot's action for this turn.
// Returns { type: 'move', row, col } or { type: 'wall', orientation, r, c }.
export function chooseBotMove(engine, level = 'medium') {
  const cfg = DIFFICULTY[level] || DIFFICULTY.medium;
  const humanDist = engine.shortestPathLength('human');
  const botDist = engine.shortestPathLength('bot');
  const advance = bestAdvanceMove(engine);

  // Easy bot occasionally plays a random legal move.
  if (cfg.blunder > 0 && Math.random() < cfg.blunder) {
    const moves = engine.getValidMoves('bot');
    if (moves.length) {
      const m = moves[Math.floor(Math.random() * moves.length)];
      return { type: 'move', row: m.row, col: m.col };
    }
  }

  // Take an immediate winning step if one exists.
  if (advance && advance.dist === 0) {
    return { type: 'move', row: advance.move.row, col: advance.move.col };
  }

  const wall = bestDelayWall(engine, humanDist, botDist);
  if (wall && shouldWall(cfg.wallStyle, wall, humanDist, botDist)) {
    return { type: 'wall', orientation: wall.orientation, r: wall.r, c: wall.c };
  }

  if (advance) {
    return { type: 'move', row: advance.move.row, col: advance.move.col };
  }

  // Fully boxed in (extremely rare): place any legal wall to pass the turn.
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
