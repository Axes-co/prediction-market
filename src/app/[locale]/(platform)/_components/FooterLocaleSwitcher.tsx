'use client'

import type { SupportedLocale } from '@/i18n/locales'
import { GlobeIcon } from 'lucide-react'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { LOCALE_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'

export default function FooterLocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [enabledLocales, setEnabledLocales] = useState<SupportedLocale[] | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const displayLocales = enabledLocales ?? SUPPORTED_LOCALES

  useEffect(() => {
    let isActive = true

    async function loadEnabledLocales() {
      try {
        const response = await fetch('/api/locales')
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        if (!isActive || !Array.isArray(payload?.locales)) {
          return
        }
        const normalized = normalizeEnabledLocales(payload.locales)
        if (normalized.length > 0) {
          setEnabledLocales(normalized)
        }
      }
      catch {
        // silently fail
      }
    }

    void loadEnabledLocales()

    return () => {
      isActive = false
    }
  }, [])

  function handleChange(nextLocale: string) {
    setIsOpen(false)
    startTransition(() => {
      router.replace(
        // @ts-expect-error -- next-intl validates that params match the pathname.
        { pathname, params },
        { locale: nextLocale as SupportedLocale },
      )
    })
  }

  const currentLabel = LOCALE_LABELS[locale as SupportedLocale] ?? locale.toUpperCase()

  if (displayLocales.length <= 1) {
    return null
  }

  return (
    <div className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground disabled:opacity-50"
      >
        <GlobeIcon className="size-4" />
        <span>{currentLabel}</span>
        <svg className={`size-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
          <polyline fill="none" points="1.75 4.25 6 8.5 10.25 4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute bottom-full mb-2 grid max-h-60 grid-cols-2 gap-1 overflow-y-auto rounded-lg border bg-popover p-2 shadow-md sm:grid-cols-3">
          {displayLocales.map(option => (
            <button
              key={option}
              type="button"
              onClick={() => handleChange(option)}
              className={`rounded-md px-3 py-1.5 text-start text-sm transition-colors ${
                option === locale
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {LOCALE_LABELS[option] ?? option.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
