import type { MappedEvent, MappedMarket, MappedTag } from './mapper'
import { eq, inArray, sql } from 'drizzle-orm'
import {
  conditions as conditionsTable,
  events as eventsTable,
  event_tags as eventTagsTable,
  markets as marketsTable,
  outcomes as outcomesTable,
  tags as tagsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

const GAMMA_METADATA_VERSION = 'gamma-v1'
const GAMMA_METADATA_SCHEMA = 'polymarket-gamma'

export interface EventUpsertResult {
  eventId: string
  inserted: boolean
  changed: boolean
  listAffectingChange: boolean
}

export interface MarketUpsertResult {
  changed: boolean
  inserted: boolean
  slugChanged: boolean
}

export interface MarketBatchUpsertResult {
  inserted: number
  updated: number
  urlSetChanged: boolean
}

export async function upsertEvent(mapped: MappedEvent): Promise<EventUpsertResult> {
  const existing = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      icon_url: eventsTable.icon_url,
      enable_neg_risk: eventsTable.enable_neg_risk,
      neg_risk_augmented: eventsTable.neg_risk_augmented,
      neg_risk: eventsTable.neg_risk,
      show_all_outcomes: eventsTable.show_all_outcomes,
      neg_risk_market_id: eventsTable.neg_risk_market_id,
      gamma_event_id: eventsTable.gamma_event_id,
      comment_count: eventsTable.comment_count,
      restricted: eventsTable.restricted,
      liquidity_clob: eventsTable.liquidity_clob,
      featured: eventsTable.featured,
      featured_order: eventsTable.featured_order,
      start_date: eventsTable.start_date,
      end_date: eventsTable.end_date,
      rules: eventsTable.rules,
      show_market_icons: eventsTable.show_market_icons,
    })
    .from(eventsTable)
    .where(eq(eventsTable.slug, mapped.slug))
    .limit(1)

  if (!existing[0]) {
    const inserted = await db
      .insert(eventsTable)
      .values({
        slug: mapped.slug,
        title: mapped.title,
        icon_url: mapped.iconUrl,
        rules: mapped.rules,
        enable_neg_risk: mapped.enableNegRisk,
        neg_risk_augmented: mapped.negRiskAugmented,
        neg_risk: mapped.negRisk,
        show_all_outcomes: mapped.showAllOutcomes,
        neg_risk_market_id: mapped.negRiskMarketId,
        gamma_event_id: mapped.gammaEventId,
        comment_count: mapped.commentCount,
        restricted: mapped.restricted,
        liquidity_clob: mapped.liquidityClob,
        featured: mapped.featured,
        featured_order: mapped.featuredOrder,
        show_market_icons: mapped.showMarketIcons,
        start_date: mapped.startDate,
        end_date: mapped.endDate,
        status: 'active',
        created_at: mapped.createdAt,
      })
      .onConflictDoNothing({ target: eventsTable.slug })
      .returning({ id: eventsTable.id })

    if (inserted[0]?.id) {
      return {
        eventId: inserted[0].id,
        inserted: true,
        changed: true,
        listAffectingChange: true,
      }
    }

    const racedRow = await db
      .select({ id: eventsTable.id })
      .from(eventsTable)
      .where(eq(eventsTable.slug, mapped.slug))
      .limit(1)
    if (!racedRow[0]?.id) {
      throw new Error(`event upsert lost the race and could not relocate slug ${mapped.slug}`)
    }
    return {
      eventId: racedRow[0].id,
      inserted: false,
      changed: false,
      listAffectingChange: false,
    }
  }

  const row = existing[0]
  const updates: Record<string, unknown> = {}
  let changed = false
  let listAffectingChange = false

  if (row.title !== mapped.title) {
    updates.title = mapped.title
    changed = true
    listAffectingChange = true
  }
  if ((row.icon_url ?? null) !== mapped.iconUrl) {
    updates.icon_url = mapped.iconUrl
    changed = true
  }
  if (row.enable_neg_risk !== mapped.enableNegRisk) {
    updates.enable_neg_risk = mapped.enableNegRisk
    changed = true
  }
  if (row.neg_risk_augmented !== mapped.negRiskAugmented) {
    updates.neg_risk_augmented = mapped.negRiskAugmented
    changed = true
  }
  if (row.neg_risk !== mapped.negRisk) {
    updates.neg_risk = mapped.negRisk
    changed = true
  }
  if (row.show_all_outcomes !== mapped.showAllOutcomes) {
    updates.show_all_outcomes = mapped.showAllOutcomes
    changed = true
  }
  if ((row.neg_risk_market_id ?? null) !== mapped.negRiskMarketId) {
    updates.neg_risk_market_id = mapped.negRiskMarketId
    changed = true
  }
  if ((row.gamma_event_id ?? null) !== mapped.gammaEventId) {
    updates.gamma_event_id = mapped.gammaEventId
    changed = true
  }
  if ((row.comment_count ?? 0) !== mapped.commentCount) {
    updates.comment_count = mapped.commentCount
    changed = true
  }
  if ((row.restricted ?? false) !== mapped.restricted) {
    updates.restricted = mapped.restricted
    changed = true
    listAffectingChange = true
  }
  if ((row.liquidity_clob ?? null) !== mapped.liquidityClob) {
    updates.liquidity_clob = mapped.liquidityClob
    changed = true
  }
  if ((row.featured ?? false) !== mapped.featured) {
    updates.featured = mapped.featured
    changed = true
    listAffectingChange = true
  }
  if ((row.featured_order ?? null) !== mapped.featuredOrder) {
    updates.featured_order = mapped.featuredOrder
    changed = true
  }
  if (toIso(row.start_date) !== toIso(mapped.startDate)) {
    updates.start_date = mapped.startDate
    changed = true
    listAffectingChange = true
  }
  if (toIso(row.end_date) !== toIso(mapped.endDate)) {
    updates.end_date = mapped.endDate
    changed = true
    listAffectingChange = true
  }
  if ((row.rules ?? null) !== mapped.rules) {
    updates.rules = mapped.rules
    changed = true
  }
  if (row.show_market_icons !== mapped.showMarketIcons) {
    updates.show_market_icons = mapped.showMarketIcons
    changed = true
  }

  if (changed) {
    updates.updated_at = new Date()
    await db.update(eventsTable).set(updates).where(eq(eventsTable.id, row.id))
  }

  return {
    eventId: row.id,
    inserted: false,
    changed,
    listAffectingChange,
  }
}

