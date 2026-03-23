import { NextResponse } from 'next/server'
import { buildEmbedEvent, withEmbedCors } from '@/app/api/embed/_utils'
import { cacheControl, checkRateLimit } from '@/lib/api-utils'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'

export async function OPTIONS() {
  return withEmbedCors(new NextResponse(null, { status: 204 }))
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const rateLimited = await checkRateLimit(request)
  if (rateLimited) {
    return rateLimited
  }

  try {
    const { slug } = await params
    const { data: event, error } = await EventRepository.getEventBySlug(slug)
    if (error || !event) {
      return withEmbedCors(NextResponse.json({ error: 'Event not found' }, { status: 404 }))
    }

    const response = withEmbedCors(NextResponse.json(buildEmbedEvent(event)))
    response.headers.set('Cache-Control', cacheControl.long)
    return response
  }
  catch (error) {
    console.error('Embed event API error:', error)
    return withEmbedCors(NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 }))
  }
}
