/**
 * Server-side Overpass API client with mirror failover.
 *
 * The public overpass-api.de instance is flaky — cold requests often time
 * out. We try it first with a short timeout, then fall back to an
 * established public mirror with a slightly longer one.
 *
 * (Not to be confused with src/lib/overpass.ts, which is the client-side
 * landmark fetcher.)
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  // VK Maps' public Overpass instance — same API version and JSON format.
  // (overpass.kumi.systems and overpass.private.coffee both timed out when
  // field-tested 2026-07-02; maps.mail.ru answered in <1 s.)
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export interface OverpassQueryOptions {
  primaryTimeoutMs?: number;
  mirrorTimeoutMs?: number;
}

/**
 * POSTs an Overpass QL query, trying each endpoint in order. An endpoint
 * counts as failed on timeout, network error, non-ok status, or a body that
 * is not valid JSON — the next endpoint is then tried. Throws a combined
 * error (with per-endpoint reasons, for the server log) only when every
 * endpoint has failed.
 */
export async function overpassQuery(
  query: string,
  opts?: OverpassQueryOptions
): Promise<unknown> {
  const timeouts = [opts?.primaryTimeoutMs ?? 6000, opts?.mirrorTimeoutMs ?? 8000];
  const failures: string[] = [];

  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    const timeoutMs = timeouts[Math.min(i, timeouts.length - 1)];

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        body: `data=${encodeURIComponent(query)}`,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          // Overpass rejects UA-less requests (406); Node fetch sends none by default.
          'User-Agent': 'Drift/1.0',
        },
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Invalid JSON (e.g. an HTML error page) throws → try next endpoint.
      return await response.json();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failures.push(`${endpoint}: ${reason}`);

      if (i < OVERPASS_ENDPOINTS.length - 1) {
        // Visible in the Vercel logs — tells us how often the mirror is used.
        console.warn(`[overpass] primary failed (${reason}), trying mirror`);
      }
    }
  }

  throw new Error(`All Overpass endpoints failed — ${failures.join('; ')}`);
}