export async function upsertMarket(mapped: MappedMarket, eventId: string): Promise<MarketUpsertResult> {
  const result = await upsertMarketsForEvent([mapped], eventId)
  const inserted = result.inserted > 0
  return {
    changed: true,
    inserted,
    slugChanged: result.urlSetChanged,
  }
}

/**
 * Bulk-upsert every market belonging to a single event in three statements:
 * one for conditions, one for markets (with slug-change detection), one for
 * outcomes. Reduces sync round-trips from 3N to 3 per event.
 */
export async function upsertMarketsForEvent(
  mappedMarkets: MappedMarket[],
  eventId: string,
): Promise<MarketBatchUpsertResult> {
  if (mappedMarkets.length === 0) {
    return { inserted: 0, updated: 0, urlSetChanged: false }
  }

  await db
    .insert(conditionsTable)
    .values(mappedMarkets.map(mapped => ({
      id: mapped.conditionId,
      oracle: mapped.oracle,
      question_id: mapped.questionId,
      resolved: mapped.isResolved,
      creator: mapped.creator,
      created_at: mapped.createdAt,
      updated_at: mapped.updatedAt,
    })))
    .onConflictDoUpdate({
      target: conditionsTable.id,
      set: {
        oracle: sql`excluded.oracle`,
        question_id: sql`excluded.question_id`,
        resolved: sql`excluded.resolved`,
        creator: sql`excluded.creator`,
        updated_at: sql`excluded.updated_at`,
      },
    })

  const incomingByCondition = new Map(mappedMarkets.map(mapped => [mapped.conditionId, mapped]))
  const marketRows = mappedMarkets.map(mapped => buildMarketInsertValues(mapped, eventId))

  const upserted = await db
    .insert(marketsTable)
    .values(marketRows)
    .onConflictDoUpdate({
      target: marketsTable.condition_id,
      set: {
        event_id: sql`excluded.event_id`,
        title: sql`excluded.title`,
        slug: sql`excluded.slug`,
        short_title: sql`excluded.short_title`,
        question: sql`excluded.question`,
        market_rules: sql`excluded.market_rules`,
        resolution_source: sql`excluded.resolution_source`,
        resolver: sql`excluded.resolver`,
        neg_risk: sql`excluded.neg_risk`,
        neg_risk_other: sql`excluded.neg_risk_other`,
        neg_risk_request_id: sql`excluded.neg_risk_request_id`,
        metadata_version: sql`excluded.metadata_version`,
        metadata_schema: sql`excluded.metadata_schema`,
        icon_url: sql`excluded.icon_url`,
        is_active: sql`excluded.is_active`,
        is_resolved: sql`excluded.is_resolved`,
        metadata: sql`excluded.metadata`,
        volume_24h: sql`excluded.volume_24h`,
        volume: sql`excluded.volume`,
        end_time: sql`excluded.end_time`,
        updated_at: sql`excluded.updated_at`,
      },
    })
    .returning({
      condition_id: marketsTable.condition_id,
      created_at: marketsTable.created_at,
      slug: marketsTable.slug,
    })

  const allOutcomes = mappedMarkets.flatMap(mapped => mapped.outcomes.map(outcome => ({
    condition_id: mapped.conditionId,
    outcome_text: outcome.outcomeText,
    outcome_index: outcome.outcomeIndex,
    token_id: outcome.tokenId,
  })))
  if (allOutcomes.length > 0) {
    await db
      .insert(outcomesTable)
      .values(allOutcomes)
      .onConflictDoNothing({ target: outcomesTable.token_id })
  }

  let inserted = 0
  let updated = 0
  let urlSetChanged = false
  for (const row of upserted) {
    const incoming = incomingByCondition.get(row.condition_id)
    if (!incoming) {
      continue
    }
    const wasInserted = row.created_at.getTime() === incoming.createdAt.getTime()
    if (wasInserted) {
      inserted += 1
      urlSetChanged = true
    }
    else {
      updated += 1
      if (row.slug !== incoming.slug) {
        urlSetChanged = true
      }
    }
  }

  return { inserted, updated, urlSetChanged }
}

