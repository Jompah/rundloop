import { RouteWaypoint, AppSettings, ScenicMode } from '@/types';

export interface NaturePOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

export interface IslandData {
  name: string;
  perimeterKm: number;
  outline: { lat: number; lng: number }[];
}

interface AIRouteRequest {
  lat: number;
  lng: number;
  distanceKm: number;
  cityName: string;
  settings: AppSettings;
  scenicMode?: ScenicMode;
  poiWaypoints?: NaturePOI[];
  island?: IslandData | null;
}

// Shared rules applied to ALL scenic modes — anti-detour, waypoint placement, and loop quality
const SHARED_ROUTE_RULES = `- MINIMIZE BACKTRACKING: Prefer routes that don't repeat the same street. However, out-and-back along a scenic path (e.g., a beach promenade or waterfront) is acceptable when it's the best option.
- ABSOLUTELY NO DETOURS: NEVER create dead-end detours. Every waypoint must be on the THROUGH-route. The runner moves FORWARD continuously. If a waypoint forces the runner down a side street and back, it is FORBIDDEN.
- ROUTE SHAPE BY DISTANCE: For short runs (under 7km): if near a loopable waterfront or on an island, follow the waterfront for roughly half the distance then take a direct path back through parks or quiet streets. Otherwise create a compact loop. Never create lollipop or out-and-back shapes in standard mode when a half-loop is possible. For longer runs (7km+), create a proper full loop.
- COMPACTNESS: Keep the route compact. For a 5km run, all waypoints should be within ~1.5km of start. For 10km, within ~3km. Exception: on islands where the perimeter matches the target distance, waypoints will naturally spread further. Do NOT spread waypoints across a wide area — this creates overly long routes when the road router connects them.
- FEW WAYPOINTS, LONG STRETCHES: Place waypoints only at major turns. Runners follow continuous paths for long stretches — aim for roughly 1-2 direction changes per km. Let the route follow one path for 500m+ between turns.
- STARTING POINT FLEXIBILITY: The first waypoint can be up to 100 meters from the given start coordinates to reach a better path (e.g., nearest waterfront promenade or park entrance). The runner will walk to the route start.
- GEOGRAPHIC FEATURE ASSESSMENT: If the start is near a geographic feature (island, lake, peninsula, river, large park), assess whether its perimeter is actually runnable. Only commit to a perimeter route when the feature is runnable AND the requested distance is within ~30% of the perimeter length.
- WATERFRONT PREFERENCE: When waterfront paths, coastal trails, or lakeside promenades exist near the start, incorporate them. Runners strongly prefer water views over city blocks.
- STRONGLY prefer CONTINUOUS running paths (waterfront promenades, park trails, canal paths, ring roads) over city blocks. A good running route follows established paths for long stretches — runners hate zig-zagging through residential streets. If a waterfront promenade or park trail exists, USE IT for as long as possible before turning.
- It is MUCH better to be 5-10% shorter than the target distance than to add detours to hit exact distance. Never exceed the target by more than 10%.
- Round all coordinates to 4 decimal places.`;

const SCENIC_INSTRUCTIONS: Record<ScenicMode, string> = {
  standard: `${SHARED_ROUTE_RULES}
- ROUTE STRATEGY: Create a balanced loop mixing waterfront, parks, and interesting streets. Use geographic features (shorelines, rivers, park edges) when nearby and runnable, but also route past notable landmarks and through pleasant neighborhoods.
- When a natural loop exists near the start (park circuit, waterfront path, river bend) and roughly matches the distance, prefer it over a contrived city-block loop.
- Include notable landmarks and popular sights that fall naturally along the route — never as side trips.
- Prefer parks, waterfront paths, pedestrian areas, and quiet streets over busy roads.
- Avoid highways, industrial areas, and roads without sidewalks.
- Keep waypoints close to the start — a compact, enjoyable route beats a spread-out one.`,
  explore: `${SHARED_ROUTE_RULES}
- START FLEXIBILITY: In explore mode, the first waypoint can be up to 500 meters from the given start to reach a more interesting starting landmark.
- ROUTE STRATEGY: Create a sightseeing loop passing the top 3-5 most iconic landmarks and attractions near the start. Geographic features (waterfronts, bridges, viewpoints) are valuable when they connect landmarks, not as goals in themselves.
- Connect landmarks in a logical geographic loop — not a zigzag. The route should feel like a guided city tour at running pace.
- TERRAIN ASSESSMENT: Use waterfronts and park paths when they connect two landmarks efficiently. Avoid long stretches of featureless shoreline when a nearby street has more to see.
- Include famous squares, bridges, cathedrals, palaces, museums, stadiums, and cultural landmarks.
- Embrace lively pedestrian streets and historic quarters. Avoid highways and industrial areas.
- Each waypoint should showcase a DIFFERENT notable place or viewpoint.
- Keep landmarks within a walkable area — a focused tour beats a scattered marathon.`,
};

