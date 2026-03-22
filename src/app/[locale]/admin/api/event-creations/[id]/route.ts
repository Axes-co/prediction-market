import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { getAddress, isAddress } from 'viem'
import { z } from 'zod'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventCreationRepository } from '@/lib/db/queries/event-creations'
import { UserRepository } from '@/lib/db/queries/user'
import { normalizeEventCreationAssetPayload } from '@/lib/event-creation'

const updateDraftSchema = z.object({
  title: z.string().trim().max(300).optional(),
  slug: z.string().trim().max(300).optional().nullable(),
  titleTemplate: z.string().trim().max(300).optional().nullable(),
  slugTemplate: z.string().trim().max(300).optional().nullable(),
  startAt: z.string().datetime({ offset: true }).optional().nullable(),
  deployAt: z.string().datetime({ offset: true }).optional().nullable(),
  endDate: z.string().datetime({ offset: true }).optional().nullable(),
  walletAddress: z.string().trim().optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'running', 'deployed', 'failed', 'canceled']).optional(),
  recurrenceUnit: z.enum(['minute', 'hour', 'day', 'week', 'month', 'quarter', 'semiannual', 'year']).optional().nullable(),
  recurrenceInterval: z.number().int().positive().max(365).optional().nullable(),
  recurrenceUntil: z.string().datetime({ offset: true }).optional().nullable(),
  draftPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  assetPayload: z.record(z.string(), z.unknown()).optional().nullable(),
  mainCategorySlug: z.string().trim().max(120).optional().nullable(),
  categorySlugs: z.array(z.string().trim().min(1).max(120)).optional(),
  marketMode: z.enum(['binary', 'multi_multiple', 'multi_unique']).optional().nullable(),
  binaryQuestion: z.string().trim().max(500).optional().nullable(),
  binaryOutcomeYes: z.string().trim().max(120).optional().nullable(),
  binaryOutcomeNo: z.string().trim().max(120).optional().nullable(),
  resolutionSource: z.string().trim().max(1000).optional().nullable(),
  resolutionRules: z.string().trim().max(10_000).optional().nullable(),
})

interface EventCreationDraftRouteProps {
  params: Promise<{
    id: string
    locale: string
  }>
}

export async function PATCH(request: NextRequest, { params }: EventCreationDraftRouteProps) {
  try {
    const currentUser = await UserRepository.getCurrentUser()
    if (!currentUser || !currentUser.is_admin) {
      return NextResponse.json({ error: 'Unauthenticated.' }, { status: 401 })
    }

    const { id } = await params
    const payload = await request.json().catch(() => null)
    const parsed = updateDraftSchema.safeParse(payload)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }

    const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : null
    if (endDate && Number.isNaN(endDate.getTime())) {
      return NextResponse.json({ error: 'Invalid end date.' }, { status: 400 })
    }
    const startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null
    if (startAt && Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: 'Invalid start date.' }, { status: 400 })
    }
    const deployAt = parsed.data.deployAt ? new Date(parsed.data.deployAt) : null
    if (deployAt && Number.isNaN(deployAt.getTime())) {
      return NextResponse.json({ error: 'Invalid deploy date.' }, { status: 400 })
    }
    const recurrenceUntil = parsed.data.recurrenceUntil ? new Date(parsed.data.recurrenceUntil) : null
    if (recurrenceUntil && Number.isNaN(recurrenceUntil.getTime())) {
      return NextResponse.json({ error: 'Invalid recurrence end date.' }, { status: 400 })
    }
    if (parsed.data.walletAddress && !isAddress(parsed.data.walletAddress)) {
      return NextResponse.json({ error: 'Invalid wallet address.' }, { status: 400 })
    }

    const { data, error } = await EventCreationRepository.updateDraftCoreFields({
      draftId: id,
      userId: currentUser.id,
      updatedByUserId: currentUser.id,
      title: parsed.data.title,
      slug: parsed.data.slug,
      titleTemplate: parsed.data.titleTemplate,
      slugTemplate: parsed.data.slugTemplate,
      startAt,
      deployAt,
      endDate,
      walletAddress: parsed.data.walletAddress ? getAddress(parsed.data.walletAddress).toLowerCase() : null,
      status: parsed.data.status,
      recurrenceUnit: parsed.data.recurrenceUnit,
      recurrenceInterval: parsed.data.recurrenceInterval ?? null,
      recurrenceUntil,
      draftPayload: parsed.data.draftPayload ?? null,
      assetPayload: typeof parsed.data.assetPayload !== 'undefined'
        ? normalizeEventCreationAssetPayload(parsed.data.assetPayload)
        : undefined,
      mainCategorySlug: parsed.data.mainCategorySlug,
      categorySlugs: parsed.data.categorySlugs?.map(item => item.trim().toLowerCase()),
      marketMode: parsed.data.marketMode ?? null,
      binaryQuestion: parsed.data.binaryQuestion ?? null,
      binaryOutcomeYes: parsed.data.binaryOutcomeYes ?? null,
      binaryOutcomeNo: parsed.data.binaryOutcomeNo ?? null,
      resolutionSource: parsed.data.resolutionSource ?? null,
      resolutionRules: parsed.data.resolutionRules ?? null,
    })

    if (error) {
      return NextResponse.json({ error }, { status: error === 'Draft not found.' ? 404 : 500 })
    }

    return NextResponse.json({ data })
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        error: DEFAULT_ERROR_MESSAGE,
        ...(process.env.NODE_ENV !== 'production'
          ? { detail: error instanceof Error ? error.message : String(error) }
          : {}),
      },
      { status: 500 },
    )
  }
}
