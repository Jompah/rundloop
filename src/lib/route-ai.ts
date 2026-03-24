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

const SCENIC_INSTRUCTIONS: Record<ScenicMode, string> = {
  standard: `- Prefer parks, waterfront paths, pedestrian areas, and quiet residential streets
- Avoid highways, industrial areas, and busy roads
- Create an interesting loop, not an out-and-back route
- Create a loop that visits different streets - avoid running the same street twice
- Prefer routes through different neighborhoods rather than out-and-back patterns
- Spread waypoints across different compass directions from the start (north, east, south, west) to create a varied loop`,
  nature: `- PRIORITIZE parks, nature reserves, waterfront paths, rivers, lakes, canals, and green corridors
- Actively seek the BEST green spaces and water features near the starting point - name specific parks, trails, or waterfront areas you route through
- In city centers: find hidden gardens, riverside paths, canal walks, and park connectors that most people overlook
- Seek out tree-lined streets, botanical gardens, and urban forests
- Avoid highways, industrial areas, busy roads, and commercial districts
- Prefer unpaved trails and park paths when available
- Create a loop through the greenest, most natural areas near the starting point
- If a large park exists within range, route THROUGH it rather than around it
- Spread waypoints across different compass directions from the start to maximize green coverage
- Each waypoint should be in a distinctly different area - avoid clustering waypoints in the same park or street`,
  explore: `- PRIORITIZE landmarks, monuments, viewpoints, historic buildings, and cultural sites
- Actively seek the MOST interesting and notable places near the starting point - name specific landmarks, squares, or attractions you route past
- In city centers: include famous streets, historic squares, iconic bridges, notable churches or cathedrals, and scenic viewpoints
- Route past famous squares, cathedrals, museums, bridges, and tourist attractions
- Seek scenic viewpoints and photo-worthy locations
- Avoid highways and industrial areas but embrace lively pedestrian streets
- Create a sightseeing loop that showcases the most interesting parts of the city
- Prefer routes that pass through the historic city center or notable neighborhoods
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
- Generate 6-12 waypoints that define the route shape${labelInstruction}
- Place waypoints ONLY at major intersections or along main roads, never on residential dead-end streets
- Prefer smooth circular or figure-8 loops over routes with sharp turns into side streets
- It is better to be 10-15% shorter than the target distance than to include short detour streets to hit exact distance
- Round all coordinates to 4 decimal places (e.g. 59.3251, not 59.32517843)

Return ONLY a JSON array of waypoints, no other text. Each waypoint has lat, lng, and optionally label:
[{"lat": 59.3251, "lng": 18.0711, "label": "Kungstradgarden"}, {"lat": 59.3400, "lng": 18.0800}, ...]

The first and last waypoint must be the starting point.`;
}

async function callClaude(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.content[0].text;
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

  if (!settings.apiKey) {
    throw new Error('No API key configured. Go to Settings to add your Claude or Perplexity key.');
  }

  const prompt = buildRoutePrompt(req.scenicMode ?? 'standard', lat, lng, distanceKm, cityName, req.poiWaypoints);

  let response: string;
  if (settings.apiProvider === 'perplexity') {
    response = await callPerplexity(prompt, settings.apiKey);
  } else {
    response = await callClaude(prompt, settings.apiKey);
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
