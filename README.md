# Ostochskinkdle 🧀🥓

Ett dagligt gissningsspel: vilken ost- och skinkrätt föreställer bilden?
Bilden börjar kraftigt inzoomad och zoomar ut för varje fel gissning. Sex försök, samma rätt för alla.

Vanilla HTML/CSS/JS (ES modules). Inget ramverk, inget byggsteg.

## Kör lokalt

```bash
cd ostochskinkdle
python3 -m http.server 8000
```

Öppna sedan <http://localhost:8000>. (På Windows heter Python ofta `py` i stället för `python3`.)
Sidan måste köras via en server. `file://` fungerar inte, eftersom `dishes.json` hämtas med `fetch`.

## Deploy till GitHub Pages

1. Pusha mappens innehåll till ett GitHub-repo (`index.html` ska ligga i roten).
2. **Settings → Pages → Build and deployment → Source: Deploy from a branch**, välj `main` och `/ (root)`.
3. Klart. Sidan hamnar på `https://<användare>.github.io/<repo>/`.

Alla sökvägar är relativa, så det fungerar även under en undersökväg. `.nojekyll` stänger av Jekyll.

## Struktur

```
index.html              Sidan
css/style.css           All styling
js/main.js              Spelflöde, rendering, delning, nedräkning
js/daily.js             Svensk tid, pusselnummer, val av dagens rätt
js/match.js             Tolerant matchning + förslag
js/autocomplete.js      Tillgänglig combobox (piltangenter/Enter/Esc)
js/storage.js           localStorage: dagens spel + statistik
js/debug.js             Debug-läge (laddas bara med ?debug=1)
data/dishes.json        Rätterna
images/                 Bilder med neutrala/hashade namn
tools/add_image.py      Lägg in en riktig bild för en rätt
tools/make_placeholders.py  Generera SVG-platshållare
```

## Lägga in bilder

Använd bara bilder du har rätt att använda: egna bilder, eller till exempel Wikimedia Commons med korrekt licens.

```bash
pip install Pillow
python3 tools/add_image.py ~/Bilder/paj.jpg ost-och-skinkpaj --credit "Egen bild" --remove-old
```

Scriptet beskär bilden till kvadrat, skalar ner till max 1200 px, sparar som WebP med hashat namn och uppdaterar `dishes.json`.
Flaggor: `--focus X Y`, `--no-crop`, `--quality 82` och `--remove-old` (raderar den gamla platshållaren).

### Sätta fokuspunkt

1. Öppna `http://localhost:8000/?debug=1`.
2. Välj rätten i listan och tvinga gärna zoom 8×.
3. Klicka på en detalj som är intressant men inte avslöjande. Koordinaterna visas, loggas i konsolen och kan kopieras.
4. Klistra in `"focus": { "x": …, "y": … }` i `dishes.json`.

Debug-läget sparar inga spel och påverkar inte statistiken. Där kan du också välja datum och nollställa localStorage.

## Rätterna (`data/dishes.json`)

| fält       | beskrivning |
|------------|-------------|
| `id`       | stabilt id, används i sparad progress |
| `name`     | visningsnamn |
| `aliases`  | alternativa namn som också räknas som rätt |
| `category` | visas efter 3 fel (Bakat, Smörgås, Pizza, Sås, Soppa …) |
| `hint`     | ursprung/servering, visas efter 5 fel |
| `fact`     | one-liner som visas efter spelet |
| `image`    | sökväg i `images/` |
| `focus`    | `{x, y}` i procent, mittpunkt för inzoomningen |
| `credit`   | fotograf/licens, visas efter spelet |

Matchningen ignorerar skiftläge, mellanslag, bindestreck, å/ä/ö och "och"/"&"/"o".
"Ost- och skinkpaj", "ost & skinkpaj" och "ostskinkpaj" räknas alltså som samma sak.
Om två namn krockar varnar konsolen.

**Dagens rätt:** rätterna sorteras på `id`, blandas med en fast seed och indexeras med antal dagar sedan `START_DATE`
(`js/daily.js`, svensk tid). Varje varv genom listan får en ny blandning.
⚠️ Om du lägger till eller tar bort rätter efter lansering ändras schemat. Gör det helst inte mitt under dagen.
