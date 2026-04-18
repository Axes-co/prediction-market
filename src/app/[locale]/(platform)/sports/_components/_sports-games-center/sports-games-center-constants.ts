import type { SportsGamesMarketType } from './sports-games-center-types'

export const MARKET_COLUMNS: Array<{ key: SportsGamesMarketType, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
]

export const COLLAPSED_MARKET_COLUMNS: Array<{ key: SportsGamesMarketType, label: string }> = [
  { key: 'moneyline', label: 'Moneyline' },
  { key: 'binary', label: 'Market' },
  { key: 'btts', label: 'Both Teams to Score' },
  { key: 'spread', label: 'Spread' },
  { key: 'total', label: 'Total' },
]

export const MARKET_COLUMN_BY_KEY = new Map(
  [...MARKET_COLUMNS, ...COLLAPSED_MARKET_COLUMNS].map(column => [column.key, column]),
)

export const headerIconButtonClass = `
  flex size-10 items-center justify-center rounded-sm border border-transparent bg-transparent text-foreground
  transition-colors
  hover:bg-muted/80 focus-visible:ring-1 focus-visible:ring-ring md:h-9 md:w-9
`

export const SPORTS_EVENT_ODDS_FORMAT_STORAGE_KEY = 'sports:event:odds-format'
export const SPORTS_GAMES_SHOW_SPREADS_TOTALS_STORAGE_KEY = 'sports:games:show-spreads-totals'
export const SPORTS_LIVE_FALLBACK_WINDOW_MS = 2 * 60 * 60 * 1000

export const HERO_LEGEND_LABEL_GAP_PX = 8
export const HERO_LEGEND_RIGHT_INSET_PX = 4
export const HERO_LEGEND_MIN_WIDTH_PX = 72
export const HERO_LEGEND_NAME_PADDING_PX = 10
export const HERO_LEGEND_NAME_LINE_HEIGHT_PX = 18
export const HERO_LEGEND_VALUE_LINE_HEIGHT_PX = 32
export const HERO_LEGEND_MIN_HEIGHT_PX = 56
export const HERO_LEGEND_VERTICAL_GAP_PX = 10

export const TRADE_FLOW_MAX_ITEMS = 6
export const TRADE_FLOW_TTL_MS = 8000
export const TRADE_FLOW_CLEANUP_INTERVAL_MS = 500

export const tradeFlowTextStrokeStyle = {
  textShadow: `
    1px 0 0 var(--background),
    -1px 0 0 var(--background),
    0 1px 0 var(--background),
    0 -1px 0 var(--background),
    1px 1px 0 var(--background),
    -1px -1px 0 var(--background),
    1px -1px 0 var(--background),
    -1px 1px 0 var(--background)
  `,
} as const

export const GENERIC_SPORTS_CATEGORY_LABELS = new Set([
  'esports',
  'sports',
  'games',
  'live',
  'in play',
  'inplay',
  'today',
  'tomorrow',
])

export const FRANCHISE_MULTI_WORD_NICKNAME_PREFIXES = new Set([
  'blue',
  'golden',
  'maple',
  'red',
  'trail',
  'white',
])

export const COMPACT_COMBAT_TRADE_HEADER_SPORT_SLUGS = new Set([
  'boxing',
  'chess',
  'mma',
  'ufc',
  'zuffa',
])

export const COMPACT_FRANCHISE_TRADE_HEADER_SPORT_SLUGS = new Set([
  'mlb',
  'nba',
  'nfl',
  'nhl',
  'wnba',
])
