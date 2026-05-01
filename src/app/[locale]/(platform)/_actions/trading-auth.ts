'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { UserRepository } from '@/lib/db/queries/user'
import {
  L2_AUTH_CONTEXT_COOKIE_NAME,
  L2_AUTH_CONTEXT_COOKIE_NAME_SECURE,
  L2_AUTH_CONTEXT_TTL_SECONDS,
} from '@/lib/l2-auth-context'
import { polymarketUpstreamFetch } from '@/lib/polymarket/upstream-fetch'
import { saveUserTradingAuthCredentials } from '@/lib/trading-auth/server'
import {
  getTradingFlowErrorPreview,
  mapTradingAuthError,
  readTradingFlowErrorResponse,
} from '@/lib/trading-flow-errors'

interface TradingAuthActionResult {
  error: string | null
  data: {
    relayer?: { enabled: boolean, updatedAt: string }
    clob?: { enabled: boolean, updatedAt: string }
  } | null
}

const GenerateTradingAuthSchema = z.object({
  signature: z.string().min(1),
  timestamp: z.string().min(1),
  nonce: z.string().min(1),
})

async function requestApiKey(baseUrl: string, headers: Record<string, string>) {
  let response: Response
  try {
    response = await polymarketUpstreamFetch(`${baseUrl}/auth/api-key`, {
      method: 'POST',
      headers,
      body: '',
      signal: AbortSignal.timeout(10_000),
    })
  }
  catch (error) {
    const detail = error instanceof Error ? error.message : 'unknown network error'
    console.error('Trading auth API key request failed (transport).', { baseUrl, detail })
    throw new Error(`Could not reach ${baseUrl}: ${detail}`)
  }

  const { payload, rawError, contentType } = await readTradingFlowErrorResponse(response)
  if (!response.ok || !payload) {
    console.error('Trading auth API key request failed.', {
      baseUrl,
      status: response.status,
      statusText: response.statusText,
      contentType,
      rawError: getTradingFlowErrorPreview(rawError),
    })
    // Surface the upstream status/error verbatim instead of always returning
    // the generic "try again" fallback. The CLOB returns clearly actionable
    // errors like `Invalid L1 headers` (401) or `Could not create api key`
    // (400), and operators need to see them to diagnose configuration issues
    // (geoblock, signature shape, etc.) instead of a useless generic message.
    const upstream = getTradingFlowErrorPreview(rawError)
    if (upstream) {
      throw new Error(`CLOB ${response.status}: ${upstream}`)
    }
    const message = mapTradingAuthError(rawError, {
      status: response.status,
      contentType,
      forceFallback: response.ok,
    })
    throw new Error(`${message} (CLOB ${response.status} ${response.statusText})`)
  }

  if (
    typeof payload?.apiKey !== 'string'
    || typeof payload?.secret !== 'string'
    || typeof payload?.passphrase !== 'string'
  ) {
    throw new TypeError('Invalid response from auth service.')
  }

  return {
    key: payload.apiKey,
    secret: payload.secret as string,
    passphrase: payload.passphrase as string,
  }
}

export async function generateTradingAuthAction(input: z.input<typeof GenerateTradingAuthSchema>): Promise<TradingAuthActionResult> {
  const user = await UserRepository.getCurrentUser({ disableCookieCache: true })
  if (!user) {
    return { error: 'Unauthenticated.', data: null }
  }
  if (!user.proxy_wallet_address) {
    return { error: 'Deploy your proxy wallet before enabling trading.', data: null }
  }

  const parsed = GenerateTradingAuthSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Invalid signature.', data: null }
  }

  const clobUrl = process.env.CLOB_URL
  if (!clobUrl) {
    return { error: DEFAULT_ERROR_MESSAGE, data: null }
  }

  const headers = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'POLY_ADDRESS': user.address,
    'POLY_SIGNATURE': parsed.data.signature,
    'POLY_TIMESTAMP': parsed.data.timestamp,
    'POLY_NONCE': parsed.data.nonce,
  }

  try {
    // Polymarket V2 has CLOB-only L1. The relayer (`relayer-v2.polymarket.com`)
    // does not expose `/auth/api-key` — POSTing there returns 404. After V2.6
    // the relayer auth uses **server-level builder credentials**
    // (`POLYMARKET_BUILDER_*` env via `buildRelayerHeaders`), not per-user L2.
    // The `auth.relayer` field stays on the schema for back-compat but is no
    // longer read by `proxy-wallet.ts` / `approve-tokens.ts` /
    // `pending-deposit.ts`. We populate it with the CLOB triple as a no-op
    // placeholder so existing onboarding-status checks (`tradingAuth.relayer.enabled`)
    // keep working.
    const clobCreds = await requestApiKey(clobUrl, headers)

    const l2AuthContextId = await saveUserTradingAuthCredentials(user.id, {
      relayer: clobCreds,
      clob: clobCreds,
    })
    if (!l2AuthContextId) {
      return { error: DEFAULT_ERROR_MESSAGE, data: null }
    }

    const cookieStore = await cookies()
    const isProduction = process.env.NODE_ENV === 'production'

    cookieStore.set({
      name: isProduction ? L2_AUTH_CONTEXT_COOKIE_NAME_SECURE : L2_AUTH_CONTEXT_COOKIE_NAME,
      value: l2AuthContextId,
      httpOnly: true,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: L2_AUTH_CONTEXT_TTL_SECONDS,
    })

    const updatedAt = new Date().toISOString()
    return {
      error: null,
      data: {
        relayer: { enabled: true, updatedAt },
        clob: { enabled: true, updatedAt },
      },
    }
  }
  catch (error) {
    console.error('Failed to generate trading auth credentials', error)
    const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
    return { error: message, data: null }
  }
}
