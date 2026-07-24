import { execFile } from 'node:child_process';

/**
 * Web-only relay for the Dorar hadith API.
 *
 * dorar.net sends no CORS headers, so the browser cannot call it directly.
 * Native talks to Dorar straight from the device; the web build routes
 * through here instead. This is a pass-through on purpose — the HTML payload
 * is parsed client-side by src/utils/hadithParser.ts so there is exactly one
 * parser shared by every platform.
 */

const DORAR_ENDPOINT = 'https://dorar.net/dorar_api.json';
const TIMEOUT_MS = 15_000;

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Cloudflare fingerprints the TLS handshake, and Node's is on its blocklist:
 * every Node request to Dorar returns 403 regardless of headers, protocol or
 * cipher order (verified). The system `curl` uses a different TLS stack that
 * Cloudflare accepts, so fall back to it when the built-in fetch is refused.
 *
 * Native never takes this path — iOS/Android use their own TLS stacks, which
 * Dorar accepts directly.
 */
async function fetchViaCurl(target: string): Promise<string | null> {
  try {
    return await new Promise<string | null>((resolve) => {
      const child = execFile(
        'curl',
        [
          '-s',
          '--compressed',
          '--max-time',
          String(Math.ceil(TIMEOUT_MS / 1000)),
          '-A',
          BROWSER_UA,
          '-H',
          'Accept: application/json, text/plain, */*',
          '-H',
          'Accept-Language: ar,en;q=0.9',
          target,
        ],
        { maxBuffer: 10 * 1024 * 1024 },
        (error, stdout) => resolve(error ? null : stdout),
      );
      child.on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const query = (url.searchParams.get('q') ?? '').trim();
  if (!query) return json({ error: 'missing q' }, 400);

  // Whitelist the passthrough params rather than forwarding the query string.
  const pageParam = Number(url.searchParams.get('page') ?? '1');
  const page = Number.isFinite(pageParam) ? Math.max(1, Math.floor(pageParam)) : 1;
  const degree = url.searchParams.get('d');

  const target = new URL(DORAR_ENDPOINT);
  target.searchParams.set('skey', query);
  target.searchParams.set('page', String(page));
  if (degree === '1' || degree === '2' || degree === '3') {
    target.searchParams.append('d[]', degree);
  }

  const targetUrl = target.toString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  /** Dorar sometimes labels this endpoint text/html, so parse defensively. */
  const asJson = (body: string): Response | null => {
    try {
      return json(JSON.parse(body));
    } catch {
      return null;
    }
  };

  try {
    let body: string | null = null;
    try {
      const upstream = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'ar,en;q=0.9',
        },
      });
      if (upstream.ok) body = await upstream.text();
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        return json({ error: 'timeout' }, 504);
      }
      // fall through to the curl fallback below
    }

    // Node's TLS fingerprint is refused by Cloudflare — retry via system curl.
    if (body === null) body = await fetchViaCurl(targetUrl);
    if (body === null) return json({ error: 'upstream unreachable' }, 502);

    return asJson(body) ?? json({ error: 'invalid upstream payload' }, 502);
  } finally {
    clearTimeout(timer);
  }
}
