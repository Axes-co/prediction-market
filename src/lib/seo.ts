import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { SUPPORTED_LOCALES } from '@/i18n/locales'
import siteUrlUtils from '@/lib/site-url'
import 'server-only'

const { resolveSiteUrl } = siteUrlUtils

// ---------------------------------------------------------------------------
// Hreflang alternates — generates language alternates for all supported locales
// ---------------------------------------------------------------------------

/**
 * Build hreflang alternates for a given path across all supported locales.
 * Used in generateMetadata to tell search engines about language variants.
 *
 * @param path - The path without locale prefix (e.g. '/event/some-slug')
 * @param currentLocale - The current page locale
 */
export function buildHreflangAlternates(
  path: string,
  currentLocale: SupportedLocale,
): Metadata['alternates'] {
  const siteUrl = resolveSiteUrl(process.env)
  const normalizedPath = path === '/' ? '' : path

  const languages: Record<string, string> = {}
  for (const locale of SUPPORTED_LOCALES) {
    languages[locale] = `${siteUrl}/${locale}${normalizedPath}`
  }
  languages['x-default'] = `${siteUrl}/en${normalizedPath}`

  return {
    canonical: `${siteUrl}/${currentLocale}${normalizedPath}`,
    languages,
  }
}

// ---------------------------------------------------------------------------
// Page metadata builders — reusable across all pages
// ---------------------------------------------------------------------------

interface PageMetadataOptions {
  title: string
  description: string
  path: string
  locale: SupportedLocale
  noindex?: boolean
  ogImageUrl?: string
}

/**
 * Build complete page metadata with hreflang, canonical, OG tags, and Twitter cards.
 * Use this for all public-facing pages that need full SEO.
 */
export function buildPageMetadata({
  title,
  description,
  path,
  locale,
  noindex = false,
  ogImageUrl,
}: PageMetadataOptions): Metadata {
  const siteUrl = resolveSiteUrl(process.env)
  const canonicalUrl = `${siteUrl}/${locale}${path === '/' ? '' : path}`

  const metadata: Metadata = {
    title,
    description,
    alternates: buildHreflangAlternates(path, locale),
    openGraph: {
      type: 'website',
      title,
      description,
      url: canonicalUrl,
      siteName: 'Axes',
      ...(ogImageUrl
        ? {
            images: [{
              url: ogImageUrl,
              width: 1200,
              height: 630,
              alt: title,
            }],
          }
        : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(ogImageUrl ? { images: [ogImageUrl] } : {}),
    },
  }

  if (noindex) {
    metadata.robots = { index: false, follow: false }
  }

  return metadata
}

/**
 * Build metadata for pages that should not be indexed (admin, embeds, etc.)
 */
export function buildNoIndexMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false },
  }
}
