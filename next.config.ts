import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import { createMDX } from 'fumadocs-mdx/next'
import createNextIntlPlugin from 'next-intl/plugin'
import { getOptimizedImageHostPatterns } from '@/lib/image-optimization'
import siteUrlUtils from './src/lib/site-url'

const { resolveSiteUrl } = siteUrlUtils
const siteUrl = resolveSiteUrl(process.env)
const optimizedImageHostPatterns = getOptimizedImageHostPatterns(process.env)

const config: NextConfig = {
  output: process.env.VERCEL_ENV ? undefined : 'standalone',
  cacheComponents: true,
  typedRoutes: true,
  reactStrictMode: false,
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ['radix-ui'],
    serverActions: {
      bodySizeLimit: '2mb',
    },
    typedEnv: true,
  },
  images: {
    unoptimized: process.env.DISABLE_IMAGE_OPTIMIZATION === 'true',
    loader: 'custom',
    loaderFile: './src/lib/wsrv-image-loader.ts',
    deviceSizes: [256],
    imageSizes: [16, 20, 24, 32, 36, 40, 42, 44, 48, 56, 64, 96, 128],
    remotePatterns: optimizedImageHostPatterns.map(hostname => ({
      protocol: 'https',
      hostname,
      port: '',
      pathname: '/**',
    })),
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Content-Security-Policy',
            value: 'default-src \'self\'; script-src \'self\'',
          },
        ],
      },
      {
        source: '/embed/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=60, stale-while-revalidate=300',
          },
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/docs/:path*.md',
        destination: '/llms.md/:path*',
      },
      {
        source: '/:locale/docs/:path*.md',
        destination: '/llms.md/:path*',
      },
      {
        source: '/sitemaps/:id.xml',
        destination: '/sitemaps/sitemap/:id.xml',
      },
      {
        source: '/@:username',
        destination: '/profile/:username',
      },
      {
        source: '/:locale/@:username',
        destination: '/:locale/profile/:username',
      },
    ]
  },
  env: {
    IS_VERCEL: process.env.VERCEL_ENV ? 'true' : 'false',
    SITE_URL: siteUrl,
    SENTRY_DSN: process.env.SENTRY_DSN,
    REOWN_APPKIT_PROJECT_ID: process.env.REOWN_APPKIT_PROJECT_ID,
    CREATE_MARKET_URL: process.env.CREATE_MARKET_URL ?? 'https://create-market.axes.co',
    GAMMA_URL: process.env.GAMMA_URL ?? 'https://gamma-api.axes.co',
    GEOBLOCK_URL: process.env.GEOBLOCK_URL ?? 'https://geoblock.axes.co',
    CLOB_URL: process.env.CLOB_URL ?? 'https://clob.axes.co',
    RELAYER_URL: process.env.RELAYER_URL ?? 'https://relayer.axes.co',
    DATA_URL: process.env.DATA_URL ?? 'https://data-api.axes.co',
    USER_PNL_URL: process.env.USER_PNL_URL ?? 'https://user-pnl-api.axes.co',
    COMMUNITY_URL: process.env.COMMUNITY_URL ?? 'https://community.axes.co',
    SDK_DOWNLOAD_URL: process.env.SDK_DOWNLOAD_URL ?? 'https://sdk-download.axes.co',
    PRICE_REFERENCE_URL: process.env.PRICE_REFERENCE_URL ?? 'https://price-reference.axes.co',
    WS_CLOB_URL: process.env.WS_CLOB_URL ?? 'wss://ws-subscriptions-clob.axes.co',
    WS_LIVE_DATA_URL: process.env.WS_LIVE_DATA_URL ?? 'wss://ws-live-data.axes.co',
  },
}

const withMDX = createMDX({
  configPath: 'docs.config.ts',
})

const withNextIntl = createNextIntlPlugin({
  experimental: {
    srcPath: './src',
    extract: {
      sourceLocale: 'en',
    },
    messages: {
      path: './src/i18n/messages',
      format: 'json',
      locales: 'infer',
    },
  },
})

export default withSentryConfig(withNextIntl(withMDX(config)), {
  telemetry: false,
})
