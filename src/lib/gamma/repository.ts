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

/**
 * Single ON CONFLICT DO UPDATE upsert for events. The "listAffectingChange"
 * semantic (used to invalidate the events list cache tag) is preserved by
 * snapshotting the cache-relevant columns before the upsert and diffing them
 * against the mapped values afterwards. Adding new Gamma fields here means
 * extending `EVENT_UPDATE_SET` only — no parallel diff branch to keep in
 * sync.
 */
const EVENT_LIST_AFFECTING_FIELDS = [
  'title',
  'restricted',
  'featured',
  'start_date',
  'end_date',
  'gamma_active',
  'gamma_closed',
  'gamma_archived',
] as const

export async function upsertEvent(mapped: MappedEvent): Promise<EventUpsertResult> {
  const existing = await db
    .select({
      id: eventsTable.id,
      title: eventsTable.title,
      restricted: eventsTable.restricted,
      featured: eventsTable.featured,
      start_date: eventsTable.start_date,
      end_date: eventsTable.end_date,
      gamma_active: eventsTable.gamma_active,
      gamma_closed: eventsTable.gamma_closed,
      gamma_archived: eventsTable.gamma_archived,
    })
    .from(eventsTable)
    .where(eq(eventsTable.slug, mapped.slug))
    .limit(1)

  const insertValues = buildEventInsertValues(mapped)
  const upserted = await db
    .insert(eventsTable)
    .values(insertValues)
    .onConflictDoUpdate({
      target: eventsTable.slug,
      set: buildEventUpdateSet(),
    })
    .returning({ id: eventsTable.id })

  const eventId = upserted[0]?.id
  if (!eventId) {
    throw new Error(`event upsert produced no id for slug ${mapped.slug}`)
  }

  if (!existing[0]) {
    return { eventId, inserted: true, changed: true, listAffectingChange: true }
  }

  const row = existing[0]
  let listAffectingChange = false
  const incomingByField: Record<(typeof EVENT_LIST_AFFECTING_FIELDS)[number], unknown> = {
    title: mapped.title,
    restricted: mapped.restricted,
    featured: mapped.featured,
    start_date: toIso(mapped.startDate),
    end_date: toIso(mapped.endDate),
    gamma_active: mapped.gammaActive,
    gamma_closed: mapped.gammaClosed,
    gamma_archived: mapped.gammaArchived,
  }
  const existingByField: Record<(typeof EVENT_LIST_AFFECTING_FIELDS)[number], unknown> = {
    title: row.title,
    restricted: row.restricted ?? false,
    featured: row.featured ?? false,
    start_date: toIso(row.start_date),
    end_date: toIso(row.end_date),
    gamma_active: row.gamma_active,
    gamma_closed: row.gamma_closed,
    gamma_archived: row.gamma_archived,
  }
  for (const field of EVENT_LIST_AFFECTING_FIELDS) {
    if (incomingByField[field] !== existingByField[field]) {
      listAffectingChange = true
      break
    }
  }

  // We always upsert (new fields like `last_trade_price` change every sync
  // pass), so `changed` is effectively always true. The downstream cache
  // invalidation logic only cares about `listAffectingChange`.
  return { eventId, inserted: false, changed: true, listAffectingChange }
}

function deriveEventStatus(mapped: MappedEvent): 'active' | 'resolved' | 'archived' {
  // Gamma exposes `closed` (resolved/settled) and `archived` (deprecated) on
  // each event. Mirror those to our internal `status` enum so list filters
  // on `events.status = 'active'` keep closed events out of the home page
  // even when the sync also pulls historical events.
  if (mapped.gammaArchived) {
    return 'archived'
  }
  if (mapped.gammaClosed) {
    return 'resolved'
  }
  return 'active'
}

function buildEventInsertValues(mapped: MappedEvent): typeof eventsTable.$inferInsert {
  return {
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
    status: deriveEventStatus(mapped),
    volume: mapped.volume,
    volume_24h: mapped.volume24h,
    volume_week: mapped.volumeWeek,
    volume_month: mapped.volumeMonth,
    volume_year: mapped.volumeYear,
    open_interest: mapped.openInterest,
    liquidity: mapped.liquidity,
    competitive: mapped.competitive,
    ticker: mapped.ticker,
    enable_order_book: mapped.enableOrderBook,
    gamma_active: mapped.gammaActive,
    gamma_closed: mapped.gammaClosed,
    gamma_archived: mapped.gammaArchived,
    creation_date: mapped.creationDate,
    gamma_updated_at: mapped.gammaUpdatedAt,
    created_at: mapped.createdAt,
  }
}

