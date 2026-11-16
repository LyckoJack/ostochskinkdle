import { buildIndex, resolve } from './match.js';
import { stockholmDateKey, dayIndexFor, dateKeyForIndex, dishForDay, secondsToMidnight } from './daily.js';
import * as store from './storage.js';
import { createAutocomplete } from './autocomplete.js';

export const ZOOM_LEVELS = [8, 5, 3.5, 2.5, 1.6, 1];
const MAX = store.MAX_GUESSES;
const CATEGORY_AFTER = 3;
const HINT_AFTER = 5;
const DEBUG = new URLSearchParams(location.search).get('debug') === '1';

const $ = (id) => document.getElementById(id);
const els = {
  meta: $('puzzle-meta'),
  frame: $('frame'),
  img: $('dish-img'),
  marker: $('focus-marker'),
  badge: $('zoom-badge'),
  zoomStatus: $('zoom-status'),
  pips: $('pips'),
  hintCat: $('hint-category'),
  hintCatVal: $('hint-category-value'),
  hintOrigin: $('hint-origin'),
  hintOriginVal: $('hint-origin-value'),
  form: $('guess-form'),
  input: $('guess-input'),
  acList: $('ac-list'),
  skip: $('skip-btn'),
  msg: $('form-msg'),
  list: $('guess-list'),
  result: $('result'),
  resultKicker: $('result-kicker'),
  resultName: $('result-name'),
  resultFact: $('result-fact'),
  resultCredit: $('result-credit'),
  share: $('share-btn'),
  helpDlg: $('help-dialog'),
  statsDlg: $('stats-dialog'),
  dist: $('dist'),
  toast: $('toast'),
};

// Spelets tillstånd
const game = {
  dishes: [],
  index: [],
  byId: new Map(),
  day: 0,
  dish: null,
  state: null,
  persist: !DEBUG,      // debug-spel sparas inte och påverkar inte statistiken
  debugZoom: null,      // index i ZOOM_LEVELS som tvingas i debug-läget
  followToday: true,    // byt pussel automatiskt vid midnatt
};

// ---------- Hjälpare ----------

const dateLabelFmt = new Intl.DateTimeFormat('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

function wrongCount(state) {
  return state.guesses.filter((g) => g !== state.dishId).length;
}

function isOver(state) {
  return state.status !== 'playing';
}

function currentZoomIndex() {
  if (game.debugZoom != null) return game.debugZoom;
  if (isOver(game.state)) return ZOOM_LEVELS.length - 1;
  return Math.min(game.state.guesses.length, ZOOM_LEVELS.length - 1);
}

function formatZoom(z) {
  return `${String(z).replace('.', ',')}×`;
}

let toastTimer;
function toast(text, ms = 2200) {
  els.toast.textContent = text;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), ms);
}

function showMsg(text, shake = false) {
  els.msg.textContent = text;
  if (shake) {
    els.input.classList.remove('shake');
    void els.input.offsetWidth; // starta om animationen
    els.input.classList.add('shake');
  }
}

function openDialog(dlg) {
  if (dlg.open) return;
  try { dlg.showModal(); } catch { dlg.setAttribute('open', ''); }
}

// ---------- Rendering ----------

export function applyZoom({ animate = true } = {}) {
  const { dish } = game;
  const z = ZOOM_LEVELS[currentZoomIndex()];
  const img = els.img;
  if (!animate) img.style.transition = 'none';
  img.style.transformOrigin = `${dish.focus.x}% ${dish.focus.y}%`;
  img.style.transform = `scale(${z})`;
  if (!animate) {
    void img.offsetWidth;
    img.style.transition = '';
  }
  const label = formatZoom(z);
  if (els.badge.textContent !== label) {
    els.badge.textContent = label;
    els.badge.classList.remove('bump');
    void els.badge.offsetWidth;
    if (animate) els.badge.classList.add('bump');
  }
  els.zoomStatus.textContent = z === 1 ? 'Hela bilden visas.' : `Bilden är inzoomad ${String(z).replace('.', ',')} gånger.`;
  els.marker.style.left = `${dish.focus.x}%`;
  els.marker.style.top = `${dish.focus.y}%`;
}

function renderPips() {
  const { state } = game;
  els.pips.replaceChildren();
  for (let i = 0; i < MAX; i++) {
    const li = document.createElement('li');
    li.className = 'pip';
    const g = state.guesses[i];
    let label = `Försök ${i + 1}: `;
    if (i < state.guesses.length) {
      if (g === state.dishId) { li.classList.add('hit'); label += 'rätt'; }
      else if (g === null) { li.classList.add('skip'); label += 'överhoppat'; }
      else { li.classList.add('miss'); label += 'fel'; }
    } else if (i === state.guesses.length && !isOver(state)) {
      li.classList.add('current'); label += 'pågår';
    } else {
      label += 'kvar';
    }
    li.setAttribute('aria-label', label);
    els.pips.append(li);
  }
}

