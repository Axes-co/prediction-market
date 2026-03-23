import { sanitizeSvg } from '@/lib/utils'

export const THEME_SITE_LOGO_MODES = ['svg', 'image'] as const
export type ThemeSiteLogoMode = typeof THEME_SITE_LOGO_MODES[number]

export const THEME_SITE_SOCIAL_LINK_FIELDS = [
  'discordLink',
  'twitterLink',
  'facebookLink',
  'instagramLink',
  'tiktokLink',
  'linkedinLink',
  'youtubeLink',
  'whatsappLink',
  'telegramLink',
  'redditLink',
] as const
export type ThemeSiteSocialLinkField = typeof THEME_SITE_SOCIAL_LINK_FIELDS[number]

const THEME_SITE_LOGO_MODE_SET = new Set<string>(THEME_SITE_LOGO_MODES)
const DEFAULT_SITE_NAME_FALLBACK = 'Axes'
const DEFAULT_SITE_DESCRIPTION_FALLBACK = 'Decentralized Prediction Markets'
const DEFAULT_SITE_LOGO_SVG_FALLBACK = `
<svg viewBox="0 0 1000 1000" xmlns="http://www.w3.org/2000/svg">
  <g transform="translate(0,1000) scale(0.1,-0.1)" fill="currentColor" stroke="none">
    <path d="M2580 6730 c-20 -20 -20 -33 -20 -1730 0 -1697 0 -1710 20 -1730 20 -20 33 -20 1070 -20 l1050 0 378 473 c208 259 386 478 396 486 12 10 24 12 41 5 14 -5 181 -206 395 -474 204 -256 378 -471 387 -477 13 -10 140 -13 554 -13 296 0 545 3 554 6 24 10 37 51 24 76 -6 12 -415 526 -909 1143 -493 616 -905 1133 -914 1147 -20 30 -11 60 24 78 12 6 200 10 528 10 l510 0 375 468 c206 258 380 478 386 490 13 25 0 66 -24 76 -9 3 -258 6 -554 6 -414 0 -541 -3 -554 -12 -9 -7 -183 -222 -387 -478 -214 -268 -381 -469 -395 -474 -17 -7 -29 -5 -41 5 -10 8 -188 227 -396 487 l-378 472 -1050 0 c-1037 0 -1050 0 -1070 -20z m1063 -162 c30 -27 1740 -2166 1756 -2196 15 -29 14 -39 -9 -62 -19 -19 -33 -20 -533 -20 -396 0 -517 -3 -529 -12 -8 -7 -160 -195 -338 -418 -177 -223 -333 -415 -347 -428 -27 -25 -58 -22 -80 6 -10 12 -13 340 -13 1562 0 1612 -1 1568 40 1583 25 9 28 8 53 -15z"/>
  </g>
</svg>
`

const SVG_ROOT_TAG_PATTERN = /<svg\b[^>]*>/i
const SVG_DIMENSION_ATTR_PATTERN = /\s(?:width|height)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi
const SVG_WIDTH_ATTR_PATTERN = /\swidth\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const SVG_HEIGHT_ATTR_PATTERN = /\sheight\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
const SVG_VIEWBOX_ATTR_PATTERN = /\sviewbox\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/i

export interface ThemeSiteSocialLinks {
  discordLink: string | null
  twitterLink: string | null
  facebookLink: string | null
  instagramLink: string | null
  tiktokLink: string | null
  linkedinLink: string | null
  youtubeLink: string | null
  whatsappLink: string | null
  telegramLink: string | null
  redditLink: string | null
}

export interface ThemeSiteIdentity extends ThemeSiteSocialLinks {
  name: string
  description: string
  logoMode: ThemeSiteLogoMode
  logoSvg: string
  logoImagePath: string | null
  logoImageUrl: string | null
  logoUrl: string
  googleAnalyticsId: string | null
  supportUrl: string | null
  footerDisclaimer: string | null
  pwaIcon192Path: string | null
  pwaIcon512Path: string | null
  pwaIcon192Url: string
  pwaIcon512Url: string
  appleTouchIconUrl: string
}

