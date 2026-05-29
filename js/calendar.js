// Calendar tab: a day journal that begins on 30 May 2026.
// Each day from the start date up to today can hold a note you write and
// look back on later. Days before the start, and days that haven't arrived
// yet, are locked.
import { load, save } from './store.js';

const KEY = 'daily.dayNotes';
const START = new Date(2026, 4, 30); // 30 May 2026 (month is 0-based)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

let notes = load(KEY, {}); // { 'YYYY-MM-DD': 'text' }
let view = startOfMonth(new Date()); // currently displayed month
let openDate = null; // ISO key currently in the editor

const gridEl = document.getElementById('cal-grid');
const titleEl = document.getElementById('cal-title');
const sheetEl = document.getElementById('day-sheet');
const sheetDateEl = document.getElementById('day-sheet-date');
const sheetSubEl = document.getElementById('day-sheet-sub');
const noteEl = document.getElementById('day-note');
const saveBtn = document.getElementById('day-save');
const savedHint = document.getElementById('day-saved');

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function atMidnight(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function key(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function sameDay(a, b) { return key(a) === key(b); }
function prettyDate(d) {
  return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function status(d) {
  const day = atMidnight(d);
  const today = atMidnight(new Date());
  if (day > today) return 'future'; // hasn't arrived
  if (day < atMidnight(START) && !sameDay(day, today)) return 'before'; // before journal start
  return 'open';
}

function render() {
  titleEl.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
  gridEl.innerHTML = '';

  // Monday-first offset.
  const firstWeekday = (new Date(view.getFullYear(), view.getMonth(), 1).getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const today = new Date();

  for (let i = 0; i < firstWeekday; i++) {
    const blank = document.createElement('div');
    blank.className = 'cell blank';
    gridEl.appendChild(blank);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(view.getFullYear(), view.getMonth(), d);
    const cell = document.createElement('button');
    cell.className = 'cell';
    cell.textContent = String(d);

    const st = status(date);
    if (st !== 'open') {
      cell.classList.add('locked');
      cell.setAttribute('aria-disabled', 'true');
    } else {
      if (notes[key(date)]?.trim()) cell.classList.add('has-note');
      cell.addEventListener('click', () => openDay(date));
    }
    if (sameDay(date, today)) cell.classList.add('today');

    gridEl.appendChild(cell);
  }
}

function openDay(date) {
  openDate = key(date);
  const today = new Date();
  sheetDateEl.textContent = prettyDate(date);
  sheetSubEl.textContent = sameDay(date, today) ? 'Today' : 'Looking back';
  noteEl.value = notes[openDate] || '';
  noteEl.disabled = false;
  savedHint.textContent = '';
  sheetEl.classList.remove('hidden');
  setTimeout(() => noteEl.focus(), 150);
}

function closeSheet() {
  sheetEl.classList.add('hidden');
  openDate = null;
}

function saveNote() {
  if (!openDate) return;
  const text = noteEl.value.trim();
  if (text) notes[openDate] = text;
  else delete notes[openDate];
  save(KEY, notes);
  savedHint.textContent = 'Saved ✓';
  render();
  setTimeout(closeSheet, 450);
}

export function initCalendar() {
  document.getElementById('cal-prev').addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    render();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    render();
  });
  document.getElementById('cal-today').addEventListener('click', () => {
    view = startOfMonth(new Date());
    render();
  });
  saveBtn.addEventListener('click', saveNote);
  sheetEl.querySelectorAll('[data-close]').forEach((el) =>
    el.addEventListener('click', closeSheet),
  );
  render();
}
