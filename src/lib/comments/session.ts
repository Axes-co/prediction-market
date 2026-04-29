import { auth } from '@/lib/auth'

export interface CommentSessionUser {
  base_address: string
  proxy_wallet_address: string | null
  username: string | null
  image: string | null
}

/**
 * Resolve the connected wallet user from the better-auth SIWE session that the
 * Next.js app already issues on sign-in. Returns null when the request has no
 * valid session cookie. The base address is normalized to lowercase to match
 * the `polymarket_users.base_address` constraint.
 *
 * Routes pass `request.headers` (a `Headers` object) directly — better-auth's
 * `getSession` accepts the Web Headers shape on the route-handler boundary.
 */
export async function getCommentSessionUser(request: Request): Promise<CommentSessionUser | null> {
  try {
    const session = await auth.api.getSession({
      headers: request.headers,
    })
    if (!session?.user) {
      return null
    }
    const u = session.user as Record<string, unknown>
    const rawAddress = typeof u.address === 'string' && u.address.length > 0
      ? u.address
      : typeof u.name === 'string' ? u.name : ''
    const baseAddress = rawAddress.trim().toLowerCase()
    if (!/^0x[a-f0-9]{40}$/.test(baseAddress)) {
      return null
    }
    return {
      base_address: baseAddress,
      proxy_wallet_address: typeof u.proxy_wallet_address === 'string' ? u.proxy_wallet_address : null,
      username: typeof u.username === 'string' ? u.username : null,
      image: typeof u.image === 'string' ? u.image : null,
    }
  }
  catch {
    return null
  }
}