function sanitizeDefaultLogo() {
  const sanitized = normalizeRootSvgDimensions(sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim())
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return normalizeRootSvgDimensions(sanitizeSvg(DEFAULT_SITE_LOGO_SVG_FALLBACK).trim())
  }

  return sanitized
}

export const DEFAULT_THEME_SITE_NAME = DEFAULT_SITE_NAME_FALLBACK
export const DEFAULT_THEME_SITE_DESCRIPTION = DEFAULT_SITE_DESCRIPTION_FALLBACK
export const DEFAULT_THEME_SITE_LOGO_SVG = sanitizeDefaultLogo()
export const DEFAULT_THEME_SITE_PWA_ICON_192_URL = '/images/pwa/default-icon-192.png'
export const DEFAULT_THEME_SITE_PWA_ICON_512_URL = '/images/pwa/default-icon-512.png'

export function buildSvgDataUri(svg: string) {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export function createDefaultThemeSiteIdentity(): ThemeSiteIdentity {
  const logoSvg = DEFAULT_THEME_SITE_LOGO_SVG

  return {
    name: DEFAULT_THEME_SITE_NAME,
    description: DEFAULT_THEME_SITE_DESCRIPTION,
    logoMode: 'svg',
    logoSvg,
    logoImagePath: null,
    logoImageUrl: null,
    logoUrl: buildSvgDataUri(logoSvg),
    googleAnalyticsId: null,
    discordLink: null,
    twitterLink: null,
    facebookLink: null,
    instagramLink: null,
    tiktokLink: null,
    linkedinLink: null,
    youtubeLink: null,
    whatsappLink: null,
    telegramLink: null,
    redditLink: null,
    supportUrl: null,
    footerDisclaimer: null,
    pwaIcon192Path: null,
    pwaIcon512Path: null,
    pwaIcon192Url: DEFAULT_THEME_SITE_PWA_ICON_192_URL,
    pwaIcon512Url: DEFAULT_THEME_SITE_PWA_ICON_512_URL,
    appleTouchIconUrl: DEFAULT_THEME_SITE_PWA_ICON_192_URL,
  }
}

export function extractXHandle(twitterLink: string | null | undefined): string | null {
  if (!twitterLink) {
    return null
  }
  const match = twitterLink.match(/(?:x\.com|twitter\.com)\/(@?\w+)/i)
  if (!match) {
    return null
  }
  const handle = match[1].replace(/^@/, '')
  return handle ? `@${handle}` : null
}

function normalizeOptionalString(value: string | null | undefined) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return normalized.length > 0 ? normalized : null
}

export function getThemeSiteSameAs(site: Pick<ThemeSiteSocialLinks, ThemeSiteSocialLinkField>) {
  const seen = new Set<string>()
  const sameAs: string[] = []

  for (const field of THEME_SITE_SOCIAL_LINK_FIELDS) {
    const value = site[field]?.trim()
    if (!value || seen.has(value)) {
      continue
    }

    seen.add(value)
    sameAs.push(value)
  }

  return sameAs
}

function extractAttributeValue(match: RegExpMatchArray | null) {
  return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').trim()
}

function parseSvgDimension(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0
    ? Math.round(parsed * 1000) / 1000
    : null
}

function addViewBoxAttribute(svgRootTag: string, viewBoxValue: string) {
  if (svgRootTag.endsWith('/>')) {
    return `${svgRootTag.slice(0, -2)} viewBox="${viewBoxValue}" />`
  }
  return `${svgRootTag.slice(0, -1)} viewBox="${viewBoxValue}">`
}

