// Tolerant matchning av gissningar mot rätter + alias.

/**
 * Gör om text till en jämförelsenyckel:
 * - gemener, å/ä/ö → a/a/o (och övriga diakriter bort)
 * - "&", "+", fristående "o"/"and" → "och", sedan tas "och" bort helt
 * - mellanslag, bindestreck och annan interpunktion bort
 * "Ost- och skinkpaj", "ost & skinkpaj", "ostochskinkpaj", "Ost skinkpaj" → "ostskinkpaj"
 */
export function normalize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[&+]/g, ' och ')
    .replace(/\b(o|and|n)\b/g, ' och ')
    .replace(/[^a-z0-9]/g, '')
    .replace(/och/g, '');
}

/** Bygger ett sökindex: [{ dish, keys: [{ key, label, isAlias }] }] */
export function buildIndex(dishes) {
  const index = dishes.map((dish) => ({
    dish,
    keys: [
      { key: normalize(dish.name), label: dish.name, isAlias: false },
      ...(dish.aliases || []).map((a) => ({ key: normalize(a), label: a, isAlias: true })),
    ],
  }));
  // Varna om två rätter krockar på samma nyckel.
  const seen = new Map();
  for (const { dish, keys } of index) {
    for (const { key, label } of keys) {
      const other = seen.get(key);
      if (other && other !== dish.id) console.warn(`[ostochskinkdle] "${label}" (${dish.id}) krockar med ${other}`);
      seen.set(key, dish.id);
    }
  }
  return index;
}

/** Exakt (tolerant) träff → rätt, annars null. */
export function resolve(index, text) {
  const q = normalize(text);
  if (!q) return null;
  for (const entry of index) {
    if (entry.keys.some((k) => k.key === q)) return entry.dish;
  }
  return null;
}

/** Förslag för autocomplete. Returnerar [{ dish, via }] där via = alias som matchade (eller null). */
export function suggest(index, text, { exclude = new Set(), limit = 8 } = {}) {
  const q = normalize(text);
  if (!q) return [];
  const hits = [];
  for (const { dish, keys } of index) {
    if (exclude.has(dish.id)) continue;
    let best = null;
    for (const k of keys) {
      const pos = k.key.indexOf(q);
      if (pos === -1) continue;
      // Lägre poäng = bättre: början av ordet slår mitten, namn slår alias.
      const score = (pos === 0 ? 0 : 10) + (k.isAlias ? 1 : 0) + k.key.length / 1000;
      if (!best || score < best.score) best = { score, via: k.isAlias ? k.label : null };
    }
    if (best) hits.push({ dish, via: best.via, score: best.score });
  }
  hits.sort((a, b) => a.score - b.score || a.dish.name.localeCompare(b.dish.name, 'sv'));
  return hits.slice(0, limit);
}
