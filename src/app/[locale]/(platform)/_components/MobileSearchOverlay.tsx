'use client'

import { SearchIcon, XIcon } from 'lucide-react'
import { useExtracted } from 'next-intl'
import { useCallback, useEffect, useRef } from 'react'
import { SearchResults } from '@/app/[locale]/(platform)/_components/SearchResults'
import { Input } from '@/components/ui/input'
import { useSearch } from '@/hooks/useSearch'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'

interface MobileSearchOverlayProps {
  open: boolean
  onClose: () => void
}

export default function MobileSearchOverlay({ open, onClose }: MobileSearchOverlayProps) {
  const t = useExtracted()
  const inputRef = useRef<HTMLInputElement>(null)
  const site = useSiteIdentity()
  const sitename = `${site.name || 'events and profiles'}`.toLowerCase()
  const {
    query,
    handleQueryChange,
    results,
    isLoading,
    showResults,
    clearSearch,
    hideResults,
    activeTab,
    setActiveTab,
  } = useSearch()

  const handleClose = useCallback(() => {
    clearSearch()
    hideResults()
    onClose()
  }, [clearSearch, hideResults, onClose])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, handleClose])

  if (!open) {
    return null
  }

  const hasResults = showResults || isLoading.events || isLoading.profiles

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={`${t('Search')} ${sitename}`}
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        <button
          type="button"
          onClick={handleClose}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={t('Cancel')}
        >
          <XIcon className="size-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-y-auto">
        {hasResults && (
          <SearchResults
            results={results}
            isLoading={isLoading}
            activeTab={activeTab}
            query={query}
            onResultClick={handleClose}
            onTabChange={setActiveTab}
            variant="fullscreen"
          />
        )}
      </div>
    </div>
  )
}
