// To-Do tab: a typical todo list — add, complete, delete. Persisted locally.
import { load, save, uid } from './store.js';

const KEY = 'daily.todos';
const CHECK_SVG = '<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>';

let todos = load(KEY, []);

const listEl = document.getElementById('todo-list');
const inputEl = document.getElementById('todo-input');
const addEl = document.getElementById('todo-add');
const emptyEl = document.getElementById('todo-empty');
const summaryEl = document.getElementById('todo-summary');

function persist() {
  save(KEY, todos);
}

function add() {
  const text = inputEl.value.trim();
  if (!text) return;
  todos.unshift({ id: uid(), text, done: false });
  inputEl.value = '';
  persist();
  render();
  inputEl.focus();
}

function toggle(id) {
  const t = todos.find((x) => x.id === id);
  if (!t) return;
  t.done = !t.done;
  // Move completed items to the bottom, keep others' order.
  todos.sort((a, b) => Number(a.done) - Number(b.done));
  persist();
  render();
}

function remove(id) {
  todos = todos.filter((x) => x.id !== id);
  persist();
  render();
}

function render() {
  listEl.innerHTML = '';
  const open = todos.filter((t) => !t.done).length;
  summaryEl.textContent = todos.length
    ? `${open} open · ${todos.length - open} done`
    : '';
  emptyEl.classList.toggle('hidden', todos.length > 0);

  for (const t of todos) {
    const li = document.createElement('li');
    li.className = 'item' + (t.done ? ' done' : '');

    const check = document.createElement('button');
    check.className = 'check' + (t.done ? ' on' : '');
    check.setAttribute('aria-label', t.done ? 'Mark as not done' : 'Mark as done');
    check.innerHTML = CHECK_SVG;
    check.addEventListener('click', () => toggle(t.id));

    const span = document.createElement('span');
    span.className = 'item-text';
    span.textContent = t.text;

    const del = document.createElement('button');
    del.className = 'del-btn';
    del.setAttribute('aria-label', 'Delete task');
    del.textContent = '🗑';
    del.addEventListener('click', () => remove(t.id));

    li.append(check, span, del);
    listEl.appendChild(li);
  }
}

export function initTodo() {
  addEl.addEventListener('click', add);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') add();
  });
  render();
}
