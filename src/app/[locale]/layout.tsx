'use cache'

import type { Metadata, Viewport } from 'next'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { setRequestLocale } from 'next-intl/server'
import { cacheTag } from 'next/cache'
import { notFound } from 'next/navigation'
import PwaInstallStateSync from '@/components/PwaInstallStateSync'
import PwaServiceWorker from '@/components/PwaServiceWorker'
import SiteStructuredData from '@/components/seo/SiteStructuredData'
import TestModeBannerDeferred from '@/components/TestModeBannerDeferred'
import { loadEnabledLocales } from '@/i18n/locale-settings'
import { isRtlLocale } from '@/i18n/locales'
import { routing } from '@/i18n/routing'
import { cacheTags } from '@/lib/cache-tags'
import { openSauceOne } from '@/lib/fonts'
import { IS_TEST_MODE } from '@/lib/network'
import { resolvePwaThemeColors } from '@/lib/pwa-colors'
import siteUrlUtils from '@/lib/site-url'
import { loadRuntimeThemeState } from '@/lib/theme-settings'
import SiteIdentityProvider from '@/providers/SiteIdentityProvider'

const { resolveSiteUrl } = siteUrlUtils

export async function generateViewport(): Promise<Viewport> {
  const runtimeTheme = await loadRuntimeThemeState()
  const { lightSurface, darkSurface } = resolvePwaThemeColors(runtimeTheme.theme)

  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: lightSurface },
      { media: '(prefers-color-scheme: dark)', color: darkSurface },
    ],
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const runtimeTheme = await loadRuntimeThemeState()
  const site = runtimeTheme.site
  const siteUrl = resolveSiteUrl(process.env)

  return {
    metadataBase: new URL(siteUrl),
    title: {
      template: `%s | ${site.name}`,
      default: `${site.name} | ${site.description}`,
    },
    description: site.description,
    applicationName: site.name,
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: site.name,
      statusBarStyle: 'default',
    },
    icons: {
      icon: [
        { url: site.pwaIcon192Url, sizes: '192x192', type: 'image/png' },
        { url: site.pwaIcon512Url, sizes: '512x512', type: 'image/png' },
        { url: site.logoUrl },
      ],
      apple: [{ url: site.appleTouchIconUrl, sizes: '180x180', type: 'image/png' }],
      shortcut: [site.pwaIcon192Url],
    },
    openGraph: {
      type: 'website',
      siteName: site.name,
      title: `${site.name} | ${site.description}`,
      description: site.description,
      url: siteUrl,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${site.name} | ${site.description}`,
      description: site.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        'index': true,
        'follow': true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
  }
}

export async function generateStaticParams() {
  return [{ locale: 'en' }]
}

export default async function LocaleLayout({ params, children }: LayoutProps<'/[locale]'>) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const enabledLocales = await loadEnabledLocales()
  if (!enabledLocales.includes(locale)) {
    notFound()
  }

  const runtimeTheme = await loadRuntimeThemeState()
  cacheTag(cacheTags.settings)

  setRequestLocale(locale)

  return (
    <html
      lang={locale}
      dir={isRtlLocale(locale) ? 'rtl' : 'ltr'}
      className={openSauceOne.variable}
      data-theme-preset={runtimeTheme.theme.presetId}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col font-sans">
        <SiteStructuredData locale={locale} site={runtimeTheme.site} />
        <PwaServiceWorker />
        {runtimeTheme.theme.cssText && <style id="theme-vars" dangerouslySetInnerHTML={{ __html: runtimeTheme.theme.cssText }} />}
        <SiteIdentityProvider site={runtimeTheme.site}>
          <NextIntlClientProvider locale={locale}>
            {IS_TEST_MODE && <TestModeBannerDeferred />}
            <PwaInstallStateSync />
            {children}
          </NextIntlClientProvider>
        </SiteIdentityProvider>
      </body>
    </html>
  )
}
