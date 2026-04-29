'use client'

import type { AllowedMarketCreatorItem } from '@/lib/allowed-market-creators'
import { Loader2Icon, PlusIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  DEMO_ALLOWED_MARKET_CREATOR_DISPLAY_NAME,
  isAdminAllowedMarketCreatorsResponse,
} from '@/lib/allowed-market-creators'

type CreatorInputMode = 'site' | 'wallet' | 'gamma_api'

interface AllowedMarketCreatorsManagerProps {
  disabled?: boolean
}

function readApiError(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const maybeError = (payload as { error?: unknown }).error
  return typeof maybeError === 'string' && maybeError.trim() ? maybeError.trim() : null
}

function getItemSortKey(item: AllowedMarketCreatorItem): string {
  if (item.sourceType === 'site' || item.sourceType === 'gamma_api') {
    return item.sourceUrl ?? ''
  }
  return item.walletAddress ?? ''
}

function sortItems(items: AllowedMarketCreatorItem[]) {
  return [...items].sort((left, right) => {
    const displayNameSort = left.displayName.localeCompare(right.displayName)
    if (displayNameSort !== 0) {
      return displayNameSort
    }
    return getItemSortKey(left).localeCompare(getItemSortKey(right))
  })
}

async function fetchAllowedCreatorsApi(pathname: string, init?: RequestInit) {
  const primaryResponse = await fetch(`/admin/api/event-creations/allowed-creators${pathname}`, init)
  if (primaryResponse.status !== 404 || typeof window === 'undefined') {
    return primaryResponse
  }

  const [maybeLocale] = window.location.pathname.split('/').filter(Boolean)
  if (!maybeLocale) {
    return primaryResponse
  }

  return fetch(`/${maybeLocale}/admin/api/event-creations/allowed-creators${pathname}`, init)
}

function useAllowedMarketCreatorsState(disabled: boolean) {
  const t = useExtracted()
  const [items, setItems] = useState<AllowedMarketCreatorItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogMode, setDialogMode] = useState<CreatorInputMode>('site')
  const [siteUrl, setSiteUrl] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [walletName, setWalletName] = useState('')
  const [gammaUrl, setGammaUrl] = useState('')
  const [gammaName, setGammaName] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [itemPendingRemoval, setItemPendingRemoval] = useState<AllowedMarketCreatorItem | null>(null)
  const [isRemoving, setIsRemoving] = useState(false)

  const loadItems = useCallback(async () => {
    setIsLoading(true)

    try {
      const response = await fetchAllowedCreatorsApi('', {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAdminAllowedMarketCreatorsResponse(payload)) {
        throw new Error(apiError || `Failed to load sources (${response.status})`)
      }

      setItems(sortItems(payload.items))
    }
    catch (error) {
      console.error('Failed to load allowed market creators:', error)
      toast.error(error instanceof Error ? error.message : t('Could not load mirrored market sources.'))
    }
    finally {
      setIsLoading(false)
    }
  }, [t])

  useEffect(function loadItemsOnMount() {
    void loadItems()
  }, [loadItems])

  const submitDisabled = useMemo(() => {
    if (disabled || isSubmitting) {
      return true
    }

    if (dialogMode === 'site') {
      return siteUrl.trim().length === 0
    }

    if (dialogMode === 'gamma_api') {
      return gammaUrl.trim().length === 0
    }

    return walletName.trim().length === 0 || walletAddress.trim().length === 0
  }, [dialogMode, disabled, isSubmitting, siteUrl, walletAddress, walletName, gammaUrl])

  return {
    items,
    setItems,
    isLoading,
    dialogOpen,
    setDialogOpen,
    dialogMode,
    setDialogMode,
    siteUrl,
    setSiteUrl,
    walletAddress,
    setWalletAddress,
    walletName,
    setWalletName,
    gammaUrl,
    setGammaUrl,
    gammaName,
    setGammaName,
    isSubmitting,
    setIsSubmitting,
    itemPendingRemoval,
    setItemPendingRemoval,
    isRemoving,
    setIsRemoving,
    submitDisabled,
  }
}

