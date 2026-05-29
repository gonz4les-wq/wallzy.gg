// Shopping tab: multiple list profiles. Within a list, add items and toggle
// each one as "bought" on the right. Persisted locally.
import { load, save, uid } from './store.js';

const KEY = 'daily.shopping';
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';

function seed() {
  const id = uid();
  return { active: id, profiles: [{ id, name: 'Groceries', items: [] }] };
}

let data = load(KEY, null) || seed();
if (!data.profiles?.length) data = seed();

const chipsEl = document.getElementById('profile-chips');
const addProfileBtn = document.getElementById('profile-add');
const listEl = document.getElementById('shop-list');
const inputEl = document.getElementById('shop-input');
const addEl = document.getElementById('shop-add');
const emptyEl = document.getElementById('shop-empty');
const summaryEl = document.getElementById('shop-summary');

function persist() { save(KEY, data); }
function activeProfile() {
  return data.profiles.find((p) => p.id === data.active) || data.profiles[0];
}

function addProfile() {
  const name = (prompt('Name this list (e.g. Groceries, Hardware store, Party):') || '').trim();
  if (!name) return;
  const id = uid();
  data.profiles.push({ id, name, items: [] });
  data.active = id;
  persist();
  render();
}

function deleteProfile(id) {
  if (data.profiles.length <= 1) {
    alert('Keep at least one list.');
    return;
  }
  const p = data.profiles.find((x) => x.id === id);
  if (!confirm(`Delete the list "${p.name}" and its items?`)) return;
  data.profiles = data.profiles.filter((x) => x.id !== id);
  if (data.active === id) data.active = data.profiles[0].id;
  persist();
  render();
}

function addItem() {
  const text = inputEl.value.trim();
  if (!text) return;
  activeProfile().items.unshift({ id: uid(), text, bought: false });
  inputEl.value = '';
  persist();
  render();
  inputEl.focus();
}

function toggleItem(itemId) {
  const items = activeProfile().items;
  const it = items.find((x) => x.id === itemId);
  if (!it) return;
  it.bought = !it.bought;
  items.sort((a, b) => Number(a.bought) - Number(b.bought));
  persist();
  render();
}

function removeItem(itemId) {
  const p = activeProfile();
  p.items = p.items.filter((x) => x.id !== itemId);
  persist();
  render();
}

function renderChips() {
  chipsEl.innerHTML = '';
  for (const p of data.profiles) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (p.id === data.active ? ' active' : '');
    chip.textContent = p.name;
    chip.addEventListener('click', () => {
      if (data.active === p.id) {
        deleteProfile(p.id); // tap the active list again to manage/delete
      } else {
        data.active = p.id;
        persist();
        render();
      }
    });
    chipsEl.appendChild(chip);
  }
}

function render() {
  renderChips();
  const p = activeProfile();
  listEl.innerHTML = '';

  const bought = p.items.filter((i) => i.bought).length;
  summaryEl.textContent = p.items.length
    ? `${p.name} · ${p.items.length - bought} to buy · ${bought} bought`
    : `${p.name} · tap the active list again to rename or delete`;
  emptyEl.classList.toggle('hidden', p.items.length > 0);

  for (const it of p.items) {
    const li = document.createElement('li');
    li.className = 'item' + (it.bought ? ' bought' : '');

    const check = document.createElement('button');
    check.className = 'check' + (it.bought ? ' on' : '');
    check.setAttribute('aria-label', 'Toggle bought');
    check.innerHTML = CHECK_SVG;
    check.addEventListener('click', () => toggleItem(it.id));

    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = it.text;

    const toggle = document.createElement('button');
    toggle.className = 'bought-toggle' + (it.bought ? ' bought' : '');
    toggle.textContent = it.bought ? 'Bought' : 'To buy';
    toggle.addEventListener('click', () => toggleItem(it.id));

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.setAttribute('aria-label', 'Remove item');
    del.textContent = '🗑';
    del.addEventListener('click', () => removeItem(it.id));

    li.append(check, span, toggle, del);
    listEl.appendChild(li);
  }
}

export function initShopping() {
  addEl.addEventListener('click', addItem);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addItem();
  });
  addProfileBtn.addEventListener('click', addProfile);
  render();
}