function renderHints() {
  const { state, dish } = game;
  const wrong = wrongCount(state);
  const over = isOver(state);
  const catOpen = over || wrong >= CATEGORY_AFTER;
  const hintOpen = over || wrong >= HINT_AFTER;
  els.hintCat.dataset.locked = String(!catOpen);
  els.hintCatVal.textContent = catOpen ? dish.category : `Låses upp efter ${CATEGORY_AFTER} försök`;
  els.hintOrigin.dataset.locked = String(!hintOpen);
  els.hintOriginVal.textContent = hintOpen ? dish.hint : `Låses upp efter ${HINT_AFTER} försök`;
}

function renderGuesses() {
  const { state } = game;
  els.list.replaceChildren();
  state.guesses.forEach((g, i) => {
    const li = document.createElement('li');
    li.className = 'guess-item';
    const mark = document.createElement('span');
    mark.className = 'mark';
    const text = document.createElement('span');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i + 1}/${MAX}`;
    if (g === state.dishId) {
      li.classList.add('correct');
      mark.textContent = '✅';
      mark.setAttribute('aria-label', 'Rätt');
      text.textContent = game.byId.get(g)?.name ?? g;
    } else if (g === null) {
      li.classList.add('skip');
      mark.textContent = '❌';
      mark.setAttribute('aria-label', 'Överhoppat');
      text.textContent = 'Hoppade över';
    } else {
      mark.textContent = '❌';
      mark.setAttribute('aria-label', 'Fel');
      text.textContent = game.byId.get(g)?.name ?? g;
    }
    li.append(mark, text, num);
    els.list.append(li);
  });
}

function renderResult() {
  const { state, dish } = game;
  const over = isOver(state);
  els.form.hidden = over;
  els.result.hidden = !over;
  els.frame.classList.toggle('won', state.status === 'won');
  els.frame.classList.toggle('lost', state.status === 'lost');
  els.img.alt = over ? `Hela bilden: ${dish.name}` : 'Inzoomad bild på dagens ost- och skinkrätt';
  if (!over) return;
  const won = state.status === 'won';
  els.result.classList.toggle('lost', !won);
  const n = state.guesses.length;
  els.resultKicker.textContent = won
    ? (n === 1 ? 'Första försöket! Ostgud.' : `Rätt på ${n} försök!`)
    : 'Slut på försök – det var';
  els.resultName.textContent = dish.name;
  els.resultFact.textContent = dish.fact;
  els.resultCredit.replaceChildren();
  if (dish.credit) {
    if (/^https:\/\//.test(dish.source || '')) {
      const a = document.createElement('a');
      a.href = dish.source;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = dish.credit;
      els.resultCredit.append(a);
    } else {
      els.resultCredit.append(dish.credit);
    }
  }
}

function render({ animate = true } = {}) {
  const { day } = game;
  const dateKey = dateKeyForIndex(day);
  const dateLabel = dateLabelFmt.format(new Date(`${dateKey}T12:00:00Z`));
  els.meta.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = `#${day + 1}`;
  els.meta.append(b, ` · ${dateLabel}`);
  applyZoom({ animate });
  renderPips();
  renderHints();
  renderGuesses();
  renderResult();
}

function renderStats() {
  const s = store.loadStats();
  $('st-played').textContent = s.played;
  $('st-winpct').textContent = s.played ? Math.round((s.wins / s.played) * 100) : 0;
  $('st-streak').textContent = store.displayStreak(s, dayIndexFor(stockholmDateKey()));
  $('st-max').textContent = s.maxStreak;
  const max = Math.max(1, ...s.dist);
  const todayWin = game.persist && game.state?.status === 'won' ? game.state.guesses.length : null;
  els.dist.replaceChildren();
  s.dist.forEach((count, i) => {
    const li = document.createElement('li');
    if (todayWin === i + 1) li.classList.add('today');
    li.setAttribute('aria-label', `${i + 1} försök: ${count} vinster`);
    const n = document.createElement('span');
    n.textContent = i + 1;
    n.setAttribute('aria-hidden', 'true');
    const bar = document.createElement('span');
    bar.className = 'bar';
    bar.textContent = count;
    bar.setAttribute('aria-hidden', 'true');
    bar.style.setProperty('--w', '0%');
    li.append(n, bar);
    els.dist.append(li);
    requestAnimationFrame(() => requestAnimationFrame(() => bar.style.setProperty('--w', `${(count / max) * 100}%`)));
  });
}

function openStats() {
  renderStats();
  openDialog(els.statsDlg);
}

// ---------- Spellogik ----------

export function startPuzzle(day, dishOverride = null) {
  game.day = day;
  game.dish = dishOverride || dishForDay(game.dishes, day);
  game.state = game.persist
    ? store.loadGame(day, game.dish.id)
    : { day, dishId: game.dish.id, guesses: [], status: 'playing' };
  els.input.value = '';
  showMsg('');
  els.img.classList.remove('loaded');
  els.img.onload = () => els.img.classList.add('loaded');
  els.img.onerror = () => showMsg('Bilden kunde inte laddas.');
  els.img.src = game.dish.image;
  render({ animate: false });
  return game.dish;
}

function makeGuess(dishId) {
  const { state } = game;
  if (isOver(state)) return;
  state.guesses.push(dishId);
  if (dishId === state.dishId) state.status = 'won';
  else if (state.guesses.length >= MAX) state.status = 'lost';
  if (game.persist) {
    store.saveGame(state);
    if (isOver(state)) store.recordResult(state.day, state.status === 'won', state.guesses.length);
  }
  render();
  if (isOver(state)) {
    els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    toast(state.status === 'won' ? 'Snyggt! 🧀' : 'Attans! 🥲');
    setTimeout(openStats, 1800);
  } else {
    els.input.focus();
  }
}

function onSubmit(e) {
  e.preventDefault();
  if (isOver(game.state)) return;
  const value = els.input.value.trim();
  if (!value) {
    showMsg('Skriv en rätt först.', true);
    return;
  }
  const dish = resolve(game.index, value);
  if (!dish) {
    showMsg('Välj en rätt från listan – inget försök förbrukat.', true);
    return;
  }
  if (game.state.guesses.includes(dish.id)) {
    showMsg('Den har du redan gissat.', true);
    return;
  }
  ac.close();
  els.input.value = '';
  showMsg('');
  makeGuess(dish.id);
}

function onSkip() {
  if (isOver(game.state)) return;
  ac.close();
  els.input.value = '';
  showMsg('');
  makeGuess(null);
}

function shareText() {
  const { state } = game;
  const score = state.status === 'won' ? state.guesses.length : 'X';
  const squares = Array.from({ length: MAX }, (_, i) => {
    if (i >= state.guesses.length) return '⬜';
    const g = state.guesses[i];
    if (g === state.dishId) return '🟩';
    return g === null ? '⬛' : '🟥';
  }).join('');
  return `🧀 Ostochskinkdle #${state.day + 1} ${score}/${MAX}\n${squares}\n${location.origin}${location.pathname}`;
}

async function onShare() {
  const text = shareText();
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    toast('Kopierat! Klistra in var du vill.');
  } catch (err) {
    if (err?.name === 'AbortError') return;
    toast('Kunde inte kopiera – markera texten manuellt.');
    console.log(text);
  }
}

