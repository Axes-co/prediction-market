'use client'

import type { EmbedCodeFormat, EmbedToggles } from '@/lib/embed-widget'
import type { EmbedTheme } from '@/lib/embed-theme'
import type { Market } from '@/types'
import { CheckIcon, ChevronLeftIcon, CodeIcon, CopyIcon } from 'lucide-react'
import { useExtracted, useLocale } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import EmbedCodeHighlight from '@/components/embed/EmbedCodeHighlight'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { fetchAffiliateSettingsFromAPI } from '@/lib/affiliate-data'
import { maybeShowAffiliateToast } from '@/lib/affiliate-toast'
import {
  DEFAULT_EMBED_HEIGHT,
  DEFAULT_EMBED_WIDTH,
  MAX_EMBED_HEIGHT,
  MAX_EMBED_WIDTH,
  MIN_EMBED_HEIGHT,
  MIN_EMBED_WIDTH,
} from '@/lib/embed-dimensions'
import { buildEmbedCode, buildEmbedSrc, buildPreviewSrc } from '@/lib/embed-widget'
import { buildMarketLabel, normalizeBaseUrl, normalizeOutcomePrice, toPercent } from '@/lib/embed-utils'
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

type DialogView = 'preview' | 'code'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PREVIEW_CONTAINER_WIDTH = 380
const PREVIEW_CONTAINER_HEIGHT = 320
const DIM_STEP = 10

const SITE_URL = normalizeBaseUrl(
  (() => {
    const v = process.env.SITE_URL
    if (!v?.trim()) throw new Error('SITE_URL is required for embeds.')
    return v
  })(),
)

// ---------------------------------------------------------------------------
// Dimension input with +/- hover buttons
// ---------------------------------------------------------------------------

const DIM_BTN_BASE = 'absolute size-4 flex items-center justify-center bg-background rounded text-muted-foreground text-xs p-0 cursor-pointer opacity-0 pointer-events-none group-hover/dim:opacity-100 group-hover/dim:pointer-events-auto group-focus-within/dim:opacity-100 group-focus-within/dim:pointer-events-auto transition-opacity duration-150 before:absolute before:inset-[-6px] before:content-[""]'
const DIM_INPUT_CLASS = 'rounded-md border border-border bg-transparent relative px-2 py-1.5 text-center text-xs text-muted-foreground focus:outline-none focus:border-primary focus:text-foreground shrink-0'

/**
 * Height dimension input — +/- buttons positioned ABOVE and BELOW.
 */
function HeightDimensionInput({ value, min, max, onChange }: { value: number, min: number, max: number, onChange: (v: number) => void }) {
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])
  return (
    <div className="group/dim relative before:absolute before:inset-[-12px] before:content-['']">
      <button type="button" className={`${DIM_BTN_BASE} left-1/2 -translate-x-1/2 bottom-full mb-1`} onClick={() => onChange(clamp(value + DIM_STEP))}>+</button>
      <button type="button" className={`${DIM_BTN_BASE} left-1/2 -translate-x-1/2 top-full mt-1`} onClick={() => onChange(clamp(value - DIM_STEP))}>−</button>
      <input type="number" min={min} max={max} step={DIM_STEP} value={value} onChange={e => onChange(clamp(Number(e.target.value) || value))} className={DIM_INPUT_CLASS} />
    </div>
  )
}

/**
 * Width dimension input — +/- buttons positioned LEFT and RIGHT.
 */
