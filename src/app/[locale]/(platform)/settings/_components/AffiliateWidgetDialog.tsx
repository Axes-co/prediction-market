'use client'

import type { EmbedCodeFormat, EmbedToggles } from '@/lib/embed-widget'
import type { EmbedTheme } from '@/lib/embed-theme'
import type { Event } from '@/types'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import EmbedCodeHighlight from '@/components/embed/EmbedCodeHighlight'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'
import { maybeShowAffiliateToast } from '@/lib/affiliate-toast'
import { DEFAULT_EMBED_HEIGHT, DEFAULT_EMBED_WIDTH } from '@/lib/embed-dimensions'
import { buildEmbedCode, buildEmbedSrc, buildPreviewSrc } from '@/lib/embed-widget'
import { buildMarketLabel, normalizeBaseUrl } from '@/lib/embed-utils'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AffiliateWidgetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: {
    slug: string
    name: string
  }[]
  /**
   * When provided, the dialog renders the embed widget for this specific
   * market and hides the category / market selectors.
   */
  eventSlug?: string
}

interface WidgetMarket {
  id: string
  slug: string
  label: string
}

type EmbedLayout = 'standard' | 'banner'

const STANDARD_DIMENSIONS = { width: DEFAULT_EMBED_WIDTH, height: DEFAULT_EMBED_HEIGHT }
const BANNER_DIMENSIONS = { width: 720, height: 80 }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(value: string | undefined, name: string) {
  if (!value || !value.trim()) {
    throw new Error(`${name} is required for embeds.`)
  }
  return value
}

const SITE_URL = normalizeBaseUrl(requireEnv(process.env.SITE_URL, 'SITE_URL'))

