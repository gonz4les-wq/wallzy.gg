// App shell: tab navigation + module init + service worker registration.
import { initTodo } from './todo.js';
import { initCalendar } from './calendar.js';
import { initShopping } from './shopping.js';
import { load, save } from './store.js';

const TABS = ['todo', 'calendar', 'shopping'];
const LAST = 'daily.lastTab';

function showTab(name) {
  if (!TABS.includes(name)) name = 'todo';
  for (const t of TABS) {
    document.getElementById(`view-${t}`).classList.toggle('hidden', t !== name);
  }
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.setAttribute('aria-selected', String(btn.dataset.tab === name));
  });
  save(LAST, name);
}

function initTabs() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  showTab(load(LAST, 'todo'));
}

initTodo();
initCalendar();
initShopping();
initTabs();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
