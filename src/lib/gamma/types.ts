export interface GammaTag {
  id?: string | number
  label?: string | null
  slug?: string | null
  /** Gamma marks top-level navigation categories with this flag. */
  forceShow?: boolean | null
  /** Gamma's hide-from-default-UI flag (suppresses tag even when active). */
  forceHide?: boolean | null
  /** Gamma marks tags surfaced in the homepage carousel with this flag. */
  isCarousel?: boolean | null
  publishedAt?: string | null
  createdAt?: string | null
  updatedAt?: string | null
}

export interface GammaMarket {
  id?: string
  conditionId?: string | null
  questionID?: string | null
  question?: string | null
  description?: string | null
  slug?: string | null
  outcomes?: string | null
  outcomePrices?: string | null
  clobTokenIds?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  image?: string | null
  icon?: string | null
  closed?: boolean | null
  active?: boolean | null
  archived?: boolean | null
  negRisk?: boolean | null
  negRiskOther?: boolean | null
  negRiskRequestID?: string | null
  marketMakerAddress?: string | null
  submitted_by?: string | null
  resolvedBy?: string | null
  resolutionSource?: string | null
  groupItemTitle?: string | null
  groupItemThreshold?: string | number | null
  volume?: string | number | null
  volume24hr?: string | number | null
  volume1wk?: string | number | null
  volume1mo?: string | number | null
  volume1yr?: string | number | null
  volumeClob?: string | number | null
  volume24hrClob?: string | number | null
  volume1wkClob?: string | number | null
  volume1moClob?: string | number | null
  volume1yrClob?: string | number | null
  liquidity?: string | number | null
  liquidityClob?: string | number | null
  /** Top-of-book + last-fill snapshots bundled with the events response. */
  bestBid?: number | null
  bestAsk?: number | null
  spread?: number | null
  lastTradePrice?: number | null
  oneWeekPriceChange?: number | null
  oneMonthPriceChange?: number | null
  competitive?: number | null
  /** Trade-state flags Polymarket toggles to pause/resume markets. */
  acceptingOrders?: boolean | null
  acceptingOrdersTimestamp?: string | null
  enableOrderBook?: boolean | null
  /** Per-market user-config: minimum tick + minimum order size. */
  orderPriceMinTickSize?: number | null
  orderMinSize?: number | null
  /** UMA dispute parameters. */
  umaBond?: string | number | null
  umaReward?: string | number | null
  /** Fee model (per-market Polymarket overrides). */
  feeType?: string | null
  feeSchedule?: Record<string, unknown> | null
  feesEnabled?: boolean | null
  /** Per-market geo flag (event-level still wins for the page-route gate). */
  restricted?: boolean | null
  featured?: boolean | null
  /** Numeric mirrors some Gamma responses include alongside the string fields. */
  volumeNum?: number | null
  liquidityNum?: number | null
}

export interface GammaEvent {
  id?: string | number
  slug?: string | null
  ticker?: string | null
  title?: string | null
  description?: string | null
  image?: string | null
  icon?: string | null
  startDate?: string | null
  endDate?: string | null
  /** Polymarket sends both `creationDate` (when the event row was created in Gamma) and `createdAt` (last touch). */
  creationDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  closed?: boolean | null
  active?: boolean | null
  archived?: boolean | null
  /** Legacy field name kept for back-compat; current Gamma responses use `negRisk`. */
  enableNegRisk?: boolean | null
  negRiskAugmented?: boolean | null
  negRisk?: boolean | null
  /** Bytes32 id of the parent neg-risk market. Required for V2 order composition on neg-risk events. */
  negRiskMarketID?: string | null
  /** Polymarket flag: when true, render the multi-market chart on the event page. */
  showAllOutcomes?: boolean | null
  showMarketImages?: boolean | null
  /** Tracked count of comments on the event (drives the comment-count badge on event cards). */
  commentCount?: number | null
  /** Per-event geo-restriction flag (Phase 9 second-layer gate alongside IP middleware). */
  restricted?: boolean | null
  /** Whether trading is enabled at the event level (Polymarket pauses pre-launch events). */
  enableOrderBook?: boolean | null
  liquidity?: string | number | null
  liquidityClob?: string | number | null
  /** Volume across time periods (driven by Polymarket card UI). */
  volume?: string | number | null
  volume24hr?: string | number | null
  volume1wk?: string | number | null
  volume1mo?: string | number | null
  volume1yr?: string | number | null
  /** Polymarket's flagship metric — total notional outstanding on this event. */
  openInterest?: string | number | null
  /** "Tightness" coefficient Polymarket exposes for sort. 0..1. */
  competitive?: number | null
  featured?: boolean | null
  featuredOrder?: number | null
  tags?: GammaTag[] | null
  markets?: GammaMarket[] | null
}

export interface GammaKeysetPage {
  events: GammaEvent[]
  nextCursor: string | null
}
