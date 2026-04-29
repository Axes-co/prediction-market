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
  volume?: string | number | null
  volume24hr?: string | number | null
  volumeClob?: string | number | null
  volume24hrClob?: string | number | null
}

export interface GammaEvent {
  id?: string | number
  slug?: string | null
  title?: string | null
  description?: string | null
  ticker?: string | null
  image?: string | null
  icon?: string | null
  startDate?: string | null
  endDate?: string | null
  createdAt?: string | null
  updatedAt?: string | null
  closed?: boolean | null
  active?: boolean | null
  archived?: boolean | null
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
  liquidity?: string | number | null
  liquidityClob?: string | number | null
  featured?: boolean | null
  featuredOrder?: number | null
  tags?: GammaTag[] | null
  markets?: GammaMarket[] | null
}

export interface GammaKeysetPage {
  events: GammaEvent[]
  nextCursor: string | null
}
