import { getTokens } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api-utils'
import { ensureLiFiServerConfig } from '@/lib/lifi'

interface TokensRequestBody {
  chains?: number[]
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'trading')
  if (rateLimited) {
    return rateLimited
  }

  await ensureLiFiServerConfig()

  let body: TokensRequestBody = {}
  try {
    body = await request.json()
  }
  catch {
    body = {}
  }

  try {
    const tokens = await getTokens({
      extended: true,
      chains: body.chains,
    })

    return NextResponse.json({ tokens })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI tokens.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
