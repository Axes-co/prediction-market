'use client'

import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import FooterLocaleSwitcher from '@/app/[locale]/(platform)/_components/FooterLocaleSwitcher'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import {
  DiscordIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  RedditIcon,
  TelegramIcon,
  TikTokIcon,
  TwitterIcon,
  WhatsAppIcon,
  YouTubeIcon,
} from '@/components/icons/social'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

const INITIAL_CATEGORY_COUNT = 14

type SocialField = 'twitterLink' | 'discordLink' | 'instagramLink' | 'tiktokLink' | 'linkedinLink' | 'youtubeLink' | 'facebookLink' | 'whatsappLink' | 'telegramLink' | 'redditLink'

const SOCIAL_CONFIG: Array<{ field: SocialField, label: string, icon: React.ReactNode }> = [
  { field: 'twitterLink', label: '\uD835\uDD4F (Twitter)', icon: <TwitterIcon /> },
  { field: 'instagramLink', label: 'Instagram', icon: <InstagramIcon /> },
  { field: 'discordLink', label: 'Discord', icon: <DiscordIcon /> },
  { field: 'tiktokLink', label: 'TikTok', icon: <TikTokIcon /> },
  { field: 'linkedinLink', label: 'LinkedIn', icon: <LinkedInIcon /> },
  { field: 'youtubeLink', label: 'YouTube', icon: <YouTubeIcon /> },
  { field: 'facebookLink', label: 'Facebook', icon: <FacebookIcon /> },
  { field: 'whatsappLink', label: 'WhatsApp', icon: <WhatsAppIcon /> },
  { field: 'telegramLink', label: 'Telegram', icon: <TelegramIcon /> },
  { field: 'redditLink', label: 'Reddit', icon: <RedditIcon /> },
]

const LINK_CLASS = 'text-sm font-medium text-foreground hover:text-muted-foreground transition-colors'
const MUTED_LINK_CLASS = 'text-sm font-medium text-muted-foreground hover:text-muted-foreground/60 transition-colors'

export default function Footer({ year }: { year: number }) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const { tags } = usePlatformNavigationData()
  const [showAllCategories, setShowAllCategories] = useState(false)

  const mainCategories = useMemo(
    () => tags.filter(tag => tag.slug !== 'trending' && tag.slug !== 'new'),
    [tags],
  )

  const visibleCategories = showAllCategories
    ? mainCategories
    : mainCategories.slice(0, INITIAL_CATEGORY_COUNT)

  const hasMoreCategories = mainCategories.length > INITIAL_CATEGORY_COUNT

  const activeSocials = useMemo(
    () => SOCIAL_CONFIG.filter(s => site[s.field]),
    [site],
  )

  return (
    <footer className="w-full bg-background pb-20 lg:pb-0">
      <div className="mx-auto w-full max-w-[1350px] px-4 py-12 lg:px-6 lg:py-16">
        <div className="flex flex-col gap-10">

          {/* Logo & Description */}
          <div className="flex flex-col items-start gap-2">
            <IntentPrefetchLink href="/" className="block">
              <SiteLogoIcon
                logoSvg={site.logoSvg}
                logoImageUrl={site.logoImageUrl}
                alt={`${site.name} logo`}
                className="size-8 text-current [&_svg]:size-8"
                imageClassName="size-8 object-contain"
                size={32}
              />
            </IntentPrefetchLink>
            <p className="text-base font-medium text-foreground">{site.description}</p>
          </div>

          {/* 3-Column Grid */}
          <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1fr_auto_auto] lg:gap-16">

            {/* Categories — dynamic from navigation context (same source as header tabs) */}
            {mainCategories.length > 0 && (
              <div className="col-span-2 flex flex-col lg:col-span-1">
                <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                  {t('Markets by category')}
                </h3>
                <div className="grid grid-cols-2 gap-x-12 gap-y-3 lg:grid-cols-3">
                  {visibleCategories.map(tag => (
                    <IntentPrefetchLink key={tag.slug} href={`/${tag.slug}`} className={LINK_CLASS}>
                      {tag.name}
                      <span className="block text-xs text-muted-foreground/60">
                        {t('Predictions')}
                      </span>
                    </IntentPrefetchLink>
                  ))}
                  {hasMoreCategories && !showAllCategories && (
                    <button
                      type="button"
                      onClick={() => setShowAllCategories(true)}
                      className="
                        flex cursor-pointer items-center gap-1 self-start text-sm font-medium text-muted-foreground
                        transition-colors
                        hover:text-muted-foreground/60
                      "
                    >
                      <span>{t('View more')}</span>
                      <ChevronDownIcon className="size-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Support & Social */}
            <div className="flex flex-col">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {t('Support & Social')}
              </h3>
              <div className="flex flex-col gap-3">
                <IntentPrefetchLink href="/docs/users" className={LINK_CLASS}>
                  {t('Documentation')}
                </IntentPrefetchLink>
                {activeSocials.map(({ field, label }) => (
                  <a
                    key={field}
                    href={site[field]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                  >
                    {label}
                  </a>
                ))}
                {site.supportUrl && (
                  <a href={site.supportUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                    {t('Support')}
                  </a>
                )}
              </div>
            </div>

            {/* Site Links */}
            <div className="flex flex-col">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {site.name}
              </h3>
              <div className="flex flex-col gap-3">
                <IntentPrefetchLink href="/leaderboard" className={LINK_CLASS}>
                  {t('Leaderboard')}
                </IntentPrefetchLink>
                <IntentPrefetchLink href="/docs/api-reference" className={LINK_CLASS}>
                  {t('APIs')}
                </IntentPrefetchLink>
                <IntentPrefetchLink href="/activity" className={LINK_CLASS}>
                  {t('Activity')}
                </IntentPrefetchLink>
                <IntentPrefetchLink href="/docs/users" className={LINK_CLASS}>
                  {t('Documentation')}
                </IntentPrefetchLink>
                <IntentPrefetchLink href="/terms-of-use" className={LINK_CLASS}>
                  {t('Terms of Use')}
                </IntentPrefetchLink>
              </div>
            </div>
          </div>

          {/* Bottom Section */}
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

              {/* Social Icons */}
              {activeSocials.length > 0 && (
                <div className="flex items-center gap-3">
                  {activeSocials.map(({ field, label, icon }) => (
                    <a
                      key={field}
                      href={site[field]!}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={label}
                      className="text-foreground transition-colors hover:text-muted-foreground"
                    >
                      {icon}
                    </a>
                  ))}
                </div>
              )}

              {/* Copyright · Links */}
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted-foreground">
                <span className="text-foreground">
                  {`${site.name} \u00A9 ${year}`}
                </span>
                <span className="text-muted-foreground/40">&middot;</span>
                <IntentPrefetchLink href="/terms-of-use" className={MUTED_LINK_CLASS}>
                  {t('Terms of Use')}
                </IntentPrefetchLink>
                <span className="text-muted-foreground/40">&middot;</span>
                <IntentPrefetchLink href="/docs/users" className={MUTED_LINK_CLASS}>
                  {t('Documentation')}
                </IntentPrefetchLink>
              </div>

              {/* Language Switcher */}
              <FooterLocaleSwitcher />

            </div>

            {/* Disclaimer */}
            {site.footerDisclaimer && (
              <p className="text-xs/relaxed text-muted-foreground/60">
                {site.footerDisclaimer}
              </p>
            )}
          </div>

        </div>
      </div>
    </footer>
  )
}
