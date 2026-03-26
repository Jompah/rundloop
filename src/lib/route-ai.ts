import { RouteWaypoint, AppSettings, ScenicMode } from '@/types';

export interface NaturePOI {
  name: string;
  lat: number;
  lng: number;
  type: string;
}

interface AIRouteRequest {
  lat: number;
  lng: number;
  distanceKm: number;
  cityName: string;
  settings: AppSettings;
  scenicMode?: ScenicMode;
  poiWaypoints?: NaturePOI[];
}

// Shared rules applied to ALL scenic modes — anti-detour, waypoint placement, and loop quality
const SHARED_ROUTE_RULES = `- ABSOLUTELY NO DETOURS: NEVER create dead-end detours. Every waypoint must be on the THROUGH-route, not a side trip. The runner must move FORWARD continuously, never doubling back on any street. If you place a waypoint on a side street, the runner goes in AND comes back — that is a detour and is FORBIDDEN.
- Place waypoints ONLY on streets that naturally connect to the next waypoint without requiring the runner to retrace steps. Each waypoint must flow into the next in one direction.
- WAYPOINT PLACEMENT: Place waypoints at TURNING POINTS only — where the route changes direction. Do NOT place waypoints along straight stretches. This ensures the router creates straight paths between turns, avoiding unnecessary detours through side streets.
- PERIMETER LOOP DETECTION: For distances that match the perimeter of a local geographic feature (island, peninsula, lake, large park), create a PERIMETER LOOP following the outer edge. Example: 10km on Kungsholmen = run around the island's waterfront. 5km near a lake = loop around it.
- Prefer CONTINUOUS paths (waterfront promenades, park trails, ring roads) over zig-zag patterns through city blocks.
- It is MUCH better to be 10-15% shorter than the target distance than to add side-street detours to hit exact distance.
- Round all coordinates to 4 decimal places (e.g. 59.3251, not 59.32517843)`;

const SCENIC_INSTRUCTIONS: Record<ScenicMode, string> = {
  standard: `${SHARED_ROUTE_RULES}
- When the target distance roughly matches a natural loop (island perimeter, park circuit, waterfront path), generate waypoints that trace that natural loop. Use your geographic knowledge of the area.
- Include famous landmarks, tourist attractions, and popular sights ALONG the loop. Route PAST (not just near) iconic buildings, monuments, squares, and viewpoints — but only if they are on the natural loop path, never as side trips.
- Prefer parks, waterfront paths, pedestrian areas, and quiet residential streets
- Avoid highways, industrial areas, and busy roads
- Create an interesting loop, not an out-and-back route
- Spread waypoints across different compass directions from the start (north, east, south, west) to create a varied loop`,
  nature: `${SHARED_ROUTE_RULES}
- Follow waterfront paths and park edges CONTINUOUSLY. Never leave the waterfront to go inland and come back — that is a detour.
- If on an island, follow the waterfront/shoreline path around the island perimeter. Place waypoints at points where the shoreline changes direction.
- Prefer paths with views - elevation, waterfront, open spaces
- PRIORITIZE parks, nature reserves, waterfront paths, rivers, lakes, canals, and green corridors
- Actively seek the BEST green spaces and water features near the starting point
- Seek out tree-lined streets, botanical gardens, and urban forests
- Avoid highways, industrial areas, busy roads, and commercial districts
- Prefer unpaved trails and park paths when available
- If a large park exists within range, route THROUGH it rather than around it
- Spread waypoints across different compass directions to maximize green coverage`,
  explore: `${SHARED_ROUTE_RULES}
- Connect landmarks in a logical loop, not zigzag pattern
- If on an island, combine perimeter waterfront with landmarks that are ON the perimeter path
- PRIORITIZE world-famous landmarks and tourist must-sees. The runner should pass the top 3-5 most iconic sights.
- Include popular squares, famous bridges, cathedrals, palaces, stadiums, and cultural landmarks
- Route past famous squares, cathedrals, museums, bridges, and tourist attractions
- Avoid highways and industrial areas but embrace lively pedestrian streets
- Create a sightseeing loop that showcases the most interesting parts of the city
- Spread waypoints across different notable areas - avoid clustering around one landmark
- Each waypoint should showcase a DIFFERENT interesting place or viewpoint`,
};

function buildRoutePrompt(scenicMode: ScenicMode, lat: number, lng: number, distanceKm: number, cityName: string, poiWaypoints?: NaturePOI[]): string {
  const labelInstruction = scenicMode !== 'standard'
    ? `\n- Include a "label" field on each waypoint describing what is at that location (park name, landmark name, street name, etc.)`
    : '';

  const poiSection = poiWaypoints && poiWaypoints.length > 0
    ? `\n\nNearby green spaces and nature areas (REAL coordinates from OpenStreetMap - use these as waypoints):\n${poiWaypoints.map(p => `- ${p.name} (${p.type}): ${p.lat}, ${p.lng}`).join('\n')}\n\nYou MUST route through at least ${Math.min(poiWaypoints.length, 3)} of these locations. Use their exact coordinates as waypoints.`
    : '';

  return `You are a running route planner. Generate a circular running route.

Starting point: ${lat}, ${lng} (${cityName})
Desired distance: ${distanceKm} km

Consider the specific geography and notable places of ${cityName} when selecting waypoints.${poiSection}

Requirements:
- The route must START and END at the starting point coordinates
- The total distance should be approximately ${distanceKm} km
${SCENIC_INSTRUCTIONS[scenicMode]}
- Generate ${distanceKm < 10 ? '4-8' : '6-10'} waypoints that define the route shape (fewer waypoints = cleaner route)${labelInstruction}
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

function parseWaypoints(response: string): RouteWaypoint[] {
  // Try to extract JSON array from the response
  const jsonMatch = response.match(/\[[\s\S]*?\]/);
  if (!jsonMatch) throw new Error('No waypoints found in AI response');

  const parsed = JSON.parse(jsonMatch[0]);
  if (!Array.isArray(parsed) || parsed.length < 3) {
    throw new Error('Invalid waypoints: need at least 3 points');
  }

  return parsed.map((p: any) => ({
    lat: parseFloat(p.lat),
    lng: parseFloat(p.lng),
    ...(p.label ? { label: String(p.label) } : {}),
  }));
}

export async function generateRouteWaypoints(req: AIRouteRequest): Promise<RouteWaypoint[]> {
  const { lat, lng, distanceKm, cityName, settings } = req;

  const prompt = buildRoutePrompt(req.scenicMode ?? 'standard', lat, lng, distanceKm, cityName, req.poiWaypoints);

  let response: string;
  if (settings.apiProvider === 'perplexity' && settings.apiKey) {
    response = await callPerplexity(prompt, settings.apiKey);
  } else {
    // Use server-side API route (API key is kept server-side)
    response = await callServerRoute(prompt);
  }

  const waypoints = parseWaypoints(response);

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

  return waypoints;
}

export { generateAlgorithmicWaypoints as generateRouteAlgorithmic } from './route-algorithmic';
