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
  const coordinates = searchParams.get('coordinates');
  const alternatives = searchParams.get('alternatives') || 'false';

  if (!coordinates) {
    return NextResponse.json(
      { error: 'coordinates parameter is required' },
      { status: 400 }
    );
  }

  // Semicolon-separated lng,lat pairs, e.g. "18.06,59.33;18.07,59.34"
  const COORDINATES_PATTERN = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?(;-?\d+(\.\d+)?,-?\d+(\.\d+)?)*$/;
  if (!COORDINATES_PATTERN.test(coordinates)) {
    return NextResponse.json(
      { error: 'coordinates must be semicolon-separated lng,lat pairs' },
      { status: 400 }
    );
  }

  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coordinates}?access_token=${token}&geometries=geojson&steps=true&overview=full&alternatives=${alternatives}`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(15000),
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
