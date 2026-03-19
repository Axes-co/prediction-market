'use client'

import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import FooterLocaleSwitcher from '@/app/[locale]/(platform)/_components/FooterLocaleSwitcher'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import {
  DiscordIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedInIcon,
  TikTokIcon,
  TwitterIcon,
  YouTubeIcon,
} from '@/components/icons/social'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Separator } from '@/components/ui/separator'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

const INITIAL_CATEGORY_COUNT = 12

type SocialField = 'discordLink' | 'twitterLink' | 'facebookLink' | 'instagramLink' | 'tiktokLink' | 'linkedinLink' | 'youtubeLink'

const SOCIAL_ICONS: Record<SocialField, React.ReactNode> = {
  twitterLink: <TwitterIcon />,
  discordLink: <DiscordIcon />,
  instagramLink: <InstagramIcon />,
  tiktokLink: <TikTokIcon />,
  linkedinLink: <LinkedInIcon />,
  youtubeLink: <YouTubeIcon />,
  facebookLink: <FacebookIcon />,
}

const SOCIAL_FIELDS: SocialField[] = [
  'twitterLink',
  'discordLink',
  'instagramLink',
  'tiktokLink',
  'linkedinLink',
  'youtubeLink',
  'facebookLink',
]

const LINK_CLASS = 'text-sm font-medium text-foreground transition-colors hover:text-muted-foreground'

export default function Footer({ year }: { year: number }) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const { tags } = usePlatformNavigationData()
  const [showAllCategories, setShowAllCategories] = useState(false)

  const socialLabels: Record<SocialField, string> = {
    twitterLink: t('ftr.twt'),
    discordLink: t('ftr.dsc'),
    instagramLink: t('ftr.ins'),
    tiktokLink: t('ftr.tik'),
    linkedinLink: t('ftr.lnk'),
    youtubeLink: t('ftr.ytb'),
    facebookLink: t('ftr.fbk'),
  }

  const mainCategories = useMemo(
    () => tags.filter(tag => tag.slug !== 'trending' && tag.slug !== 'new'),
    [tags],
  )
  const visibleCategories = showAllCategories
    ? mainCategories
    : mainCategories.slice(0, INITIAL_CATEGORY_COUNT)
  const hasMoreCategories = mainCategories.length > INITIAL_CATEGORY_COUNT

  const activeSocials = useMemo(
    () => SOCIAL_FIELDS.filter(field => site[field]),
    [site],
  )

  return (
    <footer className="mt-12 border-t bg-background">
      <div className="container mx-auto flex flex-col gap-10 py-10">
        {/* Logo & Description */}
        <div className="flex flex-col gap-2">
          <IntentPrefetchLink
            href="/"
            className="flex items-center gap-2 text-xl font-medium text-foreground transition-opacity hover:opacity-80"
          >
            <SiteLogoIcon
              logoSvg={site.logoSvg}
              logoImageUrl={site.logoImageUrl}
              alt={`${site.name} logo`}
              className="size-8 text-current [&_svg]:size-8"
              imageClassName="size-8 object-contain"
              size={32}
            />
            <span>{site.name}</span>
          </IntentPrefetchLink>
          <p className="text-sm text-muted-foreground">{site.description}</p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-[1fr_auto_auto] lg:gap-16">
          {/* Categories */}
          {mainCategories.length > 0 && (
            <div className="col-span-2 flex flex-col lg:col-span-1">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {t('ftr.cat')}
              </h3>
              <div className="grid grid-cols-2 gap-x-12 gap-y-3 lg:grid-cols-3">
                {visibleCategories.map(tag => (
                  <IntentPrefetchLink key={tag.slug} href={`/${tag.slug}`} className={LINK_CLASS}>
                    {tag.name}
                    <span className="block text-xs text-muted-foreground/60">
                      {t('ftr.prd')}
                    </span>
                  </IntentPrefetchLink>
                ))}
                {hasMoreCategories && !showAllCategories && (
                  <button
                    type="button"
                    onClick={() => setShowAllCategories(true)}
                    className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>{t('34Up+l')}</span>
                    <ChevronDownIcon className="size-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Support & Social */}
          {activeSocials.length > 0 && (
            <div className="flex flex-col">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                {t('ftr.soc')}
              </h3>
              <div className="flex flex-col gap-3">
                {site.supportUrl && (
                  <a href={site.supportUrl} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                    {t('ftr.sup')}
                  </a>
                )}
                {activeSocials.map(field => (
                  <a
                    key={field}
                    href={site[field]!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-2 ${LINK_CLASS}`}
                  >
                    {SOCIAL_ICONS[field]}
                    <span>{socialLabels[field]}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Site Links */}
          <div className="flex flex-col">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              {site.name}
            </h3>
            <div className="flex flex-col gap-3">
              <IntentPrefetchLink href="/leaderboard" className={LINK_CLASS}>
                {t('6it6mU')}
              </IntentPrefetchLink>
              <IntentPrefetchLink href="/docs/api-reference" className={LINK_CLASS}>
                {t('XhQrGb')}
              </IntentPrefetchLink>
              <IntentPrefetchLink href="/docs/users" className={LINK_CLASS}>
                {t('isGKnz')}
              </IntentPrefetchLink>
              <IntentPrefetchLink href="/terms-of-use" className={LINK_CLASS}>
                {t('UhkSyx')}
              </IntentPrefetchLink>
            </div>
          </div>
        </div>

        <Separator />

        {/* Bottom Bar */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {activeSocials.length > 0 && (
            <div className="flex items-center gap-3">
              {activeSocials.map(field => (
                <a
                  key={field}
                  href={site[field]!}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={socialLabels[field]}
                  className="text-foreground transition-colors hover:text-muted-foreground"
                >
                  {SOCIAL_ICONS[field]}
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-sm text-muted-foreground">
              {`\u00A9 ${year} ${site.name}`}
            </span>
            <FooterLocaleSwitcher />
          </div>
        </div>
      </div>
    </footer>
  )
}