function buildRoutePrompt(scenicMode: ScenicMode, lat: number, lng: number, distanceKm: number, cityName: string, poiWaypoints?: NaturePOI[], island?: IslandData | null): string {
  const labelInstruction = scenicMode !== 'standard'
    ? `\n- Include a "label" field on each waypoint describing what is at that location (park name, landmark name, street name, etc.)`
    : '';

  const poiSection = poiWaypoints && poiWaypoints.length > 0
    ? `\n\nNearby green spaces and nature areas (REAL coordinates from OpenStreetMap - use these as waypoints):\n${poiWaypoints.map(p => `- ${p.name} (${p.type}): ${p.lat}, ${p.lng}`).join('\n')}\n\nTry to route through 1-2 of these locations if they fall naturally along the route. Do NOT detour to reach them.`
    : '';

  return `You are a running route planner. Generate a circular running route.

Starting point: ${lat}, ${lng} (${cityName})
Desired distance: ${distanceKm} km

${island && island.perimeterKm > 0 ? (() => {
    const distMatch = Math.abs(distanceKm - island.perimeterKm) / island.perimeterKm < 0.3 && scenicMode === 'standard';
    if (distMatch) {
      return `ISLAND DETECTED: You are on ${island.name} (perimeter: ${island.perimeterKm.toFixed(1)} km). Here are outline coordinates of the island shoreline — use these to place waypoints ALONG the actual shoreline:
${island.outline.map((p, i) => `${i}: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`).join('\n')}

The requested distance (${distanceKm}km) closely matches the island perimeter (${island.perimeterKm.toFixed(1)}km). STRONGLY RECOMMENDED: Create a route that follows the island shoreline all the way around. Place waypoints along the outline coordinates above. Go counter-clockwise.`;
    } else {
      // Sort outline points by distance from start, take nearest 10
      const sorted = island.outline
        .map(p => ({ ...p, dist: Math.sqrt(Math.pow(p.lat - lat, 2) + Math.pow(p.lng - lng, 2)) }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 10);
      return `ISLAND DETECTED: You are on ${island.name} (perimeter: ${island.perimeterKm.toFixed(1)} km). The requested distance (${distanceKm}km) is shorter than the full perimeter — do NOT try to go all the way around.

Here are the nearest shoreline coordinates to your starting point — use these to place waypoints along the waterfront:
${sorted.map((p, i) => `${i}: ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}`).join('\n')}

STRATEGY: Follow the shoreline counter-clockwise for roughly ${(distanceKm * 0.6).toFixed(1)} km, then take a direct path back through parks or quiet streets. The route must be a clean loop with NO backtracking.`;
    }
  })() : `GEOGRAPHIC ANALYSIS: Identify what geographic features exist at these coordinates — island, peninsula, lake, river, coast, or large park. Use that knowledge to plan the optimal route shape.`}${poiSection}

Requirements:
- The route must START and END at the starting point coordinates
- The total distance should be approximately ${distanceKm} km
- DIRECTION: ${Math.random() < 0.8 ? 'Go counter-clockwise. On an island, this means keeping the water on your LEFT side.' : 'Go clockwise. On an island, this means keeping the water on your RIGHT side.'}
${SCENIC_INSTRUCTIONS[scenicMode]}
- Generate ${distanceKm < 7 ? '3-5' : '5-8'} waypoints that define the route shape (fewer waypoints = cleaner route, aim for ~1-2 turns per km)${labelInstruction}
- Place waypoints ONLY at major intersections or along main roads, never on residential dead-end streets
- NEVER generate waypoints on dead-end streets or cul-de-sacs. Every waypoint must be at a through-intersection.
- For dense historic urban areas, prefer the main walking streets and quays rather than narrow alleys

Return ONLY a JSON array of waypoints, no other text. Each waypoint has lat, lng, and optionally label:
[{"lat": 59.3251, "lng": 18.0711, "label": "Kungstradgarden"}, {"lat": 59.3400, "lng": 18.0800}, ...]

The first and last waypoint must be the starting point.`;
}

