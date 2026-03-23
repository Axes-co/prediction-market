import type { LiFiStep } from '@lifi/types'
import { getStepTransaction } from '@lifi/sdk'
import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/api-utils'
import { ensureLiFiServerConfig } from '@/lib/lifi'

interface StepTransactionRequestBody {
  step: LiFiStep
}

export async function POST(request: Request) {
  const rateLimited = await checkRateLimit(request, 'trading')
  if (rateLimited) {
    return rateLimited
  }

  await ensureLiFiServerConfig()

  let body: StepTransactionRequestBody
  try {
    body = await request.json()
  }
  catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!body.step) {
    return NextResponse.json({ error: 'step is required.' }, { status: 400 })
  }

  try {
    const step = await getStepTransaction(body.step)
    return NextResponse.json({ step })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch LI.FI step transaction.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
