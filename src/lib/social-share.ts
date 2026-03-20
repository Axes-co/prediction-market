import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import { extractXHandle } from '@/lib/theme-site-identity'

export type SocialPlatform = 'x' | 'facebook' | 'whatsapp' | 'telegram' | 'reddit'

interface SocialShareParams {
  text: string
  url: string
}

const SHARE_INTENT_BUILDERS: Record<SocialPlatform, (params: SocialShareParams) => string> = {
  x(params) {
    const intent = new URL('https://x.com/intent/post')
    intent.searchParams.set('text', params.text)
    intent.searchParams.set('url', params.url)
    return intent.toString()
  },
  facebook(params) {
    const intent = new URL('https://www.facebook.com/sharer/sharer.php')
    intent.searchParams.set('u', params.url)
    if (params.text) {
      intent.searchParams.set('quote', params.text)
    }
    return intent.toString()
  },
  whatsapp(params) {
    const message = params.text ? `${params.text}\n${params.url}` : params.url
    const intent = new URL('https://wa.me/')
    intent.searchParams.set('text', message)
    return intent.toString()
  },
  telegram(params) {
    const intent = new URL('https://t.me/share/url')
    intent.searchParams.set('url', params.url)
    if (params.text) {
      intent.searchParams.set('text', params.text)
    }
    return intent.toString()
  },
  reddit(params) {
    const intent = new URL('https://www.reddit.com/submit')
    intent.searchParams.set('url', params.url)
    if (params.text) {
      intent.searchParams.set('title', params.text)
    }
    return intent.toString()
  },
}

export function buildSocialShareUrl(platform: SocialPlatform, params: SocialShareParams): string {
  return SHARE_INTENT_BUILDERS[platform](params)
}

export function openSocialShare(platform: SocialPlatform, params: SocialShareParams): void {
  const url = buildSocialShareUrl(platform, params)
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function resolveSiteTag(site: Pick<ThemeSiteIdentity, 'name' | 'twitterLink'>): string {
  return extractXHandle(site.twitterLink) ?? site.name
}

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  x: 'X',
  facebook: 'Facebook',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  reddit: 'Reddit',
}