function buildEventUpdateSet() {
  return {
    title: sql`excluded.title`,
    icon_url: sql`excluded.icon_url`,
    rules: sql`excluded.rules`,
    enable_neg_risk: sql`excluded.enable_neg_risk`,
    neg_risk_augmented: sql`excluded.neg_risk_augmented`,
    neg_risk: sql`excluded.neg_risk`,
    show_all_outcomes: sql`excluded.show_all_outcomes`,
    neg_risk_market_id: sql`excluded.neg_risk_market_id`,
    gamma_event_id: sql`excluded.gamma_event_id`,
    comment_count: sql`excluded.comment_count`,
    restricted: sql`excluded.restricted`,
    liquidity_clob: sql`excluded.liquidity_clob`,
    featured: sql`excluded.featured`,
    featured_order: sql`excluded.featured_order`,
    show_market_icons: sql`excluded.show_market_icons`,
    start_date: sql`excluded.start_date`,
    end_date: sql`excluded.end_date`,
    status: sql`excluded.status`,
    volume: sql`excluded.volume`,
    volume_24h: sql`excluded.volume_24h`,
    volume_week: sql`excluded.volume_week`,
    volume_month: sql`excluded.volume_month`,
    volume_year: sql`excluded.volume_year`,
    open_interest: sql`excluded.open_interest`,
    liquidity: sql`excluded.liquidity`,
    competitive: sql`excluded.competitive`,
    ticker: sql`excluded.ticker`,
    enable_order_book: sql`excluded.enable_order_book`,
    gamma_active: sql`excluded.gamma_active`,
    gamma_closed: sql`excluded.gamma_closed`,
    gamma_archived: sql`excluded.gamma_archived`,
    creation_date: sql`excluded.creation_date`,
    gamma_updated_at: sql`excluded.gamma_updated_at`,
    updated_at: sql`NOW()`,
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
        // Gamma response field parity (migration 2026_04_30_002).
        gamma_market_id: sql`excluded.gamma_market_id`,
        outcome_prices: sql`excluded.outcome_prices`,
        last_trade_price: sql`excluded.last_trade_price`,
        best_bid: sql`excluded.best_bid`,
        best_ask: sql`excluded.best_ask`,
        spread: sql`excluded.spread`,
        one_week_price_change: sql`excluded.one_week_price_change`,
        one_month_price_change: sql`excluded.one_month_price_change`,
        competitive: sql`excluded.competitive`,
        accepting_orders: sql`excluded.accepting_orders`,
        accepting_orders_at: sql`excluded.accepting_orders_at`,
        enable_order_book: sql`excluded.enable_order_book`,
        order_price_min_tick_size: sql`excluded.order_price_min_tick_size`,
        order_min_size: sql`excluded.order_min_size`,
        group_item_threshold: sql`excluded.group_item_threshold`,
        liquidity: sql`excluded.liquidity`,
        liquidity_clob: sql`excluded.liquidity_clob`,
        volume_week: sql`excluded.volume_week`,
        volume_month: sql`excluded.volume_month`,
        volume_year: sql`excluded.volume_year`,
        volume_clob: sql`excluded.volume_clob`,
        volume_24h_clob: sql`excluded.volume_24h_clob`,
        volume_week_clob: sql`excluded.volume_week_clob`,
        volume_month_clob: sql`excluded.volume_month_clob`,
        volume_year_clob: sql`excluded.volume_year_clob`,
        uma_bond: sql`excluded.uma_bond`,
        uma_reward: sql`excluded.uma_reward`,
        fee_type: sql`excluded.fee_type`,
        fee_schedule: sql`excluded.fee_schedule`,
        fees_enabled: sql`excluded.fees_enabled`,
        restricted: sql`excluded.restricted`,
        featured: sql`excluded.featured`,
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
    price: outcome.price,
  })))
  if (allOutcomes.length > 0) {
    await db
      .insert(outcomesTable)
      .values(allOutcomes)
      .onConflictDoUpdate({
        target: outcomesTable.token_id,
        set: {
          outcome_text: sql`excluded.outcome_text`,
          outcome_index: sql`excluded.outcome_index`,
          // Use COALESCE so a transient null Gamma response (e.g., during a
          // market pause) doesn't wipe the last known price snapshot.
          price: sql`COALESCE(excluded.price, ${outcomesTable.price})`,
          updated_at: sql`NOW()`,
        },
      })
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
    // Gamma response field parity (migration 2026_04_30_002).
    gamma_market_id: mapped.gammaMarketId,
    outcome_prices: mapped.outcomes.map(outcome => outcome.price),
    last_trade_price: mapped.lastTradePrice,
    best_bid: mapped.bestBid,
    best_ask: mapped.bestAsk,
    spread: mapped.spread,
    one_week_price_change: mapped.oneWeekPriceChange,
    one_month_price_change: mapped.oneMonthPriceChange,
    competitive: mapped.competitive,
    accepting_orders: mapped.acceptingOrders,
    accepting_orders_at: mapped.acceptingOrdersAt,
    enable_order_book: mapped.enableOrderBook,
    order_price_min_tick_size: mapped.orderPriceMinTickSize,
    order_min_size: mapped.orderMinSize,
    group_item_threshold: mapped.groupItemThreshold,
    liquidity: mapped.liquidity,
    liquidity_clob: mapped.liquidityClob,
    volume_week: mapped.volumeWeek,
    volume_month: mapped.volumeMonth,
    volume_year: mapped.volumeYear,
    volume_clob: mapped.volumeClob,
    volume_24h_clob: mapped.volume24hClob,
    volume_week_clob: mapped.volumeWeekClob,
    volume_month_clob: mapped.volumeMonthClob,
    volume_year_clob: mapped.volumeYearClob,
    uma_bond: mapped.umaBond,
    uma_reward: mapped.umaReward,
    fee_type: mapped.feeType,
    fee_schedule: mapped.feeSchedule,
    fees_enabled: mapped.feesEnabled,
    restricted: mapped.restricted,
    featured: mapped.featured,
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
      gamma_tag_id: tagsTable.gamma_tag_id,
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
        gamma_tag_id: tag.gammaTagId,
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
    if (incoming.gammaTagId && !existing.gamma_tag_id) {
      updates.gamma_tag_id = incoming.gammaTagId
    }
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
      gamma_tag_id: tagsTable.gamma_tag_id,
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
        gamma_tag_id: tag.gammaTagId,
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
    if (incoming.gammaTagId && !existing.gamma_tag_id) {
      updates.gamma_tag_id = incoming.gammaTagId
    }
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
