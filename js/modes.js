// Game mode definitions. Each mode configures the board size, clock, wall
// budget, bot think speed, and the XP/coin rewards for finishing a game.

export const MODES = {
  classic: {
    id: 'classic',
    name: 'Classic',
    tagline: '9×9 · 60s · 10 walls',
    desc: 'The standard duel. Balanced time and walls.',
    size: 9,
    timeMs: 60000,
    walls: 10,
    thinkMs: 220,
    xpBase: 20,
    coinBase: 10,
  },
  blitz: {
    id: 'blitz',
    name: 'Blitz',
    tagline: '9×9 · 30s · 6 walls',
    desc: 'Fast and aggressive. Half the clock, fewer walls.',
    size: 9,
    timeMs: 30000,
    walls: 6,
    thinkMs: 120,
    xpBase: 26,
    coinBase: 13,
  },
  fortress: {
    id: 'fortress',
    name: 'Fortress',
    tagline: '9×9 · 90s · 16 walls',
    desc: 'Wall-heavy tactics. Build mazes and grind through.',
    size: 9,
    timeMs: 90000,
    walls: 16,
    thinkMs: 240,
    xpBase: 32,
    coinBase: 16,
  },
  grand: {
    id: 'grand',
    name: 'Grand',
    tagline: '11×11 · 90s · 14 walls',
    desc: 'A bigger board for longer, deeper strategy.',
    size: 11,
    timeMs: 90000,
    walls: 14,
    thinkMs: 260,
    xpBase: 38,
    coinBase: 19,
  },
};

export const MODE_ORDER = ['classic', 'blitz', 'fortress', 'grand'];

export function getMode(id) {
  return MODES[id] || MODES.classic;
}
