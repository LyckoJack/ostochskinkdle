// Debug-läge (?debug=1): välj datum/rätt, visa och sätt fokuspunkt, nollställ lagring.
import { dateKeyForIndex, dayIndexFor } from './daily.js';

export function setupDebug({ game, els, startPuzzle, applyZoom, toast, ZOOM_LEVELS, clearStorage }) {
  const $ = (id) => document.getElementById(id);
  const panel = $('debug');
  const dateInput = $('dbg-date');
  const select = $('dbg-dish');
  const zoomBox = $('dbg-zoom');
  const markerToggle = $('dbg-marker');
  const info = $('dbg-info');
  const out = $('dbg-out');

  game.followToday = false;
  panel.hidden = false;
  document.body.classList.add('debugging');
  els.marker.hidden = !markerToggle.checked;

  [...game.dishes]
    .sort((a, b) => a.name.localeCompare(b.name, 'sv'))
    .forEach((d) => select.add(new Option(`${d.name}  (${d.id})`, d.id)));

  function updateInfo() {
    const d = game.dish;
    info.textContent = `Svar: ${d.name} · ${d.category} · ${d.image} · fokus ${d.focus.x}, ${d.focus.y}`;
    out.textContent = focusJson(d);
  }

  const focusJson = (d) => `"focus": { "x": ${d.focus.x}, "y": ${d.focus.y} }`;

  function load(day, dish = null) {
    startPuzzle(day, dish);
    dateInput.value = dateKeyForIndex(day);
    applyZoom({ animate: false });
    updateInfo();
  }

  // Zoomknappar: "Spel" följer spelets nivå, övriga tvingar en nivå.
  const levels = [null, ...ZOOM_LEVELS.map((_, i) => i)];
  const zoomButtons = levels.map((lvl) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost btn-sm';
    b.textContent = lvl == null ? 'Spel' : `${String(ZOOM_LEVELS[lvl]).replace('.', ',')}×`;
    b.setAttribute('aria-pressed', String(lvl == null));
    b.addEventListener('click', () => {
      game.debugZoom = lvl;
      zoomButtons.forEach((x, i) => x.setAttribute('aria-pressed', String(levels[i] === lvl)));
      applyZoom();
    });
    zoomBox.append(b);
    return b;
  });

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) return;
    select.value = '';
    load(dayIndexFor(dateInput.value));
  });

  select.addEventListener('change', () => {
    const dish = game.byId.get(select.value) || null;
    load(game.day, dish);
  });

  markerToggle.addEventListener('change', () => { els.marker.hidden = !markerToggle.checked; });

  // Klick på bilden sätter fokuspunkt. Bildens rect är transformerad, så
  // positionen relativt den ger koordinaten i själva bilden på alla zoomnivåer.
  els.frame.addEventListener('click', (e) => {
    const r = els.img.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    game.dish.focus = { x: clamp(x), y: clamp(y) };
    applyZoom();
    updateInfo();
    console.log(`[fokus] ${game.dish.id}: ${focusJson(game.dish)}`);
  });

  $('dbg-copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(out.textContent);
      toast('Fokus-JSON kopierad');
    } catch {
      toast('Kunde inte kopiera – se konsolen');
      console.log(out.textContent);
    }
  });

  $('dbg-reset').addEventListener('click', () => {
    clearStorage();
    toast('localStorage nollställt');
  });

  console.info('[ostochskinkdle] Debug-läge. Spel sparas inte och påverkar inte statistiken.');
  load(game.day);
}

const clamp = (v) => Math.min(100, Math.max(0, v));
