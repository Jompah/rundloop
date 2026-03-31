import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY not configured on server' },
      { status: 500 }
    );
  }

  let body: { prompt: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        temperature: 0.2,
        messages: [{ role: 'user', content: body.prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Anthropic API error (${res.status}):`, err);
      return NextResponse.json(
        { error: `AI route generation failed (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Route generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI route' },
      { status: 500 }
    );
  }
}
