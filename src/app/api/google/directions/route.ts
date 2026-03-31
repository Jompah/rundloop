import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps API key not configured' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get('origin');
  const destination = searchParams.get('destination');
  const waypoints = searchParams.get('waypoints');

  if (!origin || !destination) {
    return NextResponse.json(
      { error: 'origin and destination are required' },
      { status: 400 }
    );
  }

  const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
  url.searchParams.set('origin', origin);
  url.searchParams.set('destination', destination);
  url.searchParams.set('mode', 'walking');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('key', apiKey);
  if (waypoints) {
    url.searchParams.set('waypoints', waypoints);
  }

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Google API error: ${response.status}` },
        { status: 502 }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Upstream request failed: ${message}` },
      { status: 502 }
    );
  }
}
