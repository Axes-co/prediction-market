/**
 * Polymarket's CLOB / Data / Gamma / Relayer endpoints sit behind Cloudflare,
 * and Cloudflare's WAF rejects server-side requests that arrive without a
 * browser-like User-Agent. The block is documented in
 * https://github.com/Polymarket/py-clob-client/issues/91 and #143; symptoms
 * are an HTML "Attention Required!" challenge page returned with a 403/520,
 * not a JSON error. Browsers pass through fine because they ship a real UA;
 * Vercel/Supabase/Fly server functions fail intermittently (~30-50%) without
 * it.
 *
 * `polymarketUpstreamFetch` adds a realistic browser User-Agent and a few
 * supporting Accept headers to every server-to-Polymarket request. Use it
 * for any call to clob.polymarket.com, gamma-api.polymarket.com,
 * data-api.polymarket.com, or relayer-v2.polymarket.com.
 *
 * The User-Agent string is anchored to a recent stable Chrome on macOS so
 * Cloudflare's bot-score model treats us as a normal browser. Update only
 * when the major Chrome version moves so we don't drift into the
 * "ancient browser" detection bucket.
 */

const POLYMARKET_UPSTREAM_USER_AGENT
  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/126.0.0.0 Safari/537.36'

interface PolymarketFetchInit extends RequestInit {
  /** Override the default User-Agent. Reserved for the rare callers that need it. */
  userAgent?: string
}

export async function polymarketUpstreamFetch(
  input: string | URL,
  init: PolymarketFetchInit = {},
): Promise<Response> {
  const { userAgent, headers, ...rest } = init
  const merged = new Headers(headers)
  if (!merged.has('user-agent')) {
    merged.set('user-agent', userAgent ?? POLYMARKET_UPSTREAM_USER_AGENT)
  }
  if (!merged.has('accept-language')) {
    merged.set('accept-language', 'en-US,en;q=0.9')
  }
  return fetch(input, { ...rest, headers: merged })
}
