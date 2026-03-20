'use client'

import type { ReactNode } from 'react'
import type { SocialPlatform } from '@/lib/social-share'
import type { ThemeSiteIdentity } from '@/lib/theme-site-identity'
import { Loader2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { FacebookIcon, RedditIcon, TelegramIcon, TwitterIcon, WhatsAppIcon } from '@/components/icons/social'
import { Button } from '@/components/ui/button'
import { openSocialShare, resolveSiteTag, SOCIAL_PLATFORM_LABELS } from '@/lib/social-share'

const PLATFORM_ICONS: Record<SocialPlatform, (props: { className?: string }) => ReactNode> = {
  x: TwitterIcon,
  facebook: FacebookIcon,
  whatsapp: WhatsAppIcon,
  telegram: TelegramIcon,
  reddit: RedditIcon,
}

interface SocialShareButtonsProps {
  site: Pick<ThemeSiteIdentity, 'name' | 'twitterLink'>
  buildShareText: (siteTag: string) => string
  shareUrl: string
  disabled?: boolean
  className?: string
}

export function SocialShareButtons({
  site,
  buildShareText,
  shareUrl,
  disabled = false,
  className,
}: SocialShareButtonsProps) {
  const [activePlatform, setActivePlatform] = useState<SocialPlatform | null>(null)

  const handleShare = useCallback((platform: SocialPlatform) => {
    setActivePlatform(platform)
    try {
      const siteTag = platform === 'x' ? resolveSiteTag(site) : site.name
      openSocialShare(platform, { text: buildShareText(siteTag), url: shareUrl })
    }
    finally {
      window.setTimeout(() => setActivePlatform(null), 200)
    }
  }, [buildShareText, shareUrl, site])

  const platforms: SocialPlatform[] = ['x', 'facebook', 'whatsapp', 'telegram', 'reddit']

  return (
    <div className={className}>
      {platforms.map((platform) => {
        const Icon = PLATFORM_ICONS[platform]
        const isActive = activePlatform === platform
        const label = SOCIAL_PLATFORM_LABELS[platform]
        return (
          <Button
            key={platform}
            type="button"
            variant="outline"
            size="icon"
            className="size-9"
            onClick={() => handleShare(platform)}
            disabled={disabled || activePlatform !== null}
            aria-label={`Share on ${label}`}
            title={label}
          >
            {isActive
              ? <Loader2Icon className="size-4 animate-spin" />
              : <Icon className="size-4" />}
          </Button>
        )
      })}
    </div>
  )
}