function WidthDimensionInput({ value, min, max, onChange }: { value: number, min: number, max: number, onChange: (v: number) => void }) {
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])
  return (
    <div className="group/dim relative before:absolute before:inset-[-12px] before:content-['']">
      <button type="button" className={`${DIM_BTN_BASE} top-1/2 -translate-y-1/2 right-full mr-1`} onClick={() => onChange(clamp(value - DIM_STEP))}>−</button>
      <button type="button" className={`${DIM_BTN_BASE} top-1/2 -translate-y-1/2 left-full ml-1`} onClick={() => onChange(clamp(value + DIM_STEP))}>+</button>
      <input type="number" min={min} max={max} step={DIM_STEP} value={value} onChange={e => onChange(clamp(Number(e.target.value) || value))} className={DIM_INPUT_CLASS} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Toggles list
// ---------------------------------------------------------------------------

const DEFAULT_TOGGLES: EmbedToggles = {
  showChart: true,
  showButtons: true,
  showVolume: true,
  showYAxis: true,
  showGridRows: true,
  showBorder: false,
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
  const locale = useLocale()
  const site = useSiteIdentity()
  const user = useUser()
  const affiliateCode = user?.affiliate_code?.trim() ?? ''

  const [view, setView] = useState<DialogView>('preview')
  const [theme, setTheme] = useState<EmbedTheme>('dark')
  const [codeFormat, setCodeFormat] = useState<EmbedCodeFormat>('default')
  const [selectedMarketId, setSelectedMarketId] = useState('')
  const [width, setWidth] = useState(DEFAULT_EMBED_WIDTH)
  const [height, setHeight] = useState(DEFAULT_EMBED_HEIGHT)
  const [toggles, setToggles] = useState<EmbedToggles>(DEFAULT_TOGGLES)
  const [copied, setCopied] = useState(false)
  const [affiliateSharePercent, setAffiliateSharePercent] = useState<number | null>(null)
  const [tradeFeePercent, setTradeFeePercent] = useState<number | null>(null)

  // Reset on open
  useEffect(() => {
    if (!open) return
    setView('preview')
    setTheme('dark')
    setCodeFormat('default')
    setWidth(DEFAULT_EMBED_WIDTH)
    setHeight(DEFAULT_EMBED_HEIGHT)
    setToggles(DEFAULT_TOGGLES)
    setCopied(false)
    setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
  }, [open, initialMarketId, markets])

  // Affiliate settings
  useEffect(() => {
    if (!affiliateCode || !open) {
      setAffiliateSharePercent(null)
      setTradeFeePercent(null)
      return
    }
    let active = true
    fetchAffiliateSettingsFromAPI()
      .then((r) => {
        if (!active) return
        if (r.success) {
          const s = Number.parseFloat(r.data.affiliateSharePercent)
          const f = Number.parseFloat(r.data.tradeFeePercent)
          setAffiliateSharePercent(Number.isFinite(s) && s > 0 ? s : null)
          setTradeFeePercent(Number.isFinite(f) && f > 0 ? f : null)
        }
      })
      .catch(() => { if (active) { setAffiliateSharePercent(null); setTradeFeePercent(null) } })
    return () => { active = false }
  }, [affiliateCode, open])

  // Sync market selection
  useEffect(() => {
    if (!open) return
    if (!markets.some(m => m.condition_id === selectedMarketId)) {
      setSelectedMarketId(initialMarketId ?? markets[0]?.condition_id ?? '')
    }
  }, [open, markets, selectedMarketId, initialMarketId])

  // Derived
  const showMarketSelector = markets.length > 1
  const marketOptions = useMemo(() => markets.map(m => ({ id: m.condition_id, label: buildMarketLabel(m) })), [markets])
  const selectedMarket = markets.find(m => m.condition_id === selectedMarketId) ?? markets[0]
  const marketSlug = selectedMarket?.slug ?? ''
  const marketQuestion = selectedMarket?.question || selectedMarket?.title || marketSlug

  const sortedOutcomes = useMemo(() =>
    [...(selectedMarket?.outcomes ?? [])].sort((a, b) => (a.outcome_index ?? 0) - (b.outcome_index ?? 0)),
  [selectedMarket])
  const yesPercent = sortedOutcomes[0] ? toPercent(normalizeOutcomePrice(sortedOutcomes[0])) : 50
  const noPercent = sortedOutcomes[1] ? toPercent(normalizeOutcomePrice(sortedOutcomes[1])) : 50

  // URLs
  const embedSrc = useMemo(
    () => buildEmbedSrc(SITE_URL, marketSlug, theme, width, height, toggles, affiliateCode, false, locale),
    [marketSlug, theme, width, height, toggles, affiliateCode, locale],
  )
  const previewSrc = useMemo(
    () => buildPreviewSrc(marketSlug, theme, width, height, toggles, affiliateCode, false, locale),
    [marketSlug, theme, width, height, toggles, affiliateCode, locale],
  )
  const localePath = locale && locale !== 'en' ? `/${locale}` : ''
  const eventUrl = `${SITE_URL}${localePath}/event/${marketSlug}`
  const embedCode = useMemo(() => buildEmbedCode(codeFormat, {
    src: embedSrc, width, height,
    title: `${marketQuestion} — ${site.name} Prediction Market`,
    slug: marketSlug, siteName: site.name, siteUrl: SITE_URL,
    question: marketQuestion, yesPercent, noPercent, eventUrl,
  }), [codeFormat, embedSrc, width, height, marketQuestion, marketSlug, site.name, yesPercent, noPercent, eventUrl])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      maybeShowAffiliateToast({ affiliateCode, affiliateSharePercent, tradeFeePercent, siteName: site.name, context: 'embed' })
    }
    catch (e) { console.error(e) }
  }

  function updateToggle(key: keyof EmbedToggles, value: boolean) {
    setToggles(prev => ({ ...prev, [key]: value }))
  }

  // Preview scale
  const previewScale = Math.min(1, PREVIEW_CONTAINER_WIDTH / width)
  const scaledHeight = height * previewScale

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[calc(100%-1rem)] max-w-4xl overflow-y-auto p-3 sm:p-6 lg:w-fit! lg:max-w-fit!">
        <DialogHeader className="flex-row items-center">
          <DialogTitle className="text-xl font-semibold">{t('Embed')}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-12 min-h-0">
          {/* RIGHT — Preview or Code */}
          <div className="w-full lg:w-fit lg:order-last lg:h-fit">
            {view === 'preview'
              ? (
                  <>
                    {/* Desktop: full preview with H/W dimension controls */}
                    <div className="hidden lg:flex w-[500px] h-[400px] flex-col pb-2 pl-6">
                      <div className="grid grid-cols-[auto_1fr] grid-rows-[1fr_auto] w-fit h-fit">
                        <div className="flex flex-col items-center gap-2 w-12 justify-center">
                          <div className="flex flex-col items-center gap-2 transition-[height] duration-150" style={{ height: `${scaledHeight}px` }}>
                            <span className="flex-1 w-px bg-muted-foreground/20" />
                            <div className="relative">
                              <span className="text-xs text-muted-foreground font-semibold leading-none absolute -left-4 top-1/2 -translate-y-1/2">H</span>
                              <HeightDimensionInput value={height} min={MIN_EMBED_HEIGHT} max={MAX_EMBED_HEIGHT} onChange={setHeight} />
                            </div>
                            <span className="flex-1 w-px bg-muted-foreground/20" />
                          </div>
                        </div>
                        <div className="flex items-center justify-center" style={{ width: `${PREVIEW_CONTAINER_WIDTH}px`, height: `${PREVIEW_CONTAINER_HEIGHT}px` }}>
                          {previewSrc
                            ? (
                                <div style={{ width: `${PREVIEW_CONTAINER_WIDTH}px`, height: `${scaledHeight}px` }}>
                                  <iframe title={t('Embed preview')} src={previewSrc} width={width} height={height} frameBorder={0} scrolling="no" style={{ border: 'none', display: 'block', borderRadius: '16px', overflow: 'hidden', transform: `scale(${previewScale})`, transformOrigin: 'left top' }} />
                                </div>
                              )
                            : <p className="text-sm text-muted-foreground">{t('No market available for this event')}</p>}
                        </div>
                        <div />
                        <div className="flex items-center justify-center h-8">
                          <div className="flex items-center gap-2 transition-[width] duration-150" style={{ width: `${PREVIEW_CONTAINER_WIDTH}px` }}>
                            <span className="flex-1 h-px bg-muted-foreground/20" />
                            <div className="relative">
                              <span className="text-xs text-muted-foreground font-semibold leading-none absolute -bottom-4 left-1/2 -translate-x-1/2">W</span>
                              <WidthDimensionInput value={width} min={MIN_EMBED_WIDTH} max={MAX_EMBED_WIDTH} onChange={setWidth} />
                            </div>
                            <span className="flex-1 h-px bg-muted-foreground/20" />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile: simple scaled preview */}
                    <div className="lg:hidden w-full overflow-hidden rounded-2xl">
                      {previewSrc
                        ? (
                            <div style={{ height: `${height * Math.min(1, 320 / width)}px` }}>
                              <iframe title={t('Embed preview')} src={previewSrc} width={width} height={height} frameBorder={0} scrolling="no" style={{ border: 'none', display: 'block', borderRadius: '16px', overflow: 'hidden', transform: `scale(${Math.min(1, 320 / width)})`, transformOrigin: 'left top' }} />
                            </div>
                          )
                        : <p className="px-4 py-8 text-center text-sm text-muted-foreground">{t('No market available for this event')}</p>}
                    </div>
                  </>
                )
              : (
                  /* ---- CODE VIEW ---- */
                  <div className="w-full lg:w-[500px] h-[300px] lg:h-[400px] flex flex-col">
                    <div className="flex flex-col gap-2 h-full min-h-0">
                      <p className="text-sm text-muted-foreground shrink-0">{t('Copy and paste this code into your website')}</p>
                      <div className="group relative min-w-0 flex-1 overflow-auto rounded-lg bg-muted/50">
                        <div className="p-3 pt-7 text-[0.7rem] leading-relaxed">
                          <EmbedCodeHighlight code={embedCode} />
                        </div>
                        <button
                          type="button"
                          className="absolute top-1 right-1 p-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                          onClick={handleCopy}
                        >
                          {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
          </div>

          {/* LEFT — Controls */}
          <div className="flex flex-col gap-4 w-full lg:w-64 shrink-0 lg:overflow-y-auto min-h-0 lg:h-[400px] lg:max-h-[500px]">
            {view === 'preview'
              ? (
                  /* ---- PREVIEW CONTROLS ---- */
                  <>
                    {/* Market selector */}
                    {showMarketSelector && (
                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <span className="text-sm text-foreground shrink-0">{t('Market')}</span>
                        <div className="min-w-0">
                          <Select value={selectedMarketId} onValueChange={setSelectedMarketId}>
                            <SelectTrigger className="max-w-full overflow-hidden justify-between gap-2 h-9 px-4">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {marketOptions.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {/* Toggles */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Chart')}</span>
                        <Switch checked={toggles.showChart} onCheckedChange={v => updateToggle('showChart', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Buy buttons')}</span>
                        <Switch checked={toggles.showButtons} onCheckedChange={v => updateToggle('showButtons', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Volume')}</span>
                        <Switch checked={toggles.showVolume} onCheckedChange={v => updateToggle('showVolume', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Y Axis')}</span>
                        <Switch checked={toggles.showYAxis} onCheckedChange={v => updateToggle('showYAxis', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Grid rows')}</span>
                        <Switch checked={toggles.showGridRows} onCheckedChange={v => updateToggle('showGridRows', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Border')}</span>
                        <Switch checked={toggles.showBorder} onCheckedChange={v => updateToggle('showBorder', v)} />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-foreground">{t('Dark mode')}</span>
                        <Switch checked={theme === 'dark'} onCheckedChange={v => setTheme(v ? 'dark' : 'light')} />
                      </div>
                    </div>

                    {/* View Code button */}
                    <Button className="w-full" onClick={() => setView('code')}>
                      <CodeIcon className="size-4" />
                      {t('View Code')}
                    </Button>
                  </>
                )
              : (
                  /* ---- CODE CONTROLS ---- */
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-foreground shrink-0">{t('Code style')}</span>
                      <Select value={codeFormat} onValueChange={v => setCodeFormat(v as EmbedCodeFormat)}>
                        <SelectTrigger className="justify-between gap-2 h-9 px-4">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">Default</SelectItem>
                          <SelectItem value="minimal">Minimal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Spacer */}
                    <div className="flex-1" />

                    {/* Back + Copy */}
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => setView('preview')}>
                        <ChevronLeftIcon className="size-3" />
                        {t('Back')}
                      </Button>
                      <Button className="flex-1" onClick={handleCopy}>
                        {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
                        {t('Copy')}
                      </Button>
                    </div>
                  </>
                )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
