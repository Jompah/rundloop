# Ruttmotorn — arkitektur och designfilosofi

Överlämningsdokument skrivet 2026-07-03 (session med Claude Fable 5, se `~/claude-vault/public/projects/drift.md` för sessionshistorik). Målgrupp: nästa Claude-session som ska jobba på motorn.

## Vad användaren vill ha

Johannes formulering: *"ett förslag på en löprunda var än du är, som tar dig runt sevärdheter eller nära vatten/strand — snabbt, men rutten måste vara bra."* Konkret riktmärke: 10 km hemifrån (Kungsholmen) ska ge **Kungsholmen runt**; ett annat bra svar är **runt Riddarfjärden** (vattnet mellan Kungsholmen och Södermalm, över broarna).

## Så är det smart att tänka (designfilosofin)

1. **Löpare tänker i namngivna former, inte i distanser.** En bra runda är en igenkännbar form: runt en ö, runt ett vatten, längs en kaj och tillbaka, genom en parkkedja. Motorn ska ENUMERERA sådana former ur riktig OSM-geometri — inte syntetisera fria kurvor och hoppas. Varje ny "formfamilj" (ring, korridor, …) är en egen deterministisk kandidat-typ.

2. **Fråga aldrig en LLM om geografi — verifiera mot riktig geometri.** LLM:en känner inte staden; Overpass/OSM gör det. AI-kandidaten finns kvar som kreativ fallback, men den grundas med verifierad data (waterfront-ankare, ö-kontext, landmärken) och dess output mäts som alla andras. Detta var Rimini-lärdomen (2026-06-12) och Kungsholmen-lärdomen (2026-07-02) — samma princip båda gångerna.

3. **Generera → routa → mät → gata → poängsätt.** Lita aldrig på predikterad distans. Varje kandidat routas skarpt (Google Routes WALK primärt, OSRM som fallback — OBS publika OSRM-demon routar på bilnätet och ger grovt fel distans för fotgängare), mäts, distans-gatas (±15 %) och poängsätts: `score = quality×0,4 + scenic×100×0,6 − overlap×45 − distansmiss×20`. Overlap = `computeOverlapRatio` i `src/lib/route-quality.ts`: 25 m-grid, riktningsagnostisk andel dubbeltraverserad längd — en out-and-back får overlap ≈ 1 och straffas därefter. Inom-gate-score floorar på 0, eftersom score ≥ 0 är sentineln för "inom gate". Konsekvens: corridor (ren out-and-back) är numera en ärligt straffad sista utväg, inte en kandidat som belönas för dubbelspring.

4. **Scenic mäts, påstås inte.** `scenicScore` = andel av ruttens samplade punkter inom 120 m från verifierad vatten-/parkgeometri. En kandidat kan inte prata sig till att vara vacker.

5. **Snabbhet = klipp bort LLM:en ur happy path, inte snabbare LLM.** Perimeter-kandidaten byggs FÖRE AI-försöken; är den inom gaten och scenic ≥ 0,5 vinner den direkt och inget LLM-anrop görs (~3–5 s totalt). Prefetch värmer ring-cachen medan användaren fortfarande tittar på skärmen. Ordningen är medveten: billigast/säkrast först, dyrast/osäkrast sist.

6. **Externa beroenden ÄR flaky — designa för det.** Overpass: 8 s timeout + spegel-failover (`src/lib/overpass-client.ts`: overpass-api.de 6 s → maps.mail.ru 8 s) + retry-medveten prefetch + 1 h serverside-cache. Berikande data (POIs, landmärken, scenic) får ALDRIG blockera själva rutten — timeouts på 3,5 s klientside och graceful degradation överallt.

## Kandidatkedjan (dagens fem typer, i byggordning)

