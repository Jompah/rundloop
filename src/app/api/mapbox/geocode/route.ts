import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'Mapbox access token not configured' },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const lng = searchParams.get('lng');
  const lat = searchParams.get('lat');
  const query = searchParams.get('query');

  if (!lng && !lat && !query) {
    return NextResponse.json(
      { error: 'lng+lat (reverse) or query (forward) is required' },
      { status: 400 }
    );
  }

  let url: string;

  if (query) {
    // Forward geocode
    const params = new URLSearchParams({
      q: query,
      access_token: token,
      limit: '5',
    });
    if (lng && lat) {
      params.set('proximity', `${lng},${lat}`);
    }
    url = `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`;
  } else {
    // Reverse geocode
    if (!lng || !lat) {
      return NextResponse.json(
        { error: 'Both lng and lat are required for reverse geocoding' },
        { status: 400 }
      );
    }
    url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}&limit=1`;
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Mapbox API error: ${response.status}` },
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
