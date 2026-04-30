import { sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  char,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  pgView,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { users } from '../auth/tables'

export const conditions = pgTable(
  'conditions',
  {
    id: text().primaryKey(),
    oracle: text().notNull(),
    question_id: text().notNull(),
    resolved: boolean().default(false),
    metadata_hash: text(),
    creator: char('creator', { length: 42 }),
    uma_request_tx_hash: char('uma_request_tx_hash', { length: 66 }),
    uma_request_log_index: integer('uma_request_log_index'),
    uma_oracle_address: char('uma_oracle_address', { length: 42 }),
    mirror_uma_request_tx_hash: char('mirror_uma_request_tx_hash', { length: 66 }),
    mirror_uma_request_log_index: integer('mirror_uma_request_log_index'),
    mirror_uma_oracle_address: char('mirror_uma_oracle_address', { length: 42 }),
    resolution_status: text(),
    resolution_flagged: boolean(),
    resolution_paused: boolean(),
    resolution_last_update: timestamp({ withTimezone: true }),
    resolution_price: numeric({ precision: 20, scale: 6 }),
    resolution_was_disputed: boolean(),
    resolution_approved: boolean(),
    resolution_liveness_seconds: integer(),
    resolution_deadline_at: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const conditions_audit = pgTable(
  'conditions_audit',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    condition_id: text()
      .notNull()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    old_values: jsonb().notNull(),
    new_values: jsonb().notNull(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const events = pgTable(
  'events',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    slug: text()
      .notNull()
      .unique(),
    title: text()
      .notNull(),
    creator: char({ length: 42 }),
    icon_url: text(),
    is_hidden: boolean()
      .notNull()
      .default(false),
    livestream_url: text(),
    show_market_icons: boolean()
      .default(true),
    enable_neg_risk: boolean()
      .default(false),
    neg_risk_augmented: boolean()
      .default(false),
    neg_risk: boolean()
      .default(false),
    show_all_outcomes: boolean()
      .notNull()
      .default(false),
    neg_risk_market_id: char({ length: 66 }),
    gamma_event_id: integer(),
    comment_count: integer().notNull().default(0),
    restricted: boolean().notNull().default(false),
    liquidity_clob: numeric({ precision: 20, scale: 6 }),
    featured: boolean().notNull().default(false),
    featured_order: integer(),
    series_slug: text(),
    series_id: text(),
    series_recurrence: text(),
    status: text()
      .notNull()
      .default('active'),
    rules: text(),
    active_markets_count: integer()
      .default(0),
    total_markets_count: integer()
      .default(0),
    // Gamma response field parity (migration 2026_04_30_002).
    volume: numeric({ precision: 30, scale: 6 }),
    volume_24h: numeric({ precision: 30, scale: 6 }),
    volume_week: numeric({ precision: 30, scale: 6 }),
    volume_month: numeric({ precision: 30, scale: 6 }),
    volume_year: numeric({ precision: 30, scale: 6 }),
    open_interest: numeric({ precision: 30, scale: 6 }),
    liquidity: numeric({ precision: 30, scale: 6 }),
    competitive: numeric({ precision: 10, scale: 6 }),
    ticker: text(),
    enable_order_book: boolean(),
    gamma_active: boolean(),
    gamma_closed: boolean(),
    gamma_archived: boolean(),
    creation_date: timestamp({ withTimezone: true }),
    gamma_updated_at: timestamp({ withTimezone: true }),
    created_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow(),
    start_date: timestamp({ withTimezone: true }),
    end_date: timestamp({ withTimezone: true }),
    resolved_at: timestamp({ withTimezone: true }),
  },
)

export const event_live_chart_configs = pgTable(
  'event_live_chart_configs',
  {
    series_slug: text().primaryKey(),
    topic: text().notNull().default('crypto_prices_chainlink'),
    event_type: text().notNull().default('update'),
    symbol: text().notNull(),
    display_name: text().notNull(),
    display_symbol: text().notNull(),
    line_color: text().notNull().default('#F59E0B'),
    icon_path: text(),
    enabled: boolean().notNull().default(true),
    show_price_decimals: boolean().notNull().default(true),
    active_window_minutes: integer().notNull().default(1440),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

export const series_social_trackers = pgTable(
  'series_social_trackers',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    series_slug: text().notNull(),
    platform: text().notNull().default('X'),
    handle: text().notNull(),
    display_name: text().notNull(),
    is_verified: boolean().notNull().default(false),
    bio: text(),
    is_active: boolean().notNull().default(true),
    priority: smallint().notNull().default(0),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    series_slug_platform_handle_unique: unique('series_social_trackers_series_slug_platform_handle_key').on(
      table.series_slug,
      table.platform,
      table.handle,
    ),
  }),
)

export const event_translations = pgTable(
  'event_translations',
  {
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    locale: text().notNull(),
    title: text().notNull(),
    source_hash: text().notNull(),
    is_manual: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.event_id, table.locale] }),
  }),
)