// ---------- Nedräkning ----------

function tick() {
  const secs = secondsToMidnight();
  const hh = String(Math.floor(secs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  document.querySelectorAll('[data-countdown]').forEach((el) => { el.textContent = `${hh}:${mm}:${ss}`; });
  // Ny dag? Byt pussel (om vi följer dagens datum).
  const today = dayIndexFor(stockholmDateKey());
  if (game.followToday && today !== game.day) {
    startPuzzle(today);
    toast('Ny dag, ny rätt! 🧀');
  }
}

// ---------- Start ----------

let ac;

async function init() {
  try {
    const res = await fetch('data/dishes.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    game.dishes = await res.json();
  } catch (err) {
    console.error(err);
    els.meta.textContent = 'Kunde inte ladda rätterna. Starta sidan via en webbserver (se README).';
    return;
  }
  game.index = buildIndex(game.dishes);
  game.byId = new Map(game.dishes.map((d) => [d.id, d]));

  ac = createAutocomplete({
    input: els.input,
    list: els.acList,
    getIndex: () => game.index,
    getExcluded: () => new Set(game.state?.guesses.filter(Boolean) ?? []),
    onPick: () => showMsg(''),
  });

  els.form.addEventListener('submit', onSubmit);
  els.skip.addEventListener('click', onSkip);
  els.share.addEventListener('click', onShare);
  $('help-btn').addEventListener('click', () => openDialog(els.helpDlg));
  $('stats-btn').addEventListener('click', openStats);
  $('result-stats-btn').addEventListener('click', openStats);
  // Klick på bakgrunden stänger modalen
  for (const dlg of [els.helpDlg, els.statsDlg]) {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  }

  startPuzzle(dayIndexFor(stockholmDateKey()));
  tick();
  setInterval(tick, 1000);

  if (DEBUG) {
    const { setupDebug } = await import('./debug.js');
    setupDebug({ game, els, startPuzzle, applyZoom, toast, ZOOM_LEVELS, clearStorage: store.clearAll });
  } else if (!store.hasSeenHelp()) {
    openDialog(els.helpDlg);
    store.markHelpSeen();
  }
}

init();
