import { NextResponse } from 'next/server'
import { EventRepository } from '@/lib/db/queries/event'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const seriesSlug = searchParams.get('seriesSlug')?.trim()

  if (!seriesSlug) {
    return NextResponse.json(null, { status: 400 })
  }

  const { data: config } = await EventRepository.getLiveChartConfigBySeriesSlug(seriesSlug)
  return NextResponse.json(config ?? null)
}