| # | Typ | Bygger på | Kostnad | När den vinner |
|---|-----|-----------|---------|----------------|
| 1 | `perimeter` | OSM-ring (ö/vatten) nära start med omkrets ≈ måldistans | 1 routing-anrop, ingen LLM | Ring finns + inom gate + scenic ≥ 0,5 → early-accept, resten hoppas över |
| 2 | `bridgeloop` | Två vattenkorsande broar över samma vatten + stränderna emellan → loop | ≤2 routing-anrop (topp 2 parallellt), ingen LLM | ≥2 broar finns, ingen perimeter-early-accept; early-accept = withinTolerance + scenic ≥ 0,5 + overlap ≤ 0,3 |
| 3 | `ai` | LLM-waypoints grundade med verifierad waterfront/ö/POI-kontext | LLM + routing, 2 försök | Ingen bra ring/bro-loop; kreativa rundor i städer |
| 4 | `algorithmic` | Cirkel med binary search på radie | Routing ×3 iter | AI avstängd/felar; landsbygd |
| 5 | `corridor` | Out-and-back längs närmaste vattenstråk | 1 routing-anrop | Byggs bara om bästa hittills har scenic < 0,5 — och straffas hårt av overlap-termen (sista utväg) |

**Bridgeloop-detaljer:** byggs när `island-outline` returnerar ≥ 2 vattenkorsande broar och perimetern inte redan early-acceptat. `buildBridgeLoopPlans` (`src/lib/perimeter.ts`) väljer bropar på predikterad looplängd: `[d(start→A.near) + A.längd + d(A.far→B.far) + B.längd + d(B.near→start)] × 1,2`, gate 0,75–1,25×mål, dedupe av par vars ändar ligger < 300 m från ett redan valt par. De topp 2 planerna routas parallellt och konkurrerar sedan på score som alla andra.

Alla kandidater loggas i konsolen: `[Candidate] source=… km=… quality=… scenic=… overlap=… score=…` samt `[RouteGen] Winner` — detta är fältdebug-verktyget.

**AI-prompten** föreskriver numera loop-först vid vattenfront: när verifierad waterfront finns ska LLM:en föreslå en slinga (via broar/parallellgator), och out-and-back är uttryckligen sista utväg — inte default.

## Nyckelfiler

- `src/app/page.tsx` — orkestreringen (handleGenerate): parallella fetches → kandidater → gate/score → vinnare
- `src/app/api/island-outline/route.ts` — ring-detektorn: öar + namngivna vatten, ways + relationer (outer-stitching), bbox ±(targetKm×0,35) km, klippta jättar kastas, 30 m offset mot land, max 3 ringar. Returnerar nu även `bridges` (`BridgeCrossing`): en bro räknas som vattenkorsande om dess way har ≥ 2 segmentskärningar mot strandlinje-runs — klippt vattengeometri splitAtNulls:as och används som korridorvatten. `foot=yes` överstyr highway-klassen (motorled med gångbana räknas), `bridge:name` föredras framför `name`, kluster-dedupe 50 m, minlängd 30 m.
- `src/lib/ring-assembly.ts` — stitching/perimeter/offset/downsample/touchesBbox (21 tester)
- `src/lib/perimeter.ts` — pickBestRing (predicted = omkrets×1,05 + 2×anslutning, gate 0,8–1,2×mål) + buildPerimeterWaypoints (14 intermediates, Google-gräns 25) + buildBridgeLoopPlans (bropar → loopplaner, se kandidatkedjan)
- `src/lib/route-quality.ts` — quality + computeOverlapRatio (25 m-grid, riktningsagnostisk dubbeltraverserings-andel)
- `src/lib/scenic.ts` — scenicScore/findScenicAnchor/buildCorridorWaypoints
- `src/lib/overpass-client.ts` — failover-hjälparen (alla tre Overpass-routes delar den)
- `src/components/RouteGenerator.tsx` — debounced prefetch av ringar (dedupe-nyckel = serverns cache-nyckel; 1 retry efter 12 s vid Overpass-fel)

## OSM/Overpass-fällor (dyrköpta lärdomar)

