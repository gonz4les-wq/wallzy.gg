// Core game engine: 9x9 grid, movement, jump logic, wall system + validator,
// win conditions. Pure logic — no DOM. Used by the UI layer and the bot AI.

export const BOARD_SIZE = 9;
export const WALLS_PER_PLAYER = 10;
export const START_TIME_MS = 60 * 1000;

const DIRECTIONS = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
};

const key = (r, c) => `${r},${c}`;

export class GameEngine {
  constructor() {
    this.reset();
  }

  reset() {
    this.size = BOARD_SIZE;
    // row 0 = top, row 8 = bottom.
    this.players = {
      human: { row: 8, col: 4, goalRow: 0, walls: WALLS_PER_PLAYER },
      bot: { row: 0, col: 4, goalRow: 8, walls: WALLS_PER_PLAYER },
    };
    // Wall "centers" anchored at intersection posts (r, c) for r, c in [0, 7].
    this.hWalls = new Set(); // horizontal walls block vertical movement
    this.vWalls = new Set(); // vertical walls block horizontal movement
    this.turn = 'human';
    this.winner = null; // null | { who, reason }
  }

  opponentOf(who) {
    return who === 'human' ? 'bot' : 'human';
  }

  inBounds(r, c) {
    return r >= 0 && r < this.size && c >= 0 && c < this.size;
  }

  // Is movement between two orthogonally-adjacent cells blocked by a wall?
  isBlocked(r1, c1, r2, c2) {
    const dr = r2 - r1;
    const dc = c2 - c1;
    if (dr === -1 && dc === 0) {
      // up: groove between row r1-1 and r1
      return this.hWalls.has(key(r1 - 1, c1)) || this.hWalls.has(key(r1 - 1, c1 - 1));
    }
    if (dr === 1 && dc === 0) {
      // down: groove between row r1 and r1+1
      return this.hWalls.has(key(r1, c1)) || this.hWalls.has(key(r1, c1 - 1));
    }
    if (dr === 0 && dc === -1) {
      // left: groove between col c1-1 and c1
      return this.vWalls.has(key(r1, c1 - 1)) || this.vWalls.has(key(r1 - 1, c1 - 1));
    }
    if (dr === 0 && dc === 1) {
      // right: groove between col c1 and c1+1
      return this.vWalls.has(key(r1, c1)) || this.vWalls.has(key(r1 - 1, c1));
    }
    return true; // not orthogonally adjacent
  }

  // Legal destination cells for a pawn this turn, including jump/side-step moves.
  getValidMoves(who) {
    const me = this.players[who];
    const opp = this.players[this.opponentOf(who)];
    const moves = [];

    for (const [dr, dc] of Object.values(DIRECTIONS)) {
      const tr = me.row + dr;
      const tc = me.col + dc;
      if (!this.inBounds(tr, tc)) continue;
      if (this.isBlocked(me.row, me.col, tr, tc)) continue;

      const targetIsOpp = tr === opp.row && tc === opp.col;
      if (!targetIsOpp) {
        moves.push({ row: tr, col: tc, jump: false });
        continue;
      }

      // Opponent is directly adjacent in the movement direction -> jump.
      const lr = tr + dr;
      const lc = tc + dc;
      if (this.inBounds(lr, lc) && !this.isBlocked(tr, tc, lr, lc)) {
        // Straight jump over the opponent.
        moves.push({ row: lr, col: lc, jump: true });
      } else {
        // Straight jump blocked (edge or wall behind opponent):
        // fall back to the two cells beside the opponent (perpendicular).
        const perp = dr === 0 ? [DIRECTIONS.up, DIRECTIONS.down] : [DIRECTIONS.left, DIRECTIONS.right];
        for (const [pr, pc] of perp) {
          const sr = tr + pr;
          const sc = tc + pc;
          if (!this.inBounds(sr, sc)) continue;
          if (this.isBlocked(tr, tc, sr, sc)) continue;
          if (sr === me.row && sc === me.col) continue;
          moves.push({ row: sr, col: sc, jump: true });
        }
      }
    }
    return moves;
  }

  isValidMove(who, row, col) {
    return this.getValidMoves(who).some((m) => m.row === row && m.col === col);
  }

  movePawn(who, row, col) {
    if (this.winner) return false;
    if (this.turn !== who) return false;
    if (!this.isValidMove(who, row, col)) return false;

    const me = this.players[who];
    me.row = row;
    me.col = col;

    if (me.row === me.goalRow) {
      this.winner = { who, reason: 'goal' };
    } else {
      this.turn = this.opponentOf(who);
    }
    return true;
  }

  // Wall placement legality (geometry + overlap), ignoring path preservation.
  isWallGeometryValid(orientation, r, c) {
    if (r < 0 || r > this.size - 2 || c < 0 || c > this.size - 2) return false;
    if (this.hWalls.has(key(r, c)) || this.vWalls.has(key(r, c))) return false; // post occupied
    if (orientation === 'h') {
      // collinear overlap along the same horizontal groove
      if (this.hWalls.has(key(r, c - 1)) || this.hWalls.has(key(r, c + 1))) return false;
    } else {
      // collinear overlap along the same vertical groove
      if (this.vWalls.has(key(r - 1, c)) || this.vWalls.has(key(r + 1, c))) return false;
    }
    return true;
  }

  // Full legality: geometry + both players keep a path to their goal.
  canPlaceWall(orientation, r, c) {
    if (!this.isWallGeometryValid(orientation, r, c)) return false;
    const set = orientation === 'h' ? this.hWalls : this.vWalls;
    set.add(key(r, c));
    const ok = this.hasPath('human') && this.hasPath('bot');
    set.delete(key(r, c));
    return ok;
  }

  placeWall(who, orientation, r, c) {
    if (this.winner) return false;
    if (this.turn !== who) return false;
    if (this.players[who].walls <= 0) return false;
    if (!this.canPlaceWall(orientation, r, c)) return false;

    const set = orientation === 'h' ? this.hWalls : this.vWalls;
    set.add(key(r, c));
    this.players[who].walls -= 1;
    this.turn = this.opponentOf(who);
    return true;
  }

  // BFS reachability from a player's current cell to any cell in its goal row.
  hasPath(who) {
    return this.shortestPathLength(who) !== Infinity;
  }

  // BFS distance (in steps) from a player's cell to its goal row. Ignores the
  // opponent pawn (it can move out of the way), per standard Quoridor rules.
  shortestPathLength(who) {
    const me = this.players[who];
    return this.distanceFrom(me.row, me.col, me.goalRow);
  }

  distanceFrom(startRow, startCol, goalRow) {
    const visited = new Uint8Array(this.size * this.size);
    const queue = [[startRow, startCol, 0]];
    visited[startRow * this.size + startCol] = 1;

    while (queue.length) {
      const [r, c, d] = queue.shift();
      if (r === goalRow) return d;
      for (const [dr, dc] of Object.values(DIRECTIONS)) {
        const nr = r + dr;
        const nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        if (visited[nr * this.size + nc]) continue;
        if (this.isBlocked(r, c, nr, nc)) continue;
        visited[nr * this.size + nc] = 1;
        queue.push([nr, nc, d + 1]);
      }
    }
    return Infinity;
  }

  // Snapshot for the renderer / AI.
  getState() {
    return {
      players: {
        human: { ...this.players.human },
        bot: { ...this.players.bot },
      },
      hWalls: this.hWalls,
      vWalls: this.vWalls,
      turn: this.turn,
      winner: this.winner,
    };
  }
}
