import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import HomeContent from '@/app/[locale]/(platform)/(home)/_components/HomeContent'

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  return <HomeContent locale={locale as SupportedLocale} />
}