- Overpass kräver User-Agent — 406 annars, tyst.
- `out geom(bbox)` ger **null-vertices** för klippta punkter — filtrera innan stitching.
- Stora öar kan vara closed ways (Kungsholmen = way 5004124, place=island) ELLER relationer — stöd båda. Vattenkroppar (Riddarfjärden = natural=water-relation) stitchas från outer-medlemmar; en relation kan ge flera ringar, ta största.
- Jättar (Mälaren) exploderar payloaden — bbox-klipp och kasta ringar som rör kanten.
- overpass-api.de timeoutar kallt ungefär vartannat anrop (fältmätt 2026-07-02) — därav failovern. kumi.systems och private.coffee var själva nere vid utvärdering; maps.mail.ru (VK) svarade på 0,9 s.
- Serverless-cachen (in-memory Map) är per instans och försvinner vid cold start — prefetchen är det som gör featuren pålitlig i praktiken.
- **Havsvikar är INTE natural=water-polygoner.** Havet definieras av kustlinje-ways (natural=coastline), inte av slutna vattenpolygoner — en havsvik (t.ex. Pleasure Bay vid Castle Island, Boston) har alltså ingen ring att hitta, och broar över den får inget korridorvatten att skära mot. Konsekvens: kustloopar kan inte hittas som ringar idag — känd lucka (kräver kustlinje-baserad pseudo-ring).

## Nästa formfamiljer (om motorn ska bli bättre)

1. ~~**Brorundor**~~ — BYGGD 2026-07-03 som `bridgeloop`-kandidaten (se kandidatkedjan). Kvarvarande specialfall: havsvikar/kustloopar (se OSM-fällorna) kräver kustlinje-baserad pseudo-ring.
2. **Parkkedjor:** sekvens av parker inom korridor → waypoints genom dem (data finns redan i scenic-svaret, type=park).
3. **Esplanad/kaj out-and-back med variation:** corridor-kandidaten men med olika vändpunkter som egna kandidater.
4. **Lärd ranking:** timesRun/avgAdherence per sparad rutt finns redan i datamodellen — låt historiken vikta scoringen.
5. **Ring-bibliotek:** förberäkna kända ringar för Stockholm (öar, vatten) i en statisk fil → noll Overpass-beroende för 90 % av användningen.
6. **Self-hostad OSRM med foot-profil** — lyfter fallback-kvaliteten (demon routar bilvägar).

## Öppna punkter (medvetet olösta)

- Öppen proxy: google/mapbox-routes saknar origin-check/rate-limit (kostnadsrisk om appen sprids).
- Död koppling: RouteGenerator anropar aldrig `onDistanceChange` → `selectedDistance` i page.tsx står alltid på 5 → findNearbySavedRoutes söker alltid 5 km.
- Crash-recovery-snapshots roteras inte (IndexedDB-quota på långa rundor).
- SW: hårdkodad cache-version (drift-v8?) + skipWaiting.
- Haversine duplicerad ~5 ställen; 36 it.todo-tester för IndexedDB/crash-recovery oskrivna; sync-fel sväljs tyst.

## Fältfacit (uppmätta resultat mot prod)

| Plats | Fråga | Resultat |
|-------|-------|----------|
| Boston Esplanade | 8 km | Bro-loop 6,98 km, overlap 0,03 (var out-and-back före bridgeloop) |
| Jamaica Pond, Boston | 3 km | 3,08 km (perimeter) |
| Fresh Pond, Cambridge | 4 km | 4,47 km (perimeter) |
| Tantolunden, Stockholm | 9 km | Riddarfjärden-perimeter |
| Kungsholmen, Stockholm | 10 km | 9,50 km Kungsholmen runt (perimeter) |
| Castle Island, Boston | — | Ingen ring hittas — havsvik utan water-polygon, känd lucka |

## Verifieringsrutin (gör alltid detta efter motor-ändringar)

```bash
npx tsc --noEmit && npx vitest run
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy npx next build
# Fälttest mot prod (ingen lokal env behövs för ring-detektorn):
curl -s "https://rundloop.vercel.app/api/island-outline?lat=59.330&lng=18.020&targetKm=10"
# → förvänta rings: Kungsholmen (island, 9.95 km) + Riddarfjärden (water, 6.96 km).
# Full kedja: sampla 14 waypoints ur ringen, POSTa till /api/google/routes (travelMode WALK),
# förvänta ~9,5 km för 10 km-frågan. Kalla anrop kan behöva 1 retry (failovern tar det mesta).
```

Deploy = push till main (Vercel auto). Ingen `.env.local` finns lokalt — nycklarna ligger bara i Vercel.
