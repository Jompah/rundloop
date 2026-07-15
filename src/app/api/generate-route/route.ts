import { NextRequest, NextResponse } from 'next/server';
import { invokeLLM, initProviderRegistry } from '@/lib/llm-invoke';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  // Initialize provider registry on first use
  initProviderRegistry();

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
    const result = await invokeLLM({
      prompt: body.prompt,
      model: 'claude-haiku-4-5-20251001',
      provider: process.env.LLM_PRIMARY_PROVIDER || 'anthropic',
      maxTokens: 2048,
      temperature: 0.2,
      timeoutMs: 30000,
    });

    if (result.isError) {
      console.error(`LLM invocation error:`, result.text);
      return NextResponse.json(
        { error: `AI route generation failed: ${result.text}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ text: result.text });
  } catch (error) {
    console.error('Route generation API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate AI route' },
      { status: 500 }
    );
  }
}
