'use client'

import type { SupportedLocale } from '@/i18n/locales'
import { useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { LOCALE_LABELS, normalizeEnabledLocales, SUPPORTED_LOCALES } from '@/i18n/locales'
import { usePathname, useRouter } from '@/i18n/navigation'

export default function FooterLocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const locale = useLocale()
  const [isPending, startTransition] = useTransition()
  const [enabledLocales, setEnabledLocales] = useState<SupportedLocale[] | null>(null)
  const didFetchRef = useRef(false)
  const displayLocales = enabledLocales ?? SUPPORTED_LOCALES

  useEffect(() => {
    if (didFetchRef.current) {
      return
    }
    didFetchRef.current = true

    async function load() {
      try {
        const response = await fetch('/api/locales')
        if (!response.ok) {
          return
        }
        const payload = await response.json()
        if (!Array.isArray(payload?.locales)) {
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

    void load()
  }, [])

  function handleValueChange(nextLocale: string) {
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
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={isPending}
        className="
          group flex cursor-pointer items-center gap-1.5 text-sm font-medium text-foreground transition-colors
          hover:text-muted-foreground
          focus:outline-none
          disabled:opacity-50
        "
      >
        <svg className="size-4" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="9" cy="9" rx="3" ry="7.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <line x1="1.75" y1="9" x2="16.25" y2="9" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
          <circle cx="9" cy="9" r="7.25" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
        <span>{currentLabel}</span>
        <svg className="size-3 transition-transform group-data-[state=open]:rotate-180" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
          <polyline fill="none" points="1.75 4.25 6 8.5 10.25 4.25" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
        </svg>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
        <DropdownMenuRadioGroup value={locale} onValueChange={handleValueChange}>
          {displayLocales.map(option => (
            <DropdownMenuRadioItem
              key={option}
              value={option}
              className="text-sm font-medium"
            >
              {LOCALE_LABELS[option] ?? option.toUpperCase()}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
