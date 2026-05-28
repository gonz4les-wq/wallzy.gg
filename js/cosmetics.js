// Cosmetic catalog + theming. Each item overrides a few CSS custom properties;
// applying the equipped set writes those properties onto :root so the whole UI
// reskins instantly. Default items are free and owned from the start.

const DEFAULTS = {
  '--bg': '#0f1226',
  '--bg-2': '#161a36',
  '--panel': '#1d2247',
  '--cell': '#2a3160',
  '--cell-edge': '#343c73',
  '--gutter': '#0b0e20',
  '--accent': '#5b8cff',
  '--human': '#00d4a0',
  '--human-light': '#5bffd0',
  '--wall': '#f4b740',
  '--wall-light': '#ffd472',
};

export const COSMETICS = [
  // Pawn skins (recolor your pawn)
  { id: 'pawn-default', type: 'pawn', name: 'Aqua', price: 0, vars: {} },
  { id: 'pawn-sunset', type: 'pawn', name: 'Sunset', price: 70, vars: { '--human': '#ff7a45', '--human-light': '#ffd36e' } },
  { id: 'pawn-violet', type: 'pawn', name: 'Violet', price: 80, vars: { '--human': '#8b5cf6', '--human-light': '#c4b5fd' } },
  { id: 'pawn-rose', type: 'pawn', name: 'Rose', price: 110, vars: { '--human': '#ff5d8f', '--human-light': '#ffb3c8' } },
  { id: 'pawn-gold', type: 'pawn', name: 'Gold', price: 160, vars: { '--human': '#f4b740', '--human-light': '#ffe08a' } },
  { id: 'pawn-cyber', type: 'pawn', name: 'Cyber', price: 220, vars: { '--human': '#00e5ff', '--human-light': '#b3ffff' } },

  // Board themes (whole-board palette)
  { id: 'board-default', type: 'board', name: 'Midnight', price: 0, vars: {} },
  {
    id: 'board-forest', type: 'board', name: 'Forest', price: 110,
    vars: { '--bg': '#0c1f17', '--bg-2': '#123026', '--panel': '#14392c', '--cell': '#1f5240', '--cell-edge': '#2c6b53', '--gutter': '#07140e', '--accent': '#34d399' },
  },
  {
    id: 'board-crimson', type: 'board', name: 'Crimson', price: 130,
    vars: { '--bg': '#1f0c12', '--bg-2': '#2e1119', '--panel': '#3a1622', '--cell': '#5a1f2e', '--cell-edge': '#73293b', '--gutter': '#14070a', '--accent': '#fb7185' },
  },
  {
    id: 'board-ocean', type: 'board', name: 'Ocean', price: 130,
    vars: { '--bg': '#06182a', '--bg-2': '#0a2540', '--panel': '#0e2f53', '--cell': '#134267', '--cell-edge': '#1c5a87', '--gutter': '#030f1c', '--accent': '#38bdf8' },
  },
  {
    id: 'board-grape', type: 'board', name: 'Grape', price: 150,
    vars: { '--bg': '#160c26', '--bg-2': '#221140', '--panel': '#2c1653', '--cell': '#3d1f67', '--cell-edge': '#502987', '--gutter': '#0c0718', '--accent': '#a78bfa' },
  },
  {
    id: 'board-mono', type: 'board', name: 'Mono', price: 180,
    vars: { '--bg': '#121316', '--bg-2': '#1b1d22', '--panel': '#24272e', '--cell': '#33373f', '--cell-edge': '#454a54', '--gutter': '#0a0b0d', '--accent': '#cbd5e1' },
  },

  // Wall styles (recolor your walls)
  { id: 'wall-default', type: 'wall', name: 'Amber', price: 0, vars: {} },
  { id: 'wall-ice', type: 'wall', name: 'Ice', price: 60, vars: { '--wall': '#38bdf8', '--wall-light': '#bae6fd' } },
  { id: 'wall-rose', type: 'wall', name: 'Rose', price: 80, vars: { '--wall': '#ec4899', '--wall-light': '#fbcfe8' } },
  { id: 'wall-magma', type: 'wall', name: 'Magma', price: 90, vars: { '--wall': '#ef4444', '--wall-light': '#fca5a5' } },
  { id: 'wall-violet', type: 'wall', name: 'Violet', price: 100, vars: { '--wall': '#8b5cf6', '--wall-light': '#ddd6fe' } },
  { id: 'wall-neon', type: 'wall', name: 'Neon', price: 120, vars: { '--wall': '#22c55e', '--wall-light': '#bbf7d0' } },
];

export const DEFAULT_EQUIPPED = {
  pawn: 'pawn-default',
  board: 'board-default',
  wall: 'wall-default',
};

export const DEFAULT_OWNED = ['pawn-default', 'board-default', 'wall-default'];

export function getItem(id) {
  return COSMETICS.find((c) => c.id === id) || null;
}

export function itemsByType(type) {
  return COSMETICS.filter((c) => c.type === type);
}

function mergedVars(equipped) {
  const vars = { ...DEFAULTS };
  for (const type of ['board', 'wall', 'pawn']) {
    const item = getItem(equipped[type]);
    if (item) Object.assign(vars, item.vars);
  }
  return vars;
}

// Write the equipped cosmetics onto :root.
export function applyEquipped(equipped) {
  const vars = mergedVars(equipped);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
}

// Apply a temporary preview: the equipped set with one item swapped in.
export function applyPreview(equipped, previewItem) {
  applyEquipped({ ...equipped, [previewItem.type]: previewItem.id });
}