function normalizeRootSvgDimensions(svg: string) {
  const rootTagMatch = svg.match(SVG_ROOT_TAG_PATTERN)
  if (!rootTagMatch) {
    return svg
  }

  const rootTag = rootTagMatch[0]
  const hasViewBox = SVG_VIEWBOX_ATTR_PATTERN.test(rootTag.toLowerCase())
  const widthValue = parseSvgDimension(extractAttributeValue(rootTag.match(SVG_WIDTH_ATTR_PATTERN)))
  const heightValue = parseSvgDimension(extractAttributeValue(rootTag.match(SVG_HEIGHT_ATTR_PATTERN)))

  let normalizedRootTag = rootTag.replace(SVG_DIMENSION_ATTR_PATTERN, '')

  if (!hasViewBox && widthValue && heightValue) {
    normalizedRootTag = addViewBoxAttribute(normalizedRootTag, `0 0 ${widthValue} ${heightValue}`)
  }

  return svg.replace(rootTag, normalizedRootTag)
}

export function validateThemeSiteGoogleAnalyticsId(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  if (normalized.length > 120) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (!/^G-[A-Z0-9]+$/.test(normalized)) {
    return { value: null, error: `${sourceLabel} has an invalid format.` }
  }

  return { value: normalized, error: null }
}

export function validateThemeSiteExternalUrl(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  if (normalized.length > 2048) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalized) && !/^https?:\/\//i.test(normalized)) {
    return { value: null, error: `${sourceLabel} must start with http:// or https://.` }
  }

  const withProtocol = /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`
  try {
    const parsed = new URL(withProtocol)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { value: null, error: `${sourceLabel} must start with http:// or https://.` }
    }
  }
  catch {
    return { value: null, error: `${sourceLabel} must be a valid URL.` }
  }

  return { value: withProtocol, error: null }
}

export function validateThemeSiteName(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (normalized.length > 80) {
    return { value: null, error: `${sourceLabel} must be at most 80 characters.` }
  }

  return { value: normalized, error: null }
}

export function validateThemeSiteDescription(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (normalized.length > 180) {
    return { value: null, error: `${sourceLabel} must be at most 180 characters.` }
  }

  return { value: normalized, error: null }
}

export function isThemeSiteLogoMode(value: string): value is ThemeSiteLogoMode {
  return THEME_SITE_LOGO_MODE_SET.has(value)
}

export function validateThemeSiteLogoMode(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : ''

  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  if (!isThemeSiteLogoMode(normalized)) {
    return { value: null, error: `${sourceLabel} is invalid.` }
  }

  return { value: normalized, error: null }
}

export function sanitizeThemeSiteLogoSvg(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: null, error: `${sourceLabel} is required.` }
  }

  const sanitized = normalizeRootSvgDimensions(sanitizeSvg(normalized).trim())
  if (!sanitized || !/<svg[\s>]/i.test(sanitized)) {
    return { value: null, error: `${sourceLabel} must be a valid SVG.` }
  }

  if (sanitized.length > 100_000) {
    return { value: null, error: `${sourceLabel} is too large.` }
  }

  return { value: sanitized, error: null }
}

export function validateThemeSiteLogoImagePath(value: string | null | undefined, sourceLabel: string) {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized) {
    return { value: null, error: null }
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return { value: normalized, error: null }
  }

  if (normalized.length > 256) {
    return { value: null, error: `${sourceLabel} is too long.` }
  }

  if (/[^\w./-]/.test(normalized)) {
    return { value: null, error: `${sourceLabel} contains unsupported characters.` }
  }

  return { value: normalized, error: null }
}

export function validateThemeSiteFooterDisclaimer(value: string | null | undefined, sourceLabel: string) {
  const normalized = normalizeOptionalString(value)
  if (!normalized) {
    return { value: null, error: null as string | null }
  }

  if (normalized.length > 2000) {
    return { value: null, error: `${sourceLabel} must be at most 2000 characters.` }
  }

  return { value: normalized, error: null }
}