export default function AllowedMarketCreatorsManager({
  disabled = false,
}: AllowedMarketCreatorsManagerProps) {
  const t = useExtracted()
  const {
    items,
    setItems,
    isLoading,
    dialogOpen,
    setDialogOpen,
    dialogMode,
    setDialogMode,
    siteUrl,
    setSiteUrl,
    walletAddress,
    setWalletAddress,
    walletName,
    setWalletName,
    gammaUrl,
    setGammaUrl,
    gammaName,
    setGammaName,
    isSubmitting,
    setIsSubmitting,
    itemPendingRemoval,
    setItemPendingRemoval,
    isRemoving,
    setIsRemoving,
    submitDisabled,
  } = useAllowedMarketCreatorsState(disabled)

  function buildAddSourceBody() {
    if (dialogMode === 'site') {
      return { sourceType: 'site' as const, url: siteUrl.trim() }
    }
    if (dialogMode === 'gamma_api') {
      return {
        sourceType: 'gamma_api' as const,
        url: gammaUrl.trim(),
        name: gammaName.trim() || undefined,
      }
    }
    return {
      sourceType: 'wallet' as const,
      walletAddress: walletAddress.trim(),
      name: walletName.trim(),
    }
  }

  function getAddSourceSuccessMessage() {
    if (dialogMode === 'site') {
      return t('Site source added.')
    }
    if (dialogMode === 'gamma_api') {
      return t('Gamma API source added.')
    }
    return t('Wallet source added.')
  }

  async function handleAddSource() {
    setIsSubmitting(true)

    try {
      const response = await fetchAllowedCreatorsApi('', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(buildAddSourceBody()),
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAdminAllowedMarketCreatorsResponse(payload)) {
        throw new Error(apiError || `Failed to add source (${response.status})`)
      }

      setItems(sortItems(payload.items))
      setDialogOpen(false)
      setSiteUrl('')
      setWalletAddress('')
      setWalletName('')
      setGammaUrl('')
      setGammaName('')
      toast.success(getAddSourceSuccessMessage())
    }
    catch (error) {
      console.error('Failed to add allowed market creator source:', error)
      toast.error(error instanceof Error ? error.message : t('Could not save mirrored market source.'))
    }
    finally {
      setIsSubmitting(false)
    }
  }

  async function removeItem(item: AllowedMarketCreatorItem) {
    setIsRemoving(true)

    try {
      const searchParams = new URLSearchParams()
      if (item.sourceType === 'gamma_api' && item.sourceUrl) {
        searchParams.set('sourceType', 'gamma_api')
        searchParams.set('sourceUrl', item.sourceUrl)
      }
      else if (item.sourceType === 'site' && item.sourceUrl) {
        searchParams.set('sourceUrl', item.sourceUrl)
      }
      else if (item.walletAddress) {
        searchParams.set('wallet', item.walletAddress)
      }
      else {
        throw new Error('Invalid source.')
      }

      const response = await fetchAllowedCreatorsApi(`?${searchParams.toString()}`, {
        method: 'DELETE',
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => null) as unknown
      const apiError = readApiError(payload)

      if (!response.ok || apiError || !isAdminAllowedMarketCreatorsResponse(payload)) {
        throw new Error(apiError || `Failed to remove source (${response.status})`)
      }

      setItems(sortItems(payload.items))
      setItemPendingRemoval(null)
      toast.success(t('Source removed.'))
    }
    catch (error) {
      console.error('Failed to remove allowed market creator source:', error)
      toast.error(error instanceof Error ? error.message : t('Could not remove mirrored market source.'))
    }
    finally {
      setIsRemoving(false)
    }
  }

  function handleRemoveClick(item: AllowedMarketCreatorItem) {
    if (item.displayName === DEMO_ALLOWED_MARKET_CREATOR_DISPLAY_NAME) {
      setItemPendingRemoval(item)
      return
    }

    void removeItem(item)
  }

  return (
    <>
      <div className="grid gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Label>{t('Allowed mirrored market sources')}</Label>
            <p className="text-xs text-muted-foreground">
              {t('Add the URL of another prediction market running on Kuest to import its wallets automatically, or add a wallet with a display name.')}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => setDialogOpen(true)}
            disabled={disabled || isLoading}
          >
            <PlusIcon className="mr-2 size-4" />
            {t('Add source')}
          </Button>
        </div>

        {isLoading
          ? (
              <div
                className="
                  flex items-center gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground
                "
              >
                <Loader2Icon className="size-4 animate-spin" />
                {t('Loading sources...')}
              </div>
            )
          : items.length === 0
            ? (
                <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
                  {t('No mirrored market sources configured yet.')}
                </div>
              )
            : (
                <div className="flex flex-wrap gap-2">
                  {items.map((item, index) => (
                    <Badge
                      key={(item.sourceType === 'site' || item.sourceType === 'gamma_api')
                        ? (item.sourceUrl ?? `${item.displayName}-${index}`)
                        : (item.walletAddress ?? `${item.displayName}-${index}`)}
                      variant="outline"
                      className="gap-1.5 pr-1"
                      title={item.walletAddress
                        ? `${item.displayName} • ${item.walletAddress}`
                        : (item.sourceUrl ?? item.displayName)}
                    >
                      <span>{item.displayName}</span>
                      {item.sourceType === 'gamma_api'
                        ? <span className="text-muted-foreground">{t('(gamma API)')}</span>
                        : null}
                      {item.sourceType === 'site' && item.walletCount > 1
                        ? (
                            <span className="text-muted-foreground">{`(${item.walletCount})`}</span>
                          )
                        : null}
                      <button
                        type="button"
                        className="
                          rounded-sm p-0.5 text-muted-foreground transition
                          hover:bg-muted hover:text-foreground
                        "
                        onClick={() => handleRemoveClick(item)}
                        disabled={disabled || isRemoving}
                        aria-label={`Remove ${item.displayName}`}
                      >
                        <XIcon className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(nextOpen) => {
          if (!isSubmitting) {
            setDialogOpen(nextOpen)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Add mirrored market source')}</DialogTitle>
            <DialogDescription>
              {t('Choose whether you want to add a Kuest site URL or a wallet with a display name.')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={dialogMode === 'site' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setDialogMode('site')}
                disabled={isSubmitting}
              >
                {t('Site URL')}
              </Button>
              <Button
                type="button"
                variant={dialogMode === 'wallet' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setDialogMode('wallet')}
                disabled={isSubmitting}
              >
                {t('Wallet + name')}
              </Button>
              <Button
                type="button"
                variant={dialogMode === 'gamma_api' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setDialogMode('gamma_api')}
                disabled={isSubmitting}
              >
                {t('Gamma API')}
              </Button>
            </div>

            {dialogMode === 'site' && (
              <div className="grid gap-2">
                <Label htmlFor="allowed-market-source-url">{t('Kuest site URL or domain')}</Label>
                <Input
                  id="allowed-market-source-url"
                  value={siteUrl}
                  onChange={event => setSiteUrl(event.target.value)}
                  placeholder="site2.com"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {dialogMode === 'wallet' && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="allowed-market-source-name">{t('Wallet name')}</Label>
                  <Input
                    id="allowed-market-source-name"
                    value={walletName}
                    onChange={event => setWalletName(event.target.value)}
                    placeholder="Site 2 creator"
                    maxLength={80}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowed-market-source-wallet">{t('Wallet address')}</Label>
                  <Input
                    id="allowed-market-source-wallet"
                    value={walletAddress}
                    onChange={event => setWalletAddress(event.target.value)}
                    placeholder="0xabc..."
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            {dialogMode === 'gamma_api' && (
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="allowed-market-gamma-url">{t('Gamma API URL')}</Label>
                  <Input
                    id="allowed-market-gamma-url"
                    value={gammaUrl}
                    onChange={event => setGammaUrl(event.target.value)}
                    placeholder="https://gamma-api.polymarket.com"
                    disabled={isSubmitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('Polymarket-compatible Gamma API endpoint. Markets will be pulled directly from this source.')}
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowed-market-gamma-name">{t('Display name (optional)')}</Label>
                  <Input
                    id="allowed-market-gamma-name"
                    value={gammaName}
                    onChange={event => setGammaName(event.target.value)}
                    placeholder="polymarket"
                    maxLength={80}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
              {t('Cancel')}
            </Button>
            <Button type="button" onClick={() => void handleAddSource()} disabled={submitDisabled}>
              {isSubmitting && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {t('Add source')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(itemPendingRemoval)}
        onOpenChange={(nextOpen) => {
          if (!isRemoving && !nextOpen) {
            setItemPendingRemoval(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('Remove demo.kuest.com?')}</DialogTitle>
            <DialogDescription>
              {t('Are you sure? You will stop receiving mirrored markets from Polymarket.')}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setItemPendingRemoval(null)} disabled={isRemoving}>
              {t('Cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => itemPendingRemoval && void removeItem(itemPendingRemoval)}
              disabled={isRemoving || !itemPendingRemoval}
            >
              {isRemoving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
              {t('Remove')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
