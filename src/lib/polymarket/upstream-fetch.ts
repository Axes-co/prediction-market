/**
 * Polymarket's CLOB / Data / Gamma / Relayer endpoints sit behind Cloudflare.
 * The WAF on `clob.polymarket.com/auth/api-key` (and to a lesser extent
 * `/order` and `/cancel`) is strict: it rejects any request that does not
 * present the full set of fetch-metadata headers a real Chrome tab would
 * send. Just spoofing User-Agent is not enough.
 *
 * Empirically (verified 2026-05-01) the WAF passes a request through to
 * Polymarket's API only when the request carries:
 *   - A current Chrome User-Agent
 *   - Origin: https://polymarket.com
 *   - Referer: https://polymarket.com/
 *   - Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site
 *   - Sec-Ch-Ua, Sec-Ch-Ua-Mobile, Sec-Ch-Ua-Platform
 *   - Accept, Accept-Language
 *
 * Without these the WAF returns the Cloudflare "Attention Required!" HTML
 * challenge page (`Polymarket/py-clob-client#91`, #143). Even routing through
 * a Cloudflare Worker still requires the headers — the Worker carries the
 * request to Polymarket's edge but the WAF's bot-score still inspects the
 * headers themselves.
 *
 * The User-Agent and Sec-Ch-Ua versions are anchored to a recent stable
 * Chrome on macOS. Update them when Chrome's major version moves so the
 * fingerprint stays in the "normal browser" bucket and out of the
 * "ancient browser" bucket.
 */

const POLYMARKET_UPSTREAM_USER_AGENT
  = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
    + 'AppleWebKit/537.36 (KHTML, like Gecko) '
    + 'Chrome/126.0.0.0 Safari/537.36'

const POLYMARKET_UPSTREAM_SEC_CH_UA
  = '"Chromium";v="126", "Google Chrome";v="126", "Not.A/Brand";v="24"'

const POLYMARKET_BROWSER_HEADERS: Record<string, string> = {
  'user-agent': POLYMARKET_UPSTREAM_USER_AGENT,
  'accept': 'application/json,text/plain,*/*',
  'accept-language': 'en-US,en;q=0.9',
  'origin': 'https://polymarket.com',
  'referer': 'https://polymarket.com/',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-site',
  'sec-ch-ua': POLYMARKET_UPSTREAM_SEC_CH_UA,
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
}

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
  for (const [name, value] of Object.entries(POLYMARKET_BROWSER_HEADERS)) {
    if (!merged.has(name)) {
      merged.set(name, name === 'user-agent' ? (userAgent ?? value) : value)
    }
  }
  return fetch(input, { ...rest, headers: merged })
}
