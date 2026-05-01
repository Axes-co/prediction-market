/**
 * Pass-through proxy for clob.polymarket.com. Every request is forwarded 1:1
 * with method, path, query, headers, and body preserved. The Host header is
 * rewritten so the upstream TLS SNI matches `clob.polymarket.com`, and any
 * Cloudflare-injected request headers (cf-*, x-forwarded-*, x-real-ip) are
 * stripped so they don't leak into our trust boundary.
 *
 * The Worker carries the request through Cloudflare's internal network. The
 * caller (our Next.js server in `polymarketUpstreamFetch`) is responsible for
 * setting browser-style headers (User-Agent, Origin, Referer, Sec-*); the
 * Worker doesn't inject them itself, because we want the same headers to
 * apply whether the call goes via this Worker or directly.
 */

const UPSTREAM_HOST = 'clob.polymarket.com'

const STRIP_REQUEST_HEADER_PREFIXES = ['cf-', 'x-forwarded-']
const STRIP_REQUEST_HEADER_NAMES = new Set(['x-real-ip'])

function buildUpstreamHeaders(requestHeaders) {
  const upstream = new Headers()
  for (const [name, value] of requestHeaders.entries()) {
    const lower = name.toLowerCase()
    if (STRIP_REQUEST_HEADER_PREFIXES.some(prefix => lower.startsWith(prefix))) {
      continue
    }
    if (STRIP_REQUEST_HEADER_NAMES.has(lower)) {
      continue
    }
    upstream.set(name, value)
  }
  upstream.set('host', UPSTREAM_HOST)
  return upstream
}

export default {
  async fetch(request) {
    const incoming = new URL(request.url)
    const upstreamUrl = new URL(incoming.pathname + incoming.search, `https://${UPSTREAM_HOST}`)

    const upstreamRequest = new Request(upstreamUrl.toString(), {
      method: request.method,
      headers: buildUpstreamHeaders(request.headers),
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'follow',
    })

    const response = await fetch(upstreamRequest)

    const responseHeaders = new Headers(response.headers)
    responseHeaders.delete('transfer-encoding')
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  },
}
