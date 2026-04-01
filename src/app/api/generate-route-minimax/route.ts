import { NextRequest, NextResponse } from 'next/server';

const MINIMAX_API_KEY = process.env.MINIMAX_API_KEY || '';

export async function POST(request: NextRequest) {
  if (!MINIMAX_API_KEY) {
    return NextResponse.json({ error: 'MINIMAX_API_KEY not configured on server' }, { status: 500 });
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
    const res = await fetch('https://api.minimaxi.chat/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MINIMAX_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'MiniMax-Text-01',
        messages: [{ role: 'user', content: body.prompt }],
        temperature: 0.2,
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Minimax API error (${res.status}):`, err);
      return NextResponse.json({ error: `Minimax route generation failed (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ text });
  } catch (error) {
    console.error('Minimax route generation error:', error);
    return NextResponse.json({ error: 'Failed to generate route via Minimax' }, { status: 500 });
  }
}