export const event_creations = pgTable(
  'event_creations',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    created_by_user_id: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    updated_by_user_id: text()
      .references(() => users.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    source_event_id: char({ length: 26 })
      .references(() => events.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    deployed_event_id: char({ length: 26 })
      .references(() => events.id, { onDelete: 'set null', onUpdate: 'cascade' }),
    title: text().notNull().default('Untitled draft'),
    slug: text(),
    title_template: text(),
    slug_template: text(),
    creation_mode: text().notNull().default('single'),
    status: text().notNull().default('draft'),
    start_at: timestamp({ withTimezone: true }),
    deploy_at: timestamp({ withTimezone: true }),
    end_date: timestamp({ withTimezone: true }),
    wallet_address: char({ length: 42 }),
    draft_payload: jsonb().$type<Record<string, unknown> | null>(),
    asset_payload: jsonb().$type<Record<string, unknown> | null>(),
    main_category_slug: text(),
    category_slugs: text().array().notNull().default(sql`'{}'::text[]`),
    market_mode: text(),
    binary_question: text(),
    binary_outcome_yes: text(),
    binary_outcome_no: text(),
    resolution_source: text(),
    resolution_rules: text(),
    recurrence_unit: text(),
    recurrence_interval: integer(),
    recurrence_until: timestamp({ withTimezone: true }),
    pending_request_id: text(),
    pending_payload_hash: char({ length: 66 }),
    pending_chain_id: integer(),
    pending_confirmed_txs: jsonb().$type<Record<string, unknown>[] | null>(),
    last_run_at: timestamp({ withTimezone: true }),
    last_error: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

export const jobs = pgTable(
  'jobs',
  {
    id: char({ length: 26 })
      .primaryKey()
      .default(sql`generate_ulid()`),
    job_type: text().notNull(),
    dedupe_key: text().notNull(),
    payload: jsonb().notNull(),
    status: text().notNull().default('pending'),
    attempts: smallint().notNull().default(0),
    max_attempts: smallint().notNull().default(5),
    available_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    reserved_at: timestamp({ withTimezone: true }),
    last_error: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    job_type_dedupe_key_unique: unique('jobs_job_type_dedupe_key_key').on(table.job_type, table.dedupe_key),
  }),
)

export const markets = pgTable(
  'markets',
  {
    condition_id: text()
      .primaryKey()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    title: text().notNull(),
    slug: text().notNull(),
    short_title: text(),
    question: text(),
    market_rules: text(),
    resolution_source: text(),
    resolution_source_url: text(),
    resolver: char({ length: 42 }),
    neg_risk: boolean().default(false).notNull(),
    neg_risk_other: boolean().default(false).notNull(),
    neg_risk_market_id: char({ length: 66 }),
    neg_risk_request_id: char({ length: 66 }),
    metadata_version: text(),
    metadata_schema: text(),
    icon_url: text(),
    is_active: boolean().default(true).notNull(),
    is_resolved: boolean().default(false).notNull(),
    metadata: text(),
    volume_24h: numeric({ precision: 20, scale: 6 }).default('0').notNull(),
    volume: numeric({ precision: 20, scale: 6 }).default('0').notNull(),
    end_time: timestamp({ withTimezone: true }),
    // Gamma response field parity (migration 2026_04_30_002).
    gamma_market_id: integer(),
    outcome_prices: jsonb().$type<(string | null)[] | null>(),
    last_trade_price: numeric({ precision: 20, scale: 6 }),
    best_bid: numeric({ precision: 20, scale: 6 }),
    best_ask: numeric({ precision: 20, scale: 6 }),
    spread: numeric({ precision: 20, scale: 6 }),
    one_week_price_change: numeric({ precision: 20, scale: 6 }),
    one_month_price_change: numeric({ precision: 20, scale: 6 }),
    competitive: numeric({ precision: 10, scale: 6 }),
    accepting_orders: boolean(),
    accepting_orders_at: timestamp({ withTimezone: true }),
    enable_order_book: boolean(),
    order_price_min_tick_size: numeric({ precision: 10, scale: 6 }),
    order_min_size: numeric({ precision: 20, scale: 6 }),
    group_item_threshold: numeric({ precision: 20, scale: 6 }),
    liquidity: numeric({ precision: 30, scale: 6 }),
    liquidity_clob: numeric({ precision: 30, scale: 6 }),
    volume_week: numeric({ precision: 30, scale: 6 }),
    volume_month: numeric({ precision: 30, scale: 6 }),
    volume_year: numeric({ precision: 30, scale: 6 }),
    volume_clob: numeric({ precision: 30, scale: 6 }),
    volume_24h_clob: numeric({ precision: 30, scale: 6 }),
    volume_week_clob: numeric({ precision: 30, scale: 6 }),
    volume_month_clob: numeric({ precision: 30, scale: 6 }),
    volume_year_clob: numeric({ precision: 30, scale: 6 }),
    uma_bond: numeric({ precision: 30, scale: 6 }),
    uma_reward: numeric({ precision: 30, scale: 6 }),
    fee_type: text(),
    fee_schedule: jsonb().$type<Record<string, unknown> | null>(),
    fees_enabled: boolean(),
    restricted: boolean(),
    featured: boolean(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const market_context_cache = pgTable(
  'market_context_cache',
  {
    condition_id: text()
      .notNull()
      .references(() => markets.condition_id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    locale: text().notNull(),
    context: text().notNull(),
    expires_at: timestamp({ withTimezone: true }).notNull(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
  table => ({
    pk: primaryKey({ columns: [table.condition_id, table.locale] }),
  }),
)

export const event_sports = pgTable(
  'event_sports',
  {
    event_id: char({ length: 26 })
      .primaryKey()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sports_event_id: text(),
    sports_event_slug: text(),
    sports_parent_event_id: bigint({ mode: 'number' }),
    sports_game_id: bigint({ mode: 'number' }),
    sports_event_date: date(),
    sports_start_time: timestamp({ withTimezone: true }),
    sports_series_slug: text(),
    sports_series_id: text(),
    sports_series_recurrence: text(),
    sports_series_color: text(),
    sports_sport_slug: text(),
    sports_league_label: text(),
    sports_league_slug: text(),
    sports_event_week: integer(),
    sports_score: text(),
    sports_period: text(),
    sports_elapsed: text(),
    sports_live: boolean(),
    sports_ended: boolean(),
    sports_tags: jsonb(),
    sports_teams: jsonb(),
    sports_team_logo_urls: jsonb(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const market_sports = pgTable(
  'market_sports',
  {
    condition_id: text()
      .primaryKey()
      .references(() => markets.condition_id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    event_id: char({ length: 26 }).references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    sports_market_type: text(),
    sports_line: numeric({ precision: 20, scale: 8 }),
    sports_group_item_title: text(),
    sports_group_item_threshold: text(),
    sports_game_start_time: timestamp({ withTimezone: true }),
    sports_event_id: bigint({ mode: 'number' }),
    sports_parent_event_id: bigint({ mode: 'number' }),
    sports_game_id: bigint({ mode: 'number' }),
    sports_event_date: date(),
    sports_start_time: timestamp({ withTimezone: true }),
    sports_series_color: text(),
    sports_event_slug: text(),
    sports_teams: jsonb(),
    sports_team_logo_urls: jsonb(),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const sports_menu_items = pgTable(
  'sports_menu_items',
  {
    id: text().primaryKey(),
    item_type: text().notNull(),
    label: text(),
    href: text(),
    icon_url: text(),
    parent_id: text(),
    menu_slug: text(),
    h1_title: text(),
    mapped_tags: jsonb().notNull().default(sql`'[]'::jsonb`),
    url_aliases: jsonb().notNull().default(sql`'[]'::jsonb`),
    games_enabled: boolean().notNull().default(true),
    props_enabled: boolean().notNull().default(true),
    sort_order: integer().notNull().default(0),
    enabled: boolean().notNull().default(true),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const outcomes = pgTable(
  'outcomes',
  {
    condition_id: text()
      .notNull()
      .references(() => conditions.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    outcome_text: text().notNull(),
    outcome_index: smallint().notNull(),
    token_id: text().notNull().primaryKey(),
    is_winning_outcome: boolean().default(false),
    payout_value: numeric({ precision: 20, scale: 6 }),
    // Gamma response field parity (migration 2026_04_30_002). Latest snapshot
    // of the outcome's `outcomePrices[index]` value from the events feed.
    price: numeric({ precision: 10, scale: 6 }),
    created_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp({ withTimezone: true }).defaultNow().notNull(),
  },
)

export const tags = pgTable(
  'tags',
  {
    id: smallint().primaryKey().generatedAlwaysAsIdentity(),
    name: text().notNull().unique(),
    slug: text().notNull().unique(),
    is_main_category: boolean().default(false),
    is_hidden: boolean().notNull().default(false),
    hide_events: boolean().notNull().default(false),
    event_page_note: text(),
    display_order: smallint().default(0),
    active_markets_count: integer().default(0),
    force_show: boolean().notNull().default(false),
    force_hide: boolean().notNull().default(false),
    is_carousel: boolean().notNull().default(false),
    published_at: timestamp({ withTimezone: true }),
    /** Polymarket Gamma's tag id (string). See migration 2026_04_30_003. */
    gamma_tag_id: text(),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

/**
 * Read-mirror of every Polymarket address we observe (gamma comments,
 * data-api activity / holders / leaderboard). Keyed by base EOA so a user
 * with multiple Safes over time stays a single row. Populated opportunistically;
 * never proactively crawled.
 */
export const polymarket_users = pgTable(
  'polymarket_users',
  {
    base_address: text().primaryKey(),
    proxy_wallet: text(),
    pseudonym: text(),
    name: text(),
    display_username_public: boolean(),
    bio: text(),
    profile_image: text(),
    profile_image_optimized: text(),
    first_seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    source: text().notNull(),
  },
)

/**
 * Proxy-wallet-keyed trader directory. Populated by the leaderboard sync.
 * Polymarket V2 identifies traders by their proxy wallet on every public
 * read endpoint (`/v1/leaderboard`, `/positions`, `/holders`, etc.), so this
 * table is the canonical user index for those flows. `polymarket_users`
 * (above) keeps its EOA-based indexing for comment authorship.
 */
export const polymarket_traders = pgTable(
  'polymarket_traders',
  {
    proxy_wallet: text().primaryKey(),
    user_name: text(),
    profile_image: text(),
    x_username: text(),
    verified_badge: boolean(),
    pnl_all: numeric(),
    vol_all: numeric(),
    pnl_month: numeric(),
    vol_month: numeric(),
    pnl_week: numeric(),
    vol_week: numeric(),
    pnl_day: numeric(),
    vol_day: numeric(),
    rank_pnl_all: integer(),
    rank_vol_all: integer(),
    first_seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    last_seen_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    source: text().notNull().default('leaderboard'),
  },
)

/**
 * Axes-native comments. Pre-seeded by the gamma comment cron with
 * `external_source = 'gamma_seed'` (so day-1 events look alive); subsequent
 * user-authored comments use `external_source = 'native'`.
 *
 * `event_id` is our internal ULID; `author_base_address` is normalized lowercase
 * EOA, FK'd into `polymarket_users` so every commenter has a user mirror row.
 */
export const comments = pgTable(
  'comments',
  {
    id: char({ length: 26 }).primaryKey().default(sql`generate_ulid()`),
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    parent_comment_id: char({ length: 26 }),
    author_base_address: text()
      .notNull()
      .references(() => polymarket_users.base_address, { onDelete: 'cascade', onUpdate: 'cascade' }),
    body: text().notNull(),
    reactions_count: integer().notNull().default(0),
    reports_count: integer().notNull().default(0),
    external_source: text().notNull(),
    external_id: text(),
    is_hidden: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
)

export const comment_reactions = pgTable(
  'comment_reactions',
  {
    comment_id: char({ length: 26 })
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reactor_base_address: text()
      .notNull()
      .references(() => polymarket_users.base_address, { onDelete: 'cascade', onUpdate: 'cascade' }),
    reaction_type: text().notNull().default('like'),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.comment_id, table.reactor_base_address, table.reaction_type] }),
  }),
)

export const tag_translations = pgTable(
  'tag_translations',
  {
    tag_id: smallint()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    locale: text().notNull(),
    name: text().notNull(),
    source_hash: text(),
    is_manual: boolean().notNull().default(false),
    created_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    pk: primaryKey({ columns: [table.tag_id, table.locale] }),
  }),
)

export const event_tags = pgTable(
  'event_tags',
  {
    event_id: char({ length: 26 })
      .notNull()
      .references(() => events.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
    tag_id: smallint()
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade', onUpdate: 'cascade' }),
  },
)

export const v_main_tag_subcategories = pgView(
  'v_main_tag_subcategories',
  {
    main_tag_id: integer(),
    main_tag_slug: text(),
    main_tag_name: text(),
    main_tag_is_hidden: boolean(),
    sub_tag_id: integer(),
    sub_tag_name: text(),
    sub_tag_slug: text(),
    sub_tag_is_main_category: boolean(),
    sub_tag_is_hidden: boolean(),
    active_markets_count: integer(),
    last_market_activity_at: timestamp(),
  },
).existing()
