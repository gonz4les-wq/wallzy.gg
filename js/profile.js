// Player profile: XP, level, coins, owned/equipped cosmetics, and stats.
// Persisted to localStorage. Falls back to an in-memory profile if storage
// is unavailable (e.g. private mode), so the game always works offline.

import { DEFAULT_EQUIPPED, DEFAULT_OWNED, getItem } from './cosmetics.js';

const KEY = 'wallzy.profile.v1';

function freshProfile() {
  return {
    xp: 0,
    coins: 0,
    owned: [...DEFAULT_OWNED],
    equipped: { ...DEFAULT_EQUIPPED },
    stats: { played: 0, wins: 0, losses: 0 },
  };
}

export function loadProfile() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return freshProfile();
    const saved = JSON.parse(raw);
    const base = freshProfile();
    return {
      xp: Number(saved.xp) || 0,
      coins: Number(saved.coins) || 0,
      owned: Array.isArray(saved.owned) ? Array.from(new Set([...base.owned, ...saved.owned])) : base.owned,
      equipped: { ...base.equipped, ...(saved.equipped || {}) },
      stats: { ...base.stats, ...(saved.stats || {}) },
    };
  } catch {
    return freshProfile();
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(profile));
  } catch {
    /* storage unavailable — keep playing with the in-memory profile */
  }
}

// Cost of advancing from `level` to `level + 1`. Grows linearly.
function costForLevel(level) {
  return 100 + (level - 1) * 60;
}

// Derive level + progress from total XP.
export function levelInfo(xp) {
  let level = 1;
  let remaining = xp;
  while (remaining >= costForLevel(level)) {
    remaining -= costForLevel(level);
    level += 1;
  }
  const need = costForLevel(level);
  return { level, intoLevel: remaining, need, pct: Math.round((remaining / need) * 100) };
}

// Apply a finished game to the profile. Returns a reward summary for the UI.
export function applyResult(profile, { mode, won }) {
  const before = levelInfo(profile.xp).level;

  const xpGain = won ? Math.round(mode.xpBase * 2) : Math.round(mode.xpBase * 0.6);
  const coinGain = won ? mode.coinBase * 2 : Math.round(mode.coinBase * 0.6);

  profile.xp += xpGain;
  profile.coins += coinGain;
  profile.stats.played += 1;
  if (won) profile.stats.wins += 1;
  else profile.stats.losses += 1;

  const after = levelInfo(profile.xp).level;
  // Level-up coin bonus.
  const levelsGained = Math.max(0, after - before);
  const levelBonus = levelsGained * 50;
  profile.coins += levelBonus;

  return {
    xpGain,
    coinGain: coinGain + levelBonus,
    leveledUp: after > before,
    newLevel: after,
    levelsGained,
  };
}

export function buyItem(profile, id) {
  const item = getItem(id);
  if (!item) return { ok: false, reason: 'missing' };
  if (profile.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (profile.coins < item.price) return { ok: false, reason: 'funds' };
  profile.coins -= item.price;
  profile.owned.push(id);
  return { ok: true };
}

export function equipItem(profile, id) {
  const item = getItem(id);
  if (!item || !profile.owned.includes(id)) return false;
  profile.equipped[item.type] = id;
  return true;
}
