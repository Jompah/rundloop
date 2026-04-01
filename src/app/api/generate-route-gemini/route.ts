import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured on server' }, { status: 500 });
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
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: body.prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 0 } },
        }),
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`Gemini API error (${res.status}):`, err);
      return NextResponse.json({ error: `Gemini route generation failed (${res.status})` }, { status: 502 });
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';
    const finishReason = candidate?.finishReason;

    if (finishReason && finishReason !== 'STOP') {
      console.warn(`Gemini finish reason: ${finishReason} (response may be truncated)`);
      return NextResponse.json({ error: `Gemini response truncated (${finishReason})` }, { status: 502 });
    }

    return NextResponse.json({ text });
  } catch (error) {
    console.error('Gemini route generation error:', error);
    return NextResponse.json({ error: 'Failed to generate route via Gemini' }, { status: 500 });
  }
}
