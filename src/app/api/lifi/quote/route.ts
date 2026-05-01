import type { TokenExtended } from '@lifi/types'
import { getQuote, getTokens } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { parseUnits } from 'viem'
import { sanitizeNumericInput } from '@/lib/amount-input'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'
import { ensureLiFiServerConfig } from '@/lib/lifi'

// Polymarket runs on Polygon — every deposit ends up as USDC on chain 137
// (the CLOB collateral, COLLATERAL_TOKEN_ADDRESS). The earlier version of
// this route quoted same-chain (toChain == fromChainId), which made LI.FI
// reject it as "the same token cannot be used as both source and
// destination" whenever the user already held USDC on the source chain.
// Hardcoding the destination to Polygon USDC fixes that and matches the
// product's actual deposit flow: any source token, any source chain, lands
// as USDC on Polygon ready for the Onramp wrap into pUSD.
const POLYGON_CHAIN_ID = 137

interface QuoteRequestBody {
  fromChainId: number
  fromTokenAddress: string
  fromTokenDecimals: number
  fromAddress: string
  toAddress: string
  amount: string
}

function findUsdcToken(stepChainTokens: TokenExtended[]) {
  return stepChainTokens.find(token => token.address.toLowerCase() === COLLATERAL_TOKEN_ADDRESS.toLowerCase())
    ?? stepChainTokens.find(token => token.symbol.toUpperCase() === 'USDC')
}

export async function POST(request: Request) {
  await ensureLiFiServerConfig()

  let body: QuoteRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.amount) {
    return NextResponse.json({ error: 'Amount is required.' }, { status: 400 })
  }

  const sanitizedAmount = sanitizeNumericInput(body.amount)
  if (!sanitizedAmount) {
    return NextResponse.json({ error: 'Amount is required.' }, { status: 400 })
  }

  let fromAmount: string
  try {
    const fromAmountBigInt = parseUnits(sanitizedAmount, body.fromTokenDecimals)
    if (fromAmountBigInt <= 0n) {
      return NextResponse.json({ error: 'Amount must be greater than zero.' }, { status: 400 })
    }
    fromAmount = fromAmountBigInt.toString()
  }
  catch {
    return NextResponse.json({ error: 'Invalid amount.' }, { status: 400 })
  }

  try {
    const tokensResponse = await getTokens({
      extended: true,
      chains: [POLYGON_CHAIN_ID],
    })

    const polygonTokens = tokensResponse.tokens[POLYGON_CHAIN_ID] ?? []
    const polygonUsdc = findUsdcToken(polygonTokens)

    if (!polygonUsdc) {
      return NextResponse.json({ error: 'USDC token not available on Polygon.' }, { status: 400 })
    }

    const isSameChainSameToken = body.fromChainId === POLYGON_CHAIN_ID
      && body.fromTokenAddress.toLowerCase() === polygonUsdc.address.toLowerCase()
    if (isSameChainSameToken) {
      return NextResponse.json({
        error: 'Already holding Polygon USDC. Use the direct deposit path instead of bridging.',
      }, { status: 400 })
    }

    const quote = await getQuote({
      fromChain: body.fromChainId,
      toChain: POLYGON_CHAIN_ID,
      fromToken: body.fromTokenAddress,
      toToken: polygonUsdc.address,
      fromAddress: body.fromAddress,
      toAddress: body.toAddress,
      fromAmount,
    })

    return NextResponse.json({ quote })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI quote.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
