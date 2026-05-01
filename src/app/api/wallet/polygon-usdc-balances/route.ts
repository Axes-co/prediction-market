import { NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { readPolymarketWalletBalances } from '@/lib/polymarket/wallet-balances'

export async function POST(request: Request) {
  let body: { walletAddress?: string }
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const walletAddress = body.walletAddress?.trim()
  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: 'Valid walletAddress is required.' }, { status: 400 })
  }

  try {
    const balances = await readPolymarketWalletBalances(walletAddress)
    return NextResponse.json({ balances })
  }
  catch (error) {
    console.error('Failed to read Polygon wallet balances.', error)
    return NextResponse.json({ error: 'Failed to read Polygon wallet balances.' }, { status: 502 })
  }
}
