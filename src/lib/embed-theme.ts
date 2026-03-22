/**
 * Centralized theme configuration for embed widgets.
 *
 * Embed widgets render inside iframes without access to the host app's
 * CSS variables, so they carry their own color palette.  All visual
 * constants live here — nothing is hardcoded inside components.
 */

// ---------------------------------------------------------------------------
// Theme type
// ---------------------------------------------------------------------------

export type EmbedTheme = 'light' | 'dark'

// ---------------------------------------------------------------------------
// Color palette
// ---------------------------------------------------------------------------

export interface EmbedColorPalette {
  /** Card background */
  bg: string
  /** Primary foreground text */
  fg: string
  /** Muted / secondary text (labels, links) */
  muted: string
  /** Grid line / border color */
  border: string
  /** Chart axis label color */
  axisText: string
  /** Price label text-stroke background (makes text readable on chart) */
  priceStrokeBg: string
}

const LIGHT_PALETTE: EmbedColorPalette = {
  bg: '#ffffff',
  fg: '#171717',
  muted: '#6b7280',
  border: '#e5e7eb',
  axisText: '#6b7280',
  priceStrokeBg: 'rgb(255, 255, 255)',
}

const DARK_PALETTE: EmbedColorPalette = {
  bg: '#171717',
  fg: '#ffffff',
  muted: '#737373',
  border: '#333333',
  axisText: '#6b7280',
  priceStrokeBg: 'rgb(26, 26, 26)',
}

export function resolveEmbedPalette(theme: EmbedTheme): EmbedColorPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}

// ---------------------------------------------------------------------------
// Outcome colors
// ---------------------------------------------------------------------------

export interface EmbedOutcomeColorSet {
  bg: string
  bgHover: string
  text: string
}

/** Default binary outcome colors — green for YES, red for NO */
const BINARY_OUTCOME_COLORS: readonly EmbedOutcomeColorSet[] = [
  { bg: 'rgba(34,197,94,0.15)', bgHover: 'rgba(34,197,94,0.25)', text: 'rgb(34,197,94)' },
  { bg: 'rgba(239,68,68,0.15)', bgHover: 'rgba(239,68,68,0.25)', text: 'rgb(239,68,68)' },
] as const

export function resolveOutcomeColors(
  outcomeIndex: number,
  theme: EmbedTheme,
  customColor?: string | null,
): EmbedOutcomeColorSet {
  if (customColor) {
    return {
      bg: `color-mix(in srgb, ${customColor} 15%, transparent)`,
      bgHover: `color-mix(in srgb, ${customColor} 25%, transparent)`,
      text: customColor,
    }
  }

  const preset = BINARY_OUTCOME_COLORS[outcomeIndex]
  if (preset) {
    return preset
  }

  // Deterministic fallback for 3+ outcomes (golden-angle hue spread)
  const hue = (outcomeIndex * 137) % 360
  const lightness = theme === 'dark' ? 65 : 45
  return {
    bg: `hsla(${hue},60%,50%,0.15)`,
    bgHover: `hsla(${hue},60%,50%,0.25)`,
    text: `hsl(${hue},60%,${lightness}%)`,
  }
}

// ---------------------------------------------------------------------------
// Chart line colors
// ---------------------------------------------------------------------------

/**
 * Palette for chart series lines.  Index 0 is the primary series
 * (YES outcome in binary markets), subsequent indices alternate.
 */
const CHART_LINE_COLORS = [
  '#2d9cdb',
  '#ef4444',
  '#22c55e',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
] as const

export function resolveChartLineColor(index: number): string {
  return CHART_LINE_COLORS[index % CHART_LINE_COLORS.length]
}
