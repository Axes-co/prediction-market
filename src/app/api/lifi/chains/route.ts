import { getChains } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { withCacheHeaders } from '@/lib/api-utils'
import { ensureLiFiServerConfig } from '@/lib/lifi'

export async function GET(_request: Request) {
  await ensureLiFiServerConfig()

  try {
    const chains = await getChains()
    return withCacheHeaders(NextResponse.json({ chains }), 'long')
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI chains.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
