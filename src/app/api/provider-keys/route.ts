// src/app/api/provider-keys/route.ts
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    google: !!process.env.GOOGLE_MAPS_API_KEY,
    mapbox: !!process.env.MAPBOX_ACCESS_TOKEN,
  });
}