function buildMarketInsertValues(mapped: MappedMarket, eventId: string): typeof marketsTable.$inferInsert {
  return {
    condition_id: mapped.conditionId,
    event_id: eventId,
    title: mapped.title,
    slug: mapped.slug,
    short_title: mapped.shortTitle,
    question: mapped.question,
    market_rules: mapped.description,
    resolution_source: mapped.resolutionSource,
    resolver: mapped.oracle,
    neg_risk: mapped.negRisk,
    neg_risk_other: mapped.negRiskOther,
    neg_risk_request_id: mapped.negRiskRequestId,
    metadata_version: GAMMA_METADATA_VERSION,
    metadata_schema: GAMMA_METADATA_SCHEMA,
    icon_url: mapped.iconUrl,
    is_active: mapped.isActive,
    is_resolved: mapped.isResolved,
    metadata: JSON.stringify(mapped.rawPayload),
    volume_24h: mapped.volume24h,
    volume: mapped.volume,
    end_time: mapped.endTime,
    created_at: mapped.createdAt,
    updated_at: mapped.updatedAt,
  }
}

export interface StandaloneTagsResult {
  inserted: number
  updated: number
}

/**
 * Insert / upgrade tags from a standalone `/tags` fetch. Mirrors the per-tag
 * upgrade rules in `linkEventTags` but skips the `event_tags` link table since
 * standalone tag rows might not yet have any event referencing them.
 */
export async function upsertStandaloneTags(mappedTags: MappedTag[]): Promise<StandaloneTagsResult> {
  if (mappedTags.length === 0) {
    return { inserted: 0, updated: 0 }
  }

  const slugs = mappedTags.map(tag => tag.slug)
  const tagBySlug = new Map(mappedTags.map(tag => [tag.slug, tag] as const))

  const existingTags = await db
    .select({
      id: tagsTable.id,
      slug: tagsTable.slug,
      is_main_category: tagsTable.is_main_category,
      force_show: tagsTable.force_show,
      force_hide: tagsTable.force_hide,
      is_carousel: tagsTable.is_carousel,
      published_at: tagsTable.published_at,
    })
    .from(tagsTable)
    .where(inArray(tagsTable.slug, slugs))

  const existingSlugs = new Set(existingTags.map(tag => tag.slug).filter((slug): slug is string => typeof slug === 'string'))
  const toInsert = mappedTags.filter(tag => !existingSlugs.has(tag.slug))

  let inserted = 0
  if (toInsert.length > 0) {
    const insertedRows = await db
      .insert(tagsTable)
      .values(toInsert.map(tag => ({
        slug: tag.slug,
        name: tag.name,
        is_main_category: tag.isMainCategory,
        force_show: tag.forceShow,
        force_hide: tag.forceHide,
        is_carousel: tag.isCarousel,
        published_at: tag.publishedAt,
      })))
      .onConflictDoNothing({ target: [tagsTable.slug] })
      .returning({ id: tagsTable.id })
    inserted = insertedRows.length
  }

  let updated = 0
  for (const existing of existingTags) {
    const incoming = typeof existing.slug === 'string' ? tagBySlug.get(existing.slug) : undefined
    if (!incoming || typeof existing.id !== 'number') {
      continue
    }
    const updates: Record<string, unknown> = {}
    if (incoming.isMainCategory && existing.is_main_category !== true) {
      updates.is_main_category = true
    }
    if (incoming.forceShow && existing.force_show !== true) {
      updates.force_show = true
    }
    if (incoming.forceHide && existing.force_hide !== true) {
      updates.force_hide = true
    }
    if (incoming.isCarousel && existing.is_carousel !== true) {
      updates.is_carousel = true
    }
    if (incoming.publishedAt && !existing.published_at) {
      updates.published_at = incoming.publishedAt
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date()
      await db.update(tagsTable).set(updates).where(eq(tagsTable.id, existing.id))
      updated += 1
    }
  }

  return { inserted, updated }
}

