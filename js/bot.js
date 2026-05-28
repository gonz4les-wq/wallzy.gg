// Bot AI: races along its shortest path (BFS) and strategically places walls
// to delay the human when the human is ahead. Never traps either player
// (the engine's canPlaceWall enforces path preservation).

// Distance to goal for a hypothetical pawn position.
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

// Search every legal wall for the one that best delays the human relative to
// the bot. Returns the candidate plus the resulting human distance, or null.
function bestDelayWall(engine, humanDist, botDist) {
  if (engine.players.bot.walls <= 0) return null;

  let best = null;
  let bestScore = 0; // require a strictly positive improvement

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

        // Reward slowing the human; penalize self-inflicted detours.
        const humanDelay = newHuman - humanDist;
        const botPenalty = newBot - botDist;
        const score = humanDelay - botPenalty;

        if (humanDelay > 0 && score > bestScore) {
          bestScore = score;
          best = { orientation, r, c, newHuman, newBot };
        }
      }
    }
  }
  return best;
}

// Decide the bot's action for this turn.
// Returns { type: 'move', row, col } or { type: 'wall', orientation, r, c }.
export function chooseBotMove(engine) {
  const humanDist = engine.shortestPathLength('human');
  const botDist = engine.shortestPathLength('bot');
  const advance = bestAdvanceMove(engine);

  // If the bot is at least as close as the human, just race for the goal.
  // Also race when one move wins, or when no walls remain.
  const shouldRace =
    !advance ||
    advance.dist === 0 ||
    botDist <= humanDist ||
    engine.players.bot.walls <= 0;

  if (!shouldRace) {
    const wall = bestDelayWall(engine, humanDist, botDist);
    // Only wall when it delays the human more than it costs the bot, and the
    // human is genuinely ahead enough to be worth a wall.
    if (wall && wall.newHuman > wall.newBot) {
      return { type: 'wall', orientation: wall.orientation, r: wall.r, c: wall.c };
    }
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
