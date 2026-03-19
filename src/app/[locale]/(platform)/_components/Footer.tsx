'use client'

import { ChevronDownIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useMemo, useState } from 'react'
import FooterLocaleSwitcher from '@/app/[locale]/(platform)/_components/FooterLocaleSwitcher'
import { usePlatformNavigationData } from '@/app/[locale]/(platform)/_providers/PlatformNavigationProvider'
import IntentPrefetchLink from '@/components/IntentPrefetchLink'
import SiteLogoIcon from '@/components/SiteLogoIcon'
import { Separator } from '@/components/ui/separator'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

const INITIAL_CATEGORY_COUNT = 12

type SocialField = 'discordLink' | 'twitterLink' | 'facebookLink' | 'instagramLink' | 'tiktokLink' | 'linkedinLink' | 'youtubeLink'

function TwitterIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.2719 1.58655H18.0831L11.9414 8.60612L19.1667 18.1582H13.5094L9.07837 12.3649L4.0083 18.1582H1.19537L7.76454 10.65L0.833344 1.58655H6.63427L10.6395 6.88182L15.2719 1.58655ZM14.2853 16.4755H15.843L5.78784 3.18082H4.11623L14.2853 16.4755Z" fill="currentColor" />
    </svg>
  )
}

function DiscordIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.9308 3.46302C15.6561 2.87812 14.2892 2.44719 12.8599 2.20038C12.8339 2.19561 12.8079 2.20752 12.7945 2.23133C12.6187 2.544 12.4239 2.95192 12.2876 3.27254C10.7503 3.0424 9.22099 3.0424 7.71527 3.27254C7.57887 2.94479 7.37707 2.544 7.20048 2.23133C7.18707 2.20831 7.16107 2.19641 7.13504 2.20038C5.70659 2.4464 4.33963 2.87733 3.06411 3.46302C3.05307 3.46778 3.04361 3.47572 3.03732 3.48603C0.444493 7.35967 -0.265792 11.1381 0.0826501 14.8697C0.0842267 14.8879 0.0944749 14.9054 0.108665 14.9165C1.81934 16.1728 3.47642 16.9354 5.10273 17.441C5.12876 17.4489 5.15634 17.4394 5.1729 17.4179C5.55761 16.8926 5.90054 16.3387 6.19456 15.7561C6.21192 15.722 6.19535 15.6815 6.15989 15.668C5.61594 15.4617 5.098 15.2101 4.59978 14.9244C4.56037 14.9014 4.55721 14.845 4.59347 14.8181C4.69831 14.7395 4.80318 14.6578 4.9033 14.5752C4.92141 14.5601 4.94665 14.557 4.96794 14.5665C8.24107 16.0609 11.7846 16.0609 15.0191 14.5665C15.0404 14.5562 15.0657 14.5594 15.0846 14.5744C15.1847 14.657 15.2896 14.7395 15.3952 14.8181C15.4314 14.845 15.4291 14.9014 15.3897 14.9244C14.8914 15.2157 14.3735 15.4617 13.8288 15.6672C13.7933 15.6807 13.7775 15.722 13.7949 15.7561C14.0952 16.3378 14.4381 16.8918 14.8157 17.4172C14.8315 17.4394 14.8599 17.4489 14.8859 17.441C16.5201 16.9354 18.1772 16.1728 19.8879 14.9165C19.9028 14.9054 19.9123 14.8887 19.9139 14.8705C20.3309 10.5563 19.2154 6.80891 16.9568 3.48682C16.9513 3.47572 16.9419 3.46778 16.9308 3.46302ZM6.68335 12.5975C5.69792 12.5975 4.88594 11.6928 4.88594 10.5818C4.88594 9.47068 5.68217 8.56598 6.68335 8.56598C7.69239 8.56598 8.49651 9.47862 8.48073 10.5818C8.48073 11.6928 7.68451 12.5975 6.68335 12.5975ZM13.329 12.5975C12.3435 12.5975 11.5316 11.6928 11.5316 10.5818C11.5316 9.47068 12.3278 8.56598 13.329 8.56598C14.338 8.56598 15.1421 9.47862 15.1264 10.5818C15.1264 11.6928 14.338 12.5975 13.329 12.5975Z" fill="currentColor" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 1.80078C12.6719 1.80078 12.9883 1.8125 14.0391 1.85937C15.0156 1.90234 15.543 2.06641 15.8945 2.20313C16.3594 2.38281 16.6953 2.60156 17.043 2.94922C17.3945 3.30078 17.6094 3.63281 17.7891 4.09766C17.9258 4.44922 18.0898 4.98047 18.1328 5.95313C18.1797 7.00781 18.1914 7.32422 18.1914 9.99219C18.1914 12.6641 18.1797 12.9805 18.1328 14.0313C18.0898 15.0078 17.9258 15.5352 17.7891 15.8867C17.6094 16.3516 17.3906 16.6875 17.043 17.0352C16.6914 17.3867 16.3594 17.6016 15.8945 17.7813C15.543 17.918 15.0117 18.082 14.0391 18.125C12.9844 18.1719 12.668 18.1836 10 18.1836C7.32813 18.1836 7.01172 18.1719 5.96094 18.125C4.98438 18.082 4.45703 17.918 4.10547 17.7813C3.64063 17.6016 3.30469 17.3828 2.95703 17.0352C2.60547 16.6836 2.39063 16.3516 2.21094 15.8867C2.07422 15.5352 1.91016 15.0039 1.86719 14.0313C1.82031 12.9766 1.80859 12.6602 1.80859 9.99219C1.80859 7.32031 1.82031 7.00391 1.86719 5.95313C1.91016 4.97656 2.07422 4.44922 2.21094 4.09766C2.39063 3.63281 2.60938 3.29688 2.95703 2.94922C3.30859 2.59766 3.64063 2.38281 4.10547 2.20313C4.45703 2.06641 4.98828 1.90234 5.96094 1.85937C7.01172 1.8125 7.32813 1.80078 10 1.80078ZM10 0C7.28516 0 6.94531 0.0117188 5.87891 0.0585938C4.81641 0.105469 4.08594 0.277344 3.45313 0.523437C2.79297 0.78125 2.23438 1.12109 1.67969 1.67969C1.12109 2.23438 0.78125 2.79297 0.523438 3.44922C0.277344 4.08594 0.105469 4.8125 0.0585938 5.875C0.0117188 6.94531 0 7.28516 0 10C0 12.7148 0.0117188 13.0547 0.0585938 14.1211C0.105469 15.1836 0.277344 15.9141 0.523438 16.5469C0.78125 17.207 1.12109 17.7656 1.67969 18.3203C2.23438 18.875 2.79297 19.2188 3.44922 19.4727C4.08594 19.7188 4.8125 19.8906 5.875 19.9375C6.94141 19.9844 7.28125 19.9961 9.99609 19.9961C12.7109 19.9961 13.0508 19.9844 14.1172 19.9375C15.1797 19.8906 15.9102 19.7188 16.543 19.4727C17.1992 19.2188 17.7578 18.875 18.3125 18.3203C18.8672 17.7656 19.2109 17.207 19.4648 16.5508C19.7109 15.9141 19.8828 15.1875 19.9297 14.125C19.9766 13.0586 19.9883 12.7188 19.9883 10.0039C19.9883 7.28906 19.9766 6.94922 19.9297 5.88281C19.8828 4.82031 19.7109 4.08984 19.4648 3.45703C19.2188 2.79297 18.8789 2.23438 18.3203 1.67969C17.7656 1.125 17.207 0.78125 16.5508 0.527344C15.9141 0.28125 15.1875 0.109375 14.125 0.0625C13.0547 0.0117188 12.7148 0 10 0Z" fill="currentColor" />
      <path d="M10 4.86328C7.16406 4.86328 4.86328 7.16406 4.86328 10C4.86328 12.8359 7.16406 15.1367 10 15.1367C12.8359 15.1367 15.1367 12.8359 15.1367 10C15.1367 7.16406 12.8359 4.86328 10 4.86328ZM10 13.332C8.16016 13.332 6.66797 11.8398 6.66797 10C6.66797 8.16016 8.16016 6.66797 10 6.66797C11.8398 6.66797 13.332 8.16016 13.332 10C13.332 11.8398 11.8398 13.332 10 13.332Z" fill="currentColor" />
      <path d="M16.5391 4.66016C16.5391 5.32422 16 5.85938 15.3398 5.85938C14.6758 5.85938 14.1406 5.32031 14.1406 4.66016C14.1406 3.99609 14.6797 3.46094 15.3398 3.46094C16 3.46094 16.5391 4 16.5391 4.66016Z" fill="currentColor" />
    </svg>
  )
}

function TikTokIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14.2271 0H10.8565V13.6232C10.8565 15.2464 9.56018 16.5797 7.94691 16.5797C6.33363 16.5797 5.03726 15.2464 5.03726 13.6232C5.03726 12.029 6.30483 10.7246 7.8605 10.6667V7.24639C4.43229 7.30433 1.66669 10.1159 1.66669 13.6232C1.66669 17.1594 4.4899 20 7.97573 20C11.4615 20 14.2847 17.1304 14.2847 13.6232V6.63767C15.5523 7.56522 17.1079 8.11594 18.75 8.14494V4.72464C16.2149 4.63768 14.2271 2.55072 14.2271 0Z" fill="currentColor" />
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.47691 20H0.33046V6.64778H4.47691V20ZM2.40149 4.82656C1.07541 4.82656 0 3.72768 0 2.40156C0 1.76349 0.253456 1.15152 0.704575 0.700406C1.15569 0.249291 1.76767 -0.00415039 2.40571 -0.00415039C3.04376 -0.00415039 3.65574 0.249291 4.10686 0.700406C4.55797 1.15152 4.81143 1.76349 4.81143 2.40156C4.81143 3.72768 3.73557 4.82656 2.40149 4.82656ZM19.9955 20H15.8579V13.5001C15.8579 11.9508 15.8266 9.96433 13.7023 9.96433C11.5468 9.96433 11.2162 11.6469 11.2162 13.3873V20H7.07421V6.64778H11.0504V8.46901H11.1083C11.6627 7.41679 13.0147 6.30902 15.0325 6.30902C19.2279 6.30902 20 9.07573 20 12.6652V20H19.9955Z" fill="currentColor" />
    </svg>
  )
}

function YouTubeIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M19.5822 5.18182C19.3522 4.31818 18.6822 3.63636 17.8322 3.40909C16.2622 3 10.0022 3 10.0022 3C10.0022 3 3.7422 3 2.1722 3.40909C1.3222 3.63636 0.6522 4.31818 0.4222 5.18182C0.0022 6.77273 0.0022 10.0909 0.0022 10.0909C0.0022 10.0909 0.0022 13.4091 0.4222 15C0.6522 15.8636 1.3222 16.5 2.1722 16.7273C3.7422 17.1364 10.0022 17.1364 10.0022 17.1364C10.0022 17.1364 16.2622 17.1364 17.8322 16.7273C18.6822 16.5 19.3522 15.8636 19.5822 15C20.0022 13.4091 20.0022 10.0909 20.0022 10.0909C20.0022 10.0909 20.0022 6.77273 19.5822 5.18182ZM8.0022 13.0909V7.09091L13.2022 10.0909L8.0022 13.0909Z" fill="currentColor" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="size-[18px]" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M20 10C20 4.47715 15.5229 0 10 0C4.47715 0 0 4.47715 0 10C0 14.9912 3.65684 19.1283 8.4375 19.8785V12.8906H5.89844V10H8.4375V7.79688C8.4375 5.29063 9.93047 3.90625 12.2146 3.90625C13.3084 3.90625 14.4531 4.10156 14.4531 4.10156V6.5625H13.1922C11.95 6.5625 11.5625 7.3334 11.5625 8.125V10H14.3359L13.8926 12.8906H11.5625V19.8785C16.3432 19.1283 20 14.9912 20 10Z" fill="currentColor" />
    </svg>
  )
}

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
