import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { overpassQuery } from '../overpass-client';

const PRIMARY = 'https://overpass-api.de/api/interpreter';
const MIRROR = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';

const originalFetch = globalThis.fetch;

function okResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as unknown as Response;
}

function errorResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

function invalidJsonResponse() {
  return {
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError('Unexpected token < in JSON at position 0');
    },
  } as unknown as Response;
}

function timeoutError() {
  const err = new Error('The operation was aborted due to timeout');
  err.name = 'TimeoutError';
  return err;
}

describe('overpassQuery', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('returns primary response without calling the mirror when primary succeeds', async () => {
    const body = { elements: [{ type: 'way', id: 1 }] };
    fetchMock.mockResolvedValueOnce(okResponse(body));

    const result = await overpassQuery('[out:json];way(1);out;');

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(PRIMARY);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('sends the same request format as the routes (POST form body + User-Agent)', async () => {
    fetchMock.mockResolvedValueOnce(okResponse({ elements: [] }));

    const query = '[out:json];way["place"="island"];out geom;';
    await overpassQuery(query);

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(`data=${encodeURIComponent(query)}`);
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(init.headers['User-Agent']).toBe('Drift/1.0');
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('falls back to the mirror when the primary times out', async () => {
    const body = { elements: [{ type: 'node', id: 2 }] };
    fetchMock
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(okResponse(body));

    const result = await overpassQuery('[out:json];node(2);out;');

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(MIRROR);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[overpass] primary failed')
    );
  });

  it('falls back to the mirror on a non-ok status (429)', async () => {
    const body = { elements: [] };
    fetchMock
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse(body));

    const result = await overpassQuery('[out:json];out;');

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(MIRROR);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('HTTP 429'));
  });

  it('falls back to the mirror when the primary returns invalid JSON', async () => {
    const body = { elements: [{ type: 'relation', id: 3 }] };
    fetchMock
      .mockResolvedValueOnce(invalidJsonResponse())
      .mockResolvedValueOnce(okResponse(body));

    const result = await overpassQuery('[out:json];relation(3);out;');

    expect(result).toEqual(body);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(MIRROR);
  });

  it('throws a combined error with both reasons when all endpoints fail', async () => {
    fetchMock
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(errorResponse(504));

    await expect(overpassQuery('[out:json];out;')).rejects.toThrow(
      /All Overpass endpoints failed/
    );

    // Re-run to inspect the message contents (each reason + endpoint).
    fetchMock
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(errorResponse(504));

    const error = await overpassQuery('[out:json];out;').catch((e: Error) => e);
    expect(error).toBeInstanceOf(Error);
    const message = (error as Error).message;
    expect(message).toContain(PRIMARY);
    expect(message).toContain('The operation was aborted due to timeout');
    expect(message).toContain(MIRROR);
    expect(message).toContain('HTTP 504');
  });

  it('honors custom timeout options without changing the endpoint order', async () => {
    fetchMock
      .mockRejectedValueOnce(timeoutError())
      .mockResolvedValueOnce(okResponse({ elements: [] }));

    await overpassQuery('[out:json];out;', {
      primaryTimeoutMs: 1000,
      mirrorTimeoutMs: 2000,
    });

    expect(fetchMock.mock.calls[0][0]).toBe(PRIMARY);
    expect(fetchMock.mock.calls[1][0]).toBe(MIRROR);
  });
});