/**
 * Call the server-side API route which proxies to Anthropic.
 * This keeps the API key server-side and avoids CORS/browser-access issues.
 */
async function callServerRoute(prompt: string): Promise<string> {
  const res = await fetch('/api/generate-route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
    throw new Error(data.error || `Route generation failed (${res.status})`);
  }

  const data = await res.json();
  return data.text;
}

async function callPerplexity(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Perplexity API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * Haversine distance between two points in meters.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Densify waypoints by interpolating extra points between consecutive waypoints
 * that are more than `maxGapMeters` apart. This forces OSRM to follow the
 * intended path more closely (e.g. along waterfronts instead of cutting inland).
 */
function densifyWaypoints(waypoints: RouteWaypoint[], maxGapMeters: number = 600): RouteWaypoint[] {
  const result: RouteWaypoint[] = [waypoints[0]];

  for (let i = 1; i < waypoints.length; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const dist = haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);

    if (dist > maxGapMeters) {
      const segments = Math.ceil(dist / maxGapMeters);
      for (let s = 1; s < segments; s++) {
        const t = s / segments;
        result.push({
          lat: prev.lat + t * (curr.lat - prev.lat),
          lng: prev.lng + t * (curr.lng - prev.lng),
        });
      }
    }

    result.push(curr);
  }

  return result;
}

function parseWaypoints(response: string): RouteWaypoint[] {
  // Try to extract JSON array from the response
  const jsonMatch = response.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) throw new Error('No waypoints found in AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('Invalid waypoints: need at least 3 points');
  }

  return parsed.map((p: any) => ({
    lat: parseFloat(p.lat ?? p.latitude),
    lng: parseFloat(p.lng ?? p.lon ?? p.longitude),
    ...(p.label ? { label: String(p.label) } : {}),
  }));
}

export async function generateRouteWaypoints(req: AIRouteRequest): Promise<RouteWaypoint[]> {
  const { lat, lng, distanceKm, cityName, settings } = req;

  const prompt = buildRoutePrompt(req.scenicMode ?? 'standard', lat, lng, distanceKm, cityName, req.poiWaypoints, req.island);

  let response: string;
  if (settings.apiProvider === 'perplexity' && settings.apiKey) {
    response = await callPerplexity(prompt, settings.apiKey);
  } else {
    // Use server-side API route (API key is kept server-side)
    response = await callServerRoute(prompt);
  }

  const waypoints = parseWaypoints(response);

  // Log raw AI waypoints for debugging
  console.log(`[route-ai] Raw AI waypoints (${waypoints.length} points):`,
    waypoints.map((w, i) => `  ${i}: ${w.lat.toFixed(4)}, ${w.lng.toFixed(4)}${w.label ? ` (${w.label})` : ''}`).join('\n')
  );

  // Ensure the route is closed (first and last point match start)
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const distToStart = Math.sqrt(
    Math.pow(last.lat - lat, 2) + Math.pow(last.lng - lng, 2)
  );

  if (distToStart > 0.001) {
    waypoints.push({ lat, lng });
  }

  // Ensure first waypoint is close to user
  const firstDist = Math.sqrt(
    Math.pow(first.lat - lat, 2) + Math.pow(first.lng - lng, 2)
  );
  if (firstDist > 0.001) {
    waypoints.unshift({ lat, lng });
  }

  // Skip densification — it interpolates straight lines that can cross water
  // or cut through buildings, causing OSRM to create detours. The AI waypoints
  // at major turns are sufficient for OSRM to find good paths.
  console.log(`[route-ai] Returning ${waypoints.length} waypoints (no densification)`);

  return waypoints;
}

export { generateAlgorithmicWaypoints as generateRouteAlgorithmic } from './route-algorithmic';
