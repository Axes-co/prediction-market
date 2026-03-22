'use client'

import type { EmbedCodeFormat, EmbedToggles } from '@/lib/embed-widget'
import type { EmbedTheme } from '@/lib/embed-theme'
import type { Market } from '@/types'
import { CheckIcon, CopyIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
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
import {
  BANNER_HEIGHT_THRESHOLD,
  DEFAULT_EMBED_HEIGHT,
  DEFAULT_EMBED_WIDTH,
} from '@/lib/embed-dimensions'
import { buildEmbedCode, buildEmbedSrc, buildPreviewSrc } from '@/lib/embed-widget'
import { buildMarketLabel, normalizeBaseUrl, normalizeOutcomePrice, toPercent } from '@/lib/embed-utils'
import { cn } from '@/lib/utils'
import { useUser } from '@/stores/useUser'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventChartEmbedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  markets: Market[]
  initialMarketId?: string | null
}

type EmbedLayout = 'standard' | 'banner'

const STANDARD_DIMENSIONS = { width: DEFAULT_EMBED_WIDTH, height: DEFAULT_EMBED_HEIGHT } as const
const BANNER_DIMENSIONS = { width: 720, height: 80 } as const

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

function slugifySiteName(value: string): string {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return slug || 'market'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EventChartEmbedDialog({
  open,
  onOpenChange,
  markets,
  initialMarketId,
}: EventChartEmbedDialogProps) {
  const t = useExtracted()
  const site = useSiteIdentity()
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''

  const [theme, setTheme] = useState<EmbedTheme>('light')
  const [layout, setLayout] = useState<EmbedLayout>('standard')
  const [codeFormat, setCodeFormat] = useState<EmbedCodeFormat>('default')
  const [selectedMarketId, setSelectedMarketId] = useState<string>('')
  const [width, setWidth] = useState(STANDARD_DIMENSIONS.width)
  const [height, setHeight] = useState(STANDARD_DIMENSIONS.height)
  const [toggles, setToggles] = useState<EmbedToggles>({
    showChart: true,
    showButtons: true,
    showVolume: true,
    showYAxis: true,
    showGridRows: true,
    showBorder: false,
  })
  const [copied, setCopied] = useState(false)
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)

  const showMarketSelector = markets.length > 1
  const siteSlug = useMemo(() => slugifySiteName(site.name), [site.name])

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
    setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
  }, [open, initialMarketId, markets])

  // Sync dimensions when layout changes
  useEffect(() => {
    const dims = layout === 'banner' ? BANNER_DIMENSIONS : STANDARD_DIMENSIONS
    setWidth(dims.width)
    setHeight(dims.height)
  }, [layout])

  // Load affiliate settings
  useEffect(() => {
    if (!affiliateCode || !open) {
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
  }, [affiliateCode, open])

  // Sync market selection
  useEffect(() => {
    if (!open) return
    if (!markets.some(m => m.condition_id === selectedMarketId)) {
      setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
    }
  }, [open, markets, selectedMarketId, initialMarketId])

  // Derived state
  const marketOptions = useMemo(
    () => markets.map(m => ({ id: m.condition_id, label: buildMarketLabel(m) })),
    [markets],
  )
  const selectedMarket = markets.find(m => m.condition_id === selectedMarketId) ?? markets[0]
  const marketSlug = selectedMarket?.slug ?? ''
  const marketQuestion = selectedMarket?.question || selectedMarket?.title || marketSlug

  const sortedOutcomes = useMemo(() => {
    return [...(selectedMarket?.outcomes ?? [])].sort((a, b) => (a.outcome_index ?? 0) - (b.outcome_index ?? 0))
  }, [selectedMarket])
  const yesPercent = sortedOutcomes[0] ? toPercent(normalizeOutcomePrice(sortedOutcomes[0])) : 50
  const noPercent = sortedOutcomes[1] ? toPercent(normalizeOutcomePrice(sortedOutcomes[1])) : 50

  // Build URLs — always use ?market= with the market slug
  const embedSrc = useMemo(
    () => buildEmbedSrc(SITE_URL, marketSlug, theme, width, height, toggles, affiliateCode),
    [marketSlug, theme, width, height, toggles, affiliateCode],
  )
  const previewSrc = useMemo(
    () => buildPreviewSrc(marketSlug, theme, width, height, toggles, affiliateCode),
    [marketSlug, theme, width, height, toggles, affiliateCode],
  )

  const eventUrl = `${SITE_URL}/event/${marketSlug}`

  const embedCode = useMemo(() => {
    return buildEmbedCode(codeFormat, {
      src: embedSrc,
      width,
      height,
      title: `${marketQuestion} — ${site.name} Prediction Market`,
      slug: marketSlug,
      siteName: site.name,
      siteUrl: SITE_URL,
      question: marketQuestion,
      yesPercent,
      noPercent,
      eventUrl,
    })
  }, [codeFormat, embedSrc, width, height, marketQuestion, marketSlug, site.name, yesPercent, noPercent, eventUrl])

  async function handleCopy() {
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
              {/* Layout switcher: Standard / Banner (visual icons) */}
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

              {/* Market selector */}
              {showMarketSelector && (
                <div className="space-y-3">
                  <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('MARKET')}</Label>
                  <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                    <SelectTrigger className="w-full bg-transparent text-sm hover:bg-transparent dark:bg-transparent dark:hover:bg-transparent">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {marketOptions.map(option => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Dimensions */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold tracking-wide text-muted-foreground">DIMENSIONS</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Width</label>
                    <input
                      type="number"
                      min={200}
                      max={1200}
                      step={10}
                      value={width}
                      onChange={e => setWidth(Math.min(1200, Math.max(200, Number(e.target.value) || DEFAULT_EMBED_WIDTH)))}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Height</label>
                    <input
                      type="number"
                      min={80}
                      max={800}
                      step={10}
                      value={height}
                      onChange={e => setHeight(Math.min(800, Math.max(80, Number(e.target.value) || DEFAULT_EMBED_HEIGHT)))}
                      className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>

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
                    <Button type="button" size="sm" variant="outline" onClick={handleCopy}>
                      {copied ? <CheckIcon /> : <CopyIcon />}
                      {t('Copy')}
                    </Button>
                  </div>
                </div>
                <div className="overflow-auto rounded-md border border-border bg-muted/70 p-4 max-h-48">
                  <EmbedCodeHighlight code={embedCode} />
                </div>
              </div>
            </div>

            {/* Right column: preview */}
            <div className="flex h-full flex-col gap-3">
              <Label className="text-xs font-semibold tracking-wide text-muted-foreground">{t('PREVIEW')}</Label>
              <div
                className="flex flex-1 items-center justify-center overflow-hidden rounded-md bg-[#f7f7f9] p-2"
                style={{ minHeight: `${Math.min(height, 400)}px` }}
              >
                {previewSrc
                  ? (
                      <iframe
                        title={t('Embed preview')}
                        src={previewSrc}
                        width={width}
                        height={height}
                        frameBorder={0}
                        scrolling="no"
                        className="border-0 bg-transparent"
                        style={{
                          display: 'block',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          transform: width > 450 ? `scale(${450 / width})` : undefined,
                          transformOrigin: 'left top',
                        }}
                      />
                    )
                  : (
                      <p className="text-sm text-muted-foreground">{t('No market available for this event')}</p>
                    )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
