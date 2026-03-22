import type { EmbedTheme } from '@/lib/embed-theme'

export type EmbedCodeFormat = 'default' | 'standard' | 'minimal'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtmlAttr(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&#39;')
}

function appendParam(params: URLSearchParams, key: string, value: string | undefined) {
  const sanitized = value?.trim()
  if (!sanitized || params.has(key)) return
  params.set(key, sanitized)
}

// ---------------------------------------------------------------------------
// Embed toggle config
// ---------------------------------------------------------------------------

export interface EmbedToggles {
  showChart: boolean
  showButtons: boolean
  showVolume: boolean
  showYAxis: boolean
  showGridRows: boolean
  showBorder: boolean
}

const EMBED_TOGGLE_DEFAULTS: EmbedToggles = {
  showChart: true,
  showButtons: true,
  showVolume: true,
  showYAxis: true,
  showGridRows: true,
  showBorder: false,
}

// ---------------------------------------------------------------------------
// Build iframe src URL
// ---------------------------------------------------------------------------

export function buildEmbedSrc(
  baseUrl: string,
  slug: string,
  theme: EmbedTheme,
  width: number,
  height: number,
  toggles: Partial<EmbedToggles> = {},
  affiliateCode?: string,
  isEvent?: boolean,
) {
  if (!slug) return ''

  const params = new URLSearchParams({ theme })

  if (isEvent) {
    params.set('event', slug)
    params.set('rotate', 'true')
  }
  else {
    params.set('market', slug)
  }

  params.set('width', String(width))
  params.set('height', String(height))

  // Only include toggles that differ from defaults
  const resolved = { ...EMBED_TOGGLE_DEFAULTS, ...toggles }
  if (!resolved.showChart) params.set('showChart', 'false')
  if (!resolved.showButtons) params.set('showButtons', 'false')
  if (!resolved.showVolume) params.set('showVolume', 'false')
  if (!resolved.showYAxis) params.set('showYAxis', 'false')
  if (!resolved.showGridRows) params.set('showGridRows', 'false')
  if (resolved.showBorder) params.set('showBorder', 'true')

  appendParam(params, 'r', affiliateCode)

  return `${baseUrl}/embed/market?${params.toString()}`
}

export function buildPreviewSrc(
  slug: string,
  theme: EmbedTheme,
  width: number,
  height: number,
  toggles: Partial<EmbedToggles> = {},
  affiliateCode?: string,
  isEvent?: boolean,
) {
  if (!slug) return ''
  return buildEmbedSrc('', slug, theme, width, height, toggles, affiliateCode, isEvent)
}

// ---------------------------------------------------------------------------
// Build embed code (3 formats)
// ---------------------------------------------------------------------------

export interface EmbedCodeOptions {
  src: string
  width: number
  height: number
  title: string
  slug: string
  siteName: string
  siteUrl: string
  question: string
  yesPercent: number
  noPercent: number
  eventUrl: string
}

/**
 * Minimal format — just the iframe tag.
 */
export function buildMinimalEmbedCode(options: EmbedCodeOptions) {
  const safeSrc = escapeHtmlAttr(options.src)
  const safeTitle = escapeHtmlAttr(options.title)

  return [
    '<iframe',
    `\ttitle="${safeTitle}"`,
    `\tsrc="${safeSrc}"`,
    `\twidth="${options.width}"`,
    `\theight="${options.height}"`,
    '\tframeBorder="0"',
    '/>',
  ].join('\n')
}

/**
 * Standard format — iframe with proper attributes.
 */
export function buildStandardEmbedCode(options: EmbedCodeOptions) {
  const safeSrc = escapeHtmlAttr(options.src)
  const safeTitle = escapeHtmlAttr(options.title)

  return [
    '<iframe',
    `\ttitle="${safeTitle}"`,
    `\tsrc="${safeSrc}"`,
    `\twidth="${options.width}"`,
    `\theight="${options.height}"`,
    '\tframeborder="0"',
    '\tallowTransparency="true"',
    '/>',
  ].join('\n')
}

/**
 * Default format — full figure with schema.org JSON-LD, iframe,
 * invisible click overlay, and screen-reader-only figcaption.
 */
export function buildDefaultEmbedCode(options: EmbedCodeOptions) {
  const { src, width, height, title, slug, siteName, siteUrl, question, yesPercent, noPercent, eventUrl } = options
  const safeSrc = escapeHtmlAttr(src)
  const safeTitle = escapeHtmlAttr(title)
  const safeQuestion = escapeHtmlAttr(question)
  const safeSiteName = escapeHtmlAttr(siteName)
  const safeEventUrl = escapeHtmlAttr(eventUrl)
  const figureId = `${safeSiteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slug.replace(/[^a-z0-9-]+/g, '-')}`

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    'name': question,
    'description': `Prediction market: Yes ${yesPercent}% · No ${noPercent}% on ${siteName}.`,
    'url': eventUrl,
    'publisher': {
      '@type': 'Organization',
      'name': siteName,
      'url': siteUrl,
    },
  }, null, 2)

  return `<script type="application/ld+json">
${jsonLd}
</script>
<figure
\tclass="${safeSiteName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-embed"
\tid="${figureId}"
\taria-label="${safeSiteName} prediction market: ${safeQuestion}"
\titemscope
\titemtype="https://schema.org/WebPage"
\tstyle="position:relative;display:inline-block;margin:0">
\t<iframe
\t\ttitle="${safeTitle}"
\t\tsrc="${safeSrc}"
\t\twidth="${width}"
\t\theight="${height}"
\t\tframeborder="0"
\t\tallowTransparency="true">
\t</iframe>
\t<a href="${safeEventUrl}"
\t\taria-label="View on ${safeSiteName}"
\t\ttarget="_blank"
\t\trel="noopener"
\t\tstyle="position:absolute;top:16px;right:20px;width:120px;height:24px;z-index:10">
\t</a>
\t<figcaption style="position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0">
\t\t<strong>${safeQuestion}</strong><br>
\t\tYes ${yesPercent}% · No ${noPercent}%<br>
\t\t<a href="${safeEventUrl}">
\t\t\tView full market &amp; trade on ${safeSiteName}
\t\t</a>
\t</figcaption>
</figure>`
}

/**
 * Build embed code in the specified format.
 */
export function buildEmbedCode(format: EmbedCodeFormat, options: EmbedCodeOptions): string {
  switch (format) {
    case 'minimal': return buildMinimalEmbedCode(options)
    case 'standard': return buildStandardEmbedCode(options)
    case 'default': return buildDefaultEmbedCode(options)
  }
}

export type { EmbedTheme } from '@/lib/embed-theme'
