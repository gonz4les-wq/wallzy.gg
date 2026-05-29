// Tiny localStorage wrapper with JSON + a safe fallback if storage is blocked.
const memory = {};

export function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return structuredCloneSafe(fallback);
    return JSON.parse(raw);
  } catch {
    return key in memory ? memory[key] : structuredCloneSafe(fallback);
  }
}

export function save(key, value) {
  memory[key] = value;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — kept in memory for this session */
  }
}

function structuredCloneSafe(v) {
  return v == null ? v : JSON.parse(JSON.stringify(v));
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
