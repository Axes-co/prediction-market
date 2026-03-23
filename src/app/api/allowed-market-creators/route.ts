import { NextResponse } from 'next/server'
import { loadAllowedMarketCreatorWallets } from '@/lib/allowed-market-creators-server'
import { checkRateLimit, withCacheHeaders } from '@/lib/api-utils'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'

export async function GET(request: Request) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) {
    return rateLimited
  }

  try {
    const { data, error } = await loadAllowedMarketCreatorWallets()
    if (error || !data) {
      return NextResponse.json({ error: error ?? DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    return withCacheHeaders(NextResponse.json({ wallets: data }), 'medium')
  }
  catch (error) {
    console.error('Failed to load allowed market creators:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
