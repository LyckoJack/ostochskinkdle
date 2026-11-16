// Datum (Europe/Stockholm) och deterministiskt val av dagens rätt.

export const TIME_ZONE = 'Europe/Stockholm';
export const START_DATE = '2026-11-16'; // Pussel #1
const SEED = 0x05c0ffee;
const DAY_MS = 86_400_000;

const dateFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat('sv-SE', {
  timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

/** "YYYY-MM-DD" i svensk tid. */
export function stockholmDateKey(now = new Date()) {
  return dateFmt.format(now); // sv-SE ger ISO-format
}

function dateKeyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Dagar sedan START_DATE (0 = första pusslet). Kan vara negativt. */
export function dayIndexFor(dateKey) {
  return Math.round((dateKeyToUTC(dateKey) - dateKeyToUTC(START_DATE)) / DAY_MS);
}

export function dateKeyForIndex(index) {
  return new Date(dateKeyToUTC(START_DATE) + index * DAY_MS).toISOString().slice(0, 10);
}

/** Sekunder kvar till midnatt svensk tid. */
export function secondsToMidnight(now = new Date()) {
  const [h, m, s] = timeFmt.format(now).split(':').map(Number);
  return Math.max(0, 86_400 - (h * 3600 + m * 60 + s));
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(items, seed) {
  const arr = [...items];
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Dagens rätt. Rätterna sorteras på id (så ordningen i JSON inte spelar roll)
 * och blandas med en fast seed. Varje "varv" genom listan får en ny blandning.
 */
export function dishForDay(dishes, dayIndex) {
  const n = dishes.length;
  const sorted = [...dishes].sort((a, b) => (a.id < b.id ? -1 : 1));
  const cycle = Math.floor(dayIndex / n);
  const pos = ((dayIndex % n) + n) % n;
  return shuffled(sorted, SEED + cycle * 7919)[pos];
}