async function fetchCategoryMarkets(tag: string, locale: string, signal: AbortSignal): Promise<WidgetMarket[]> {
  const params = new URLSearchParams({
    tag,
    status: 'active',
    offset: '0',
    locale,
  })

  const response = await fetch(`/api/events?${params.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    signal,
  })

  if (!response.ok) {
    throw new Error('Failed to fetch category events.')
  }

  const events = await response.json() as Event[]
  return events
    .flatMap(event => event.markets.map(market => ({
      id: `${event.id}:${market.condition_id}`,
      slug: market.slug,
      label: buildMarketLabel(market),
    })))
    .filter(market => Boolean(market.slug))
    .slice(0, 80)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AffiliateWidgetDialog({
  open,
  onOpenChange,
  categories,
  eventSlug,
}: AffiliateWidgetDialogProps) {
  const t = useExtracted()
  const locale = useLocale()
  const site = useSiteIdentity()
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''

  const [theme, setTheme] = useState<EmbedTheme>('light')
  const [layout, setLayout] = useState<EmbedLayout>('standard')
  const [codeFormat, setCodeFormat] = useState<EmbedCodeFormat>('default')
  const [width, setWidth] = useState<number>(STANDARD_DIMENSIONS.width)
  const [height, setHeight] = useState<number>(STANDARD_DIMENSIONS.height)
  const [toggles, setToggles] = useState<EmbedToggles>({
    showChart: true,
    showButtons: true,
    showVolume: true,
    showYAxis: true,
    showGridRows: true,
    showBorder: false,
  })
  const [copied, setCopied] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [marketsByCategory, setMarketsByCategory] = useState<Record<string, WidgetMarket[]>>({})
  const [loadingCategorySlug, setLoadingCategorySlug] = useState<string | null>(null)
  const [categoryLoadFailed, setCategoryLoadFailed] = useState(false)
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)

  const currentMarkets = useMemo(
    () => marketsByCategory[selectedCategory] ?? [],
    [marketsByCategory, selectedCategory],
  )
  const selectedMarket = eventSlug
    ? { id: eventSlug, slug: eventSlug, label: eventSlug }
    : (currentMarkets.find(market => market.id === selectedMarketId) ?? currentMarkets[0])

  // Reset state on open
  useEffect(() => {
    if (!open) return
    setTheme('light')
    setLayout('standard')
    setCodeFormat('default')
    setWidth(STANDARD_DIMENSIONS.width)
    setHeight(STANDARD_DIMENSIONS.height)
    setToggles({
      showChart: true,
      showButtons: true,
      showVolume: true,
      showYAxis: true,
      showGridRows: true,
      showBorder: false,
    })
    setCopied(false)
    setSelectedCategory(categories[0]?.slug ?? '')
    setSelectedMarketId('')
    setMarketsByCategory({})
    setLoadingCategorySlug(null)
    setCategoryLoadFailed(false)
  }, [open, categories])

  // Sync dimensions when layout changes
  useEffect(() => {
    const dims = layout === 'banner' ? BANNER_DIMENSIONS : STANDARD_DIMENSIONS
    setWidth(dims.width)
    setHeight(dims.height)
  }, [layout])

  // Load affiliate settings
  useEffect(() => {
    if (!affiliateCode) {
      setAffiliateSharePercent(null)
      setTradeFeePercent(null)
      return
    }

    let isActive = true
    fetchAffiliateSettingsFromAPI()
      .then((result) => {
        if (!isActive) return
        if (result.success) {
          const shareParsed = Number.parseFloat(result.data.affiliateSharePercent)
          const feeParsed = Number.parseFloat(result.data.tradeFeePercent)
          setAffiliateSharePercent(Number.isFinite(shareParsed) && shareParsed > 0 ? shareParsed : null)
          setTradeFeePercent(Number.isFinite(feeParsed) && feeParsed > 0 ? feeParsed : null)
        }
        else {
          setAffiliateSharePercent(null)
          setTradeFeePercent(null)
        }
      })
      .catch(() => {
        if (isActive) {
          setAffiliateSharePercent(null)
          setTradeFeePercent(null)
        }
      })

    return () => { isActive = false }
  }, [affiliateCode])

  // Fetch markets when category changes
  useEffect(() => {
    if (!open || !selectedCategory || eventSlug) return
    if (marketsByCategory[selectedCategory] !== undefined) return

    const abortController = new AbortController()
    const categorySlug = selectedCategory
    setLoadingCategorySlug(categorySlug)
    setCategoryLoadFailed(false)

    fetchCategoryMarkets(categorySlug, locale, abortController.signal)
      .then((markets) => {
        setMarketsByCategory(previous => ({ ...previous, [categorySlug]: markets }))
      })
      .catch((error) => {
        if (abortController.signal.aborted) return
        console.error('Failed to fetch affiliate widget markets', error)
        setCategoryLoadFailed(true)
        setMarketsByCategory(previous => ({ ...previous, [categorySlug]: [] }))
      })
      .finally(() => {
        if (!abortController.signal.aborted) {
          setLoadingCategorySlug(current => (current === categorySlug ? null : current))
        }
      })

    return () => { abortController.abort() }
  }, [open, selectedCategory, locale, marketsByCategory, eventSlug])

  // Sync market selection when markets load
  useEffect(() => {
    if (!open) return
    if (currentMarkets.length === 0) {
      setSelectedMarketId('')
      return
    }
    if (!currentMarkets.some(market => market.id === selectedMarketId)) {
      setSelectedMarketId(currentMarkets[0].id)
    }
  }, [open, currentMarkets, selectedMarketId])

  // Build URLs
  const resolvedSlug = eventSlug ?? selectedMarket?.slug ?? ''
  const isEvent = Boolean(eventSlug)

  const embedSrc = useMemo(
    () => buildEmbedSrc(SITE_URL, resolvedSlug, theme, width, height, toggles, affiliateCode, isEvent, locale),
    [resolvedSlug, theme, width, height, toggles, affiliateCode, isEvent, locale],
  )
  const previewUrl = useMemo(
    () => buildPreviewSrc(resolvedSlug, theme, width, height, toggles, affiliateCode, isEvent, locale),
    [resolvedSlug, theme, width, height, toggles, affiliateCode, isEvent, locale],
  )
  const eventUrl = `${SITE_URL}/event/${resolvedSlug}`
  const embedCode = useMemo(
    () => buildEmbedCode(codeFormat, {
      src: embedSrc,
      width,
      height,
      title: `${selectedMarket?.label ?? resolvedSlug} — ${site.name} Prediction Market`,
      slug: resolvedSlug,
      siteName: site.name,
      siteUrl: SITE_URL,
      question: selectedMarket?.label ?? resolvedSlug,
      yesPercent: 50,
      noPercent: 50,
      eventUrl,
    }),
    [codeFormat, embedSrc, width, height, resolvedSlug, selectedMarket?.label, site.name, eventUrl],
  )
  const canCopy = Boolean(resolvedSlug)

  async function handleCopy() {
    if (!canCopy) return
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      maybeShowAffiliateToast({
        affiliateCode,
        affiliateSharePercent,
        tradeFeePercent,
        siteName: site.name,
        context: 'embed',
      })
    }
    catch (error) {
      console.error(error)
    }
  }

  function updateToggle(key: keyof EmbedToggles, value: boolean) {
    setToggles(prev => ({ ...prev, [key]: value }))
  }

  const isLoadingCategory = Boolean(loadingCategorySlug && loadingCategorySlug === selectedCategory)
  const showMarketSelector = !eventSlug && currentMarkets.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-h-[90vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-3',
          'sm:w-full sm:max-w-4xl sm:p-8',
        )}
      >
        <div className="space-y-4 sm:space-y-6">
          <DialogHeader>
            <DialogTitle className="text-center text-2xl font-bold">{t('Embed')}</DialogTitle>
          </DialogHeader>

          <div className="grid items-stretch gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* Left column: controls */}
            <div className="space-y-6">
              {/* Layout switcher */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('LAYOUT')}</Label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1 flex-1 p-2.5 rounded-lg border-2 transition-colors',
                      layout === 'standard'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-muted-foreground/40',
                    )}
                    onClick={() => setLayout('standard')}
                  >
                    <div className={cn(
                      'w-10 h-10 rounded border-[1.5px] flex flex-col p-1.5 gap-0.5',
                      layout === 'standard' ? 'border-primary' : 'border-border',
                    )}>
                      <div className={cn('w-full h-1 rounded-sm', layout === 'standard' ? 'bg-primary' : 'bg-muted-foreground/30')} />
                      <div className={cn('w-[70%] h-0.5 rounded-sm', layout === 'standard' ? 'bg-primary/40' : 'bg-muted-foreground/20')} />
                      <div className={cn('flex-1 w-full rounded-sm', layout === 'standard' ? 'bg-primary/20' : 'bg-muted-foreground/10')} />
                    </div>
                    <span className={cn('text-[11px] font-medium', layout === 'standard' ? 'text-primary' : 'text-muted-foreground')}>
                      {t('Standard')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={cn(
                      'flex flex-col items-center gap-1 flex-1 p-2.5 rounded-lg border-2 transition-colors',
                      layout === 'banner'
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-muted-foreground/40',
                    )}
                    onClick={() => setLayout('banner')}
                  >
                    <div className={cn(
                      'w-16 h-[26px] rounded border-[1.5px] flex items-center p-1 gap-1',
                      layout === 'banner' ? 'border-primary' : 'border-border',
                    )}>
                      <div className={cn('w-3 h-full rounded-sm', layout === 'banner' ? 'bg-primary/30' : 'bg-muted-foreground/20')} />
                      <div className="flex flex-col gap-0.5 flex-1">
                        <div className={cn('w-full h-0.5 rounded-sm', layout === 'banner' ? 'bg-primary/50' : 'bg-muted-foreground/30')} />
                        <div className={cn('w-[60%] h-0.5 rounded-sm', layout === 'banner' ? 'bg-primary/30' : 'bg-muted-foreground/20')} />
                      </div>
                    </div>
                    <span className={cn('text-[11px] font-medium', layout === 'banner' ? 'text-primary' : 'text-muted-foreground')}>
                      {t('Banner')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Category selector */}
              {!eventSlug && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('Categories')}</Label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={categories.length === 0}>
                    <SelectTrigger className="w-full bg-transparent text-sm hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent">
                      <SelectValue placeholder={t('Categories')} />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(category => (
                        <SelectItem key={category.slug} value={category.slug}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Market selector — shown when category has loaded markets */}
              {showMarketSelector && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('MARKET')}</Label>
                  <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                    <SelectTrigger className="w-full bg-transparent text-sm hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentMarkets.map(market => (
                        <SelectItem key={market.id} value={market.id}>{market.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Options */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('OPTIONS')}</Label>
                <div className="rounded-md border border-border p-3">
                  <div className="flex flex-col gap-3 text-sm font-semibold text-foreground">
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Chart')}</span>
                      <Switch checked={toggles.showChart} onCheckedChange={v => updateToggle('showChart', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Buy buttons')}</span>
                      <Switch checked={toggles.showButtons} onCheckedChange={v => updateToggle('showButtons', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Volume')}</span>
                      <Switch checked={toggles.showVolume} onCheckedChange={v => updateToggle('showVolume', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Y Axis')}</span>
                      <Switch checked={toggles.showYAxis} onCheckedChange={v => updateToggle('showYAxis', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Grid rows')}</span>
                      <Switch checked={toggles.showGridRows} onCheckedChange={v => updateToggle('showGridRows', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Border')}</span>
                      <Switch checked={toggles.showBorder} onCheckedChange={v => updateToggle('showBorder', v)} />
                    </label>
                    <label className="flex items-center justify-between gap-4">
                      <span>{t('Dark mode')}</span>
                      <Switch checked={theme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} />
                    </label>
                  </div>
                </div>
              </div>

              {/* Code output */}
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('EMBED CODE')}</Label>
                  <div className="flex items-center gap-2">
                    <Select value={codeFormat} onValueChange={value => setCodeFormat(value as EmbedCodeFormat)}>
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="minimal">Minimal</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button type="button" size="sm" variant="outline" onClick={handleCopy} disabled={!canCopy}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {t('Copy')}
                    </Button>
                  </div>
                </div>
                <div className="overflow-auto rounded-md border border-border bg-muted/70 p-4 max-h-48">
                  {resolvedSlug
                    ? <EmbedCodeHighlight code={embedCode} />
                    : <p className="text-sm text-muted-foreground">{t('No market available for this event')}</p>}
                </div>
              </div>
            </div>

            {/* Right column: preview */}
            <div className="flex h-full flex-col gap-3">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('PREVIEW')}</Label>
              <div
                className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-[#f7f7f9] p-4"
                style={{ minHeight: layout === 'banner' ? '120px' : `${Math.min(height, 400)}px` }}
              >
                {isLoadingCategory
                  ? (
                      <p className="text-sm text-muted-foreground">{t('Searching events...')}</p>
                    )
                  : previewUrl
                    ? (
                        <div
                          className="flex items-center justify-center"
                          style={{
                            width: '100%',
                            height: layout === 'banner' ? `${height}px` : `${Math.min(height, 380)}px`,
                          }}
                        >
                          <iframe
                            title={t('Embed preview')}
                            src={previewUrl}
                            width={width}
                            height={height}
                            frameBorder={0}
                            scrolling="no"
                            className="border-0 bg-transparent"
                            style={{
                              display: 'block',
                              borderRadius: '16px',
                              overflow: 'hidden',
                              transform: `scale(${Math.min(1, 450 / width)})`,
                              transformOrigin: 'center center',
                            }}
                          />
                        </div>
                      )
                    : (
                        <p className="px-4 text-center text-sm text-muted-foreground">
                          {categoryLoadFailed
                            ? t('Unable to load widgets for this category. Please try again later.')
                            : t('No market available for this event')}
                        </p>
                      )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