export async function linkEventTags(eventId: string, mappedTags: MappedTag[]): Promise<void> {
  if (mappedTags.length === 0) {
    return
  }

  const slugs = mappedTags.map(tag => tag.slug)
  const tagBySlug = new Map(mappedTags.map(tag => [tag.slug, tag] as const))
  const tagIdBySlug = new Map<string, number>()

  const existingTags = await db
    .select({
      id: tagsTable.id,
      slug: tagsTable.slug,
      is_main_category: tagsTable.is_main_category,
      force_show: tagsTable.force_show,
      force_hide: tagsTable.force_hide,
      is_carousel: tagsTable.is_carousel,
      published_at: tagsTable.published_at,
    })
    .from(tagsTable)
    .where(inArray(tagsTable.slug, slugs))

  for (const tag of existingTags) {
    if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
      tagIdBySlug.set(tag.slug, tag.id)
    }
  }

  const toInsert = mappedTags.filter(tag => !tagIdBySlug.has(tag.slug))
  if (toInsert.length > 0) {
    const inserted = await db
      .insert(tagsTable)
      .values(toInsert.map(tag => ({
        slug: tag.slug,
        name: tag.name,
        is_main_category: tag.isMainCategory,
        force_show: tag.forceShow,
        force_hide: tag.forceHide,
        is_carousel: tag.isCarousel,
        published_at: tag.publishedAt,
      })))
      .onConflictDoNothing({ target: [tagsTable.slug] })
      .returning({ id: tagsTable.id, slug: tagsTable.slug })

    for (const tag of inserted) {
      if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
        tagIdBySlug.set(tag.slug, tag.id)
      }
    }

    if (tagIdBySlug.size < slugs.length) {
      const refreshed = await db
        .select({ id: tagsTable.id, slug: tagsTable.slug })
        .from(tagsTable)
        .where(inArray(tagsTable.slug, slugs))
      for (const tag of refreshed) {
        if (typeof tag.slug === 'string' && typeof tag.id === 'number') {
          tagIdBySlug.set(tag.slug, tag.id)
        }
      }
    }
  }

  // For pre-existing tags, promote flags only when an observation upgrades them.
  // Never demote: a tag flagged force_show by ANY observation stays force_show.
  for (const existing of existingTags) {
    const incoming = typeof existing.slug === 'string' ? tagBySlug.get(existing.slug) : undefined
    if (!incoming || typeof existing.id !== 'number') {
      continue
    }
    const updates: Record<string, unknown> = {}
    if (incoming.isMainCategory && existing.is_main_category !== true) {
      updates.is_main_category = true
    }
    if (incoming.forceShow && existing.force_show !== true) {
      updates.force_show = true
    }
    if (incoming.forceHide && existing.force_hide !== true) {
      updates.force_hide = true
    }
    if (incoming.isCarousel && existing.is_carousel !== true) {
      updates.is_carousel = true
    }
    if (incoming.publishedAt && !existing.published_at) {
      updates.published_at = incoming.publishedAt
    }
    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date()
      await db.update(tagsTable).set(updates).where(eq(tagsTable.id, existing.id))
    }
  }

  const links = [...tagIdBySlug.values()].map(tagId => ({
    event_id: eventId,
    tag_id: tagId,
  }))
  if (links.length === 0) {
    return
  }

  await db
    .insert(eventTagsTable)
    .values(links)
    .onConflictDoNothing({ target: [eventTagsTable.event_id, eventTagsTable.tag_id] })
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null
}
