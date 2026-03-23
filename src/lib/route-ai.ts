import { RouteWaypoint, AppSettings } from '@/types';

interface AIRouteRequest {
  lat: number;
  lng: number;
  distanceKm: number;
  cityName: string;
  settings: AppSettings;
}

const ROUTE_PROMPT = (lat: number, lng: number, distanceKm: number, cityName: string) => `
You are a running route planner. Generate a circular running route.

Starting point: ${lat}, ${lng} (${cityName})
Desired distance: ${distanceKm} km

Requirements:
- The route must START and END at the starting point coordinates
- The total distance should be approximately ${distanceKm} km
- Prefer parks, waterfront paths, pedestrian areas, and quiet residential streets
- Avoid highways, industrial areas, and busy roads
- Create an interesting loop, not an out-and-back route
- Create a loop that visits different streets - avoid running the same street twice
- Prefer routes through different neighborhoods rather than out-and-back patterns
- Generate 6-12 waypoints that define the route shape

Return ONLY a JSON array of waypoints, no other text. Each waypoint has lat and lng:
[{"lat": 59.33, "lng": 18.07}, {"lat": 59.34, "lng": 18.08}, ...]

The first and last waypoint must be the starting point.
`;

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
  }));
}

export async function generateRouteWaypoints(req: AIRouteRequest): Promise<RouteWaypoint[]> {
  const { lat, lng, distanceKm, cityName, settings } = req;

  if (!settings.apiKey) {
    throw new Error('No API key configured. Go to Settings to add your Claude or Perplexity key.');
  }

  const prompt = ROUTE_PROMPT(lat, lng, distanceKm, cityName);

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
