/**
 * Layout and dimension constants for embed widgets.
 *
 * These values match the Polymarket embed proportions to ensure
 * visual consistency with industry standards.
 */

// ---------------------------------------------------------------------------
// Card layout
// ---------------------------------------------------------------------------

/** Height threshold below which the component uses a horizontal banner layout */
export const BANNER_HEIGHT_THRESHOLD = 120

/** Default card dimensions (matches Polymarket defaults) */
export const DEFAULT_EMBED_WIDTH = 400
export const DEFAULT_EMBED_HEIGHT = 300
export const MIN_EMBED_WIDTH = 200
export const MAX_EMBED_WIDTH = 1200
export const MIN_EMBED_HEIGHT = 80
export const MAX_EMBED_HEIGHT = 800

/** Card padding by layout mode */
export const CARD_PADDING = '12px 16px' as const
export const CARD_PADDING_MULTI_OUTCOME = '16px 20px 20px' as const
export const BANNER_PADDING = '12px 16px' as const

// ---------------------------------------------------------------------------
// Market icon
// ---------------------------------------------------------------------------

export const MARKET_ICON_SIZE = 48
export const MARKET_ICON_SIZE_PX = '48px'
export const BANNER_ICON_SIZE = 56
export const BANNER_ICON_SIZE_PX = '56px'

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/** Market title font size in card layout */
export const TITLE_FONT_SIZE = '18px'

// ---------------------------------------------------------------------------
// Banner layout
// ---------------------------------------------------------------------------

/** Max width for title block in banner mode */
export const BANNER_TITLE_MAX_WIDTH = '260px'

// ---------------------------------------------------------------------------
// SVG chart
// ---------------------------------------------------------------------------

/** SVG viewBox dimensions by chart context */
export const CHART_VIEWBOX_WIDTH = 1000

/** Viewbox height for full card mode */
export const CHART_VIEWBOX_CARD = 365

/** Viewbox height for banner mode (compact) */
export const CHART_VIEWBOX_BANNER = 209

/** Viewbox height for multi-outcome head-to-head layout */
export const CHART_VIEWBOX_MULTI = 222

/** Chart plot area padding (inside the SVG viewBox) */
export const CHART_PADDING = {
  left: 4,
  right: 56,
  top: 16,
  bottom: 16,
} as const

/** Number of Y-axis tick marks */
export const CHART_AXIS_TICK_COUNT = 3

/** SVG stroke/element sizes (proportional to viewBox) */
export const CHART_GRID_STROKE_WIDTH = 2.72
export const CHART_LINE_STROKE_WIDTH = 5.43
export const CHART_DOT_RADIUS = 9
export const CHART_AXIS_FONT_SIZE = 26

/** Price label overlay (positioned relative to SVG coordinate space) */
export const PRICE_LABEL_FONT_SIZE = '24px'
export const PRICE_LABEL_STROKE_WIDTH = '3px'

/**
 * Scale factors for positioning the floating price label.
 *
 * The price label overlays the SVG as an HTML element.  The SVG has its
 * own coordinate system (viewBox) while the overlaying div uses CSS
 * pixels.  These factors translate SVG coordinates → CSS positioning
 * relative to the chart container so the label tracks the last data point.
 *
 * Derived empirically from Polymarket's embed rendering at 400px width.
 */
export const PRICE_LABEL_X_SCALE = 0.38
export const PRICE_LABEL_Y_SCALE = 0.3

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isBannerLayout(width: number, height: number): boolean {
  return height <= BANNER_HEIGHT_THRESHOLD && width >= 500
}

export function resolveChartViewBoxHeight(
  height: number,
  isMultiOutcome: boolean,
): number {
  if (height <= BANNER_HEIGHT_THRESHOLD) return CHART_VIEWBOX_BANNER
  if (isMultiOutcome) return CHART_VIEWBOX_MULTI
  return CHART_VIEWBOX_CARD
}

export function clampDimension(value: string | undefined, defaultValue: number, min: number, max: number): number {
  if (!value) return defaultValue
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return defaultValue
  return Math.min(max, Math.max(min, parsed))
}
