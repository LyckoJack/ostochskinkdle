// localStorage-wrapper. Allt i try/catch – spelet ska fungera även utan lagring.

const PREFIX = 'ostochskinkdle:';
export const MAX_GUESSES = 6;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch { /* privat läge, full lagring o.s.v. */ }
}

export function clearAll() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
  } catch { /* ignorera */ }
}

// ---- Dagens spel ----
// { day: number, dishId: string, guesses: (string|null)[], status: 'playing'|'won'|'lost' }

export function loadGame(day, dishId) {
  const s = read('game', null);
  if (s && s.day === day && s.dishId === dishId && Array.isArray(s.guesses)) return s;
  return { day, dishId, guesses: [], status: 'playing' };
}

export function saveGame(state) {
  write('game', state);
}

// ---- Statistik ----

const EMPTY_STATS = {
  played: 0, wins: 0, currentStreak: 0, maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0], lastPlayedDay: null, lastWonDay: null,
};

export function loadStats() {
  const s = read('stats', null);
  return s ? { ...EMPTY_STATS, ...s, dist: s.dist?.length === 6 ? s.dist : [...EMPTY_STATS.dist] } : structuredClone(EMPTY_STATS);
}

/** Registrerar ett avslutat spel. Idempotent per dag. */
export function recordResult(day, won, attempts) {
  const s = loadStats();
  if (s.lastPlayedDay === day) return s;
  s.played += 1;
  s.lastPlayedDay = day;
  if (won) {
    s.wins += 1;
    s.dist[attempts - 1] += 1;
    s.currentStreak = s.lastWonDay === day - 1 ? s.currentStreak + 1 : 1;
    s.lastWonDay = day;
    s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  } else {
    s.currentStreak = 0;
  }
  write('stats', s);
  return s;
}

/** Streaken som ska visas: bruten om man missat gårdagen. */
export function displayStreak(stats, today) {
  if (stats.lastWonDay === today || stats.lastWonDay === today - 1) return stats.currentStreak;
  return 0;
}

export function hasSeenHelp() {
  return read('seenHelp', false);
}

export function markHelpSeen() {
  write('seenHelp', true);
}
