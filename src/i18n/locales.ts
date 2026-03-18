export const SUPPORTED_LOCALES = ['en', 'de', 'es', 'pt', 'fr', 'zh', 'ar', 'ja', 'ko', 'tr', 'hi', 'vi', 'th', 'id', 'ms', 'ru', 'uk', 'it'] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

export const DEFAULT_LOCALE: SupportedLocale = 'en'
export type NonDefaultLocale = Exclude<SupportedLocale, typeof DEFAULT_LOCALE>
export const NON_DEFAULT_LOCALES = SUPPORTED_LOCALES.filter(
  locale => locale !== DEFAULT_LOCALE,
) as NonDefaultLocale[]

export const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: 'English',
  de: 'Deutsch',
  es: 'Spanish',
  pt: 'Português',
  fr: 'French',
  zh: '中文',
  ar: 'العربية',
  ja: '日本語',
  ko: '한국어',
  tr: 'Türkçe',
  hi: 'हिन्दी',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  id: 'Bahasa Indonesia',
  ms: 'Bahasa Melayu',
  ru: 'Русский',
  uk: 'Українська',
  it: 'Italiano',
}

export const RTL_LOCALES: SupportedLocale[] = ['ar']

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.includes(locale as SupportedLocale)
}

export const LOOP_LABELS: Record<SupportedLocale, string> = {
  en: 'Language',
  de: 'Sprache',
  es: 'Idioma',
  pt: 'Língua',
  fr: 'Langue',
  zh: '语言',
  ar: 'اللغة',
  ja: '言語',
  ko: '언어',
  tr: 'Dil',
  hi: 'भाषा',
  vi: 'Ngôn ngữ',
  th: 'ภาษา',
  id: 'Bahasa',
  ms: 'Bahasa',
  ru: 'Язык',
  uk: 'Мова',
  it: 'Lingua',
}

export function normalizeEnabledLocales(locales: string[]): SupportedLocale[] {
  const normalized = SUPPORTED_LOCALES.filter(locale => locales.includes(locale))
  if (!normalized.includes(DEFAULT_LOCALE)) {
    return [DEFAULT_LOCALE, ...normalized]
  }
  return normalized
}

export function parseEnabledLocales(value?: string | null): SupportedLocale[] {
  if (!value) {
    return [...SUPPORTED_LOCALES]
  }

  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) {
      return [...SUPPORTED_LOCALES]
    }
    const filtered = parsed.filter((locale): locale is string => typeof locale === 'string')
    const normalized = normalizeEnabledLocales(filtered)
    return normalized.length > 0 ? normalized : [DEFAULT_LOCALE]
  }
  catch {
    return [...SUPPORTED_LOCALES]
  }
}
