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
  const latlng = searchParams.get('latlng');
  const address = searchParams.get('address');

  if (!latlng && !address) {
    return NextResponse.json(
      { error: 'latlng or address is required' },
      { status: 400 }
    );
  }

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  if (latlng) {
    url.searchParams.set('latlng', latlng);
  }
  if (address) {
    url.searchParams.set('address', address);
  }
  url.searchParams.set('key', apiKey);

  try {
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
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
