import type { Metadata } from 'next'
import type { SupportedLocale } from '@/i18n/locales'
import { setRequestLocale } from 'next-intl/server'
import {
  generatePredictionResultsMetadata,
  renderPredictionResultsPage,
} from '@/app/[locale]/(platform)/predictions/[slug]/_lib/prediction-results-page'
import {
  DEFAULT_PREDICTION_RESULTS_SORT,
  DEFAULT_PREDICTION_RESULTS_STATUS,
} from '@/lib/prediction-results-filters'

const DEFAULT_PREDICTIONS_SLUG = 'trending'

export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return generatePredictionResultsMetadata({
    locale: resolvedLocale,
    slug: DEFAULT_PREDICTIONS_SLUG,
  })
}

export default async function PredictionsIndexPage({
  params,
}: PageProps<'/[locale]'>) {
  const { locale } = await params
  const resolvedLocale = locale as SupportedLocale
  setRequestLocale(resolvedLocale)

  return renderPredictionResultsPage({
    initialSort: DEFAULT_PREDICTION_RESULTS_SORT,
    initialStatus: DEFAULT_PREDICTION_RESULTS_STATUS,
    locale: resolvedLocale,
    slug: DEFAULT_PREDICTIONS_SLUG,
  })
}
