import type { SupportedLocale } from '@/i18n/locales'
import { cacheTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { TagRepository } from '@/lib/db/queries/tag'

type PlatformMainTagsResult = Awaited<ReturnType<typeof TagRepository.getMainTagsForNav>>

// Used by `(platform)/layout.tsx`. Calls the lightweight `getMainTagsForNav`
// instead of the count-bearing `getMainTags`: layout-level prerender was
// hitting Supabase's 8s statement_timeout on the heavy aggregate the full
// version performs (5-table join over `markets` for sidebar counts) under
// gamma cron write contention. The nav doesn't need counts; pages that do
// (admin, settings, predictions filter, dynamic-home-category) call
// `TagRepository.getMainTags` directly.
export async function loadPlatformMainTags(locale: SupportedLocale): Promise<PlatformMainTagsResult> {
  'use cache'
  cacheTag(cacheTags.mainTags(locale))

  const result = await TagRepository.getMainTagsForNav(locale)

  return {
    ...result,
    data: result.data ?? [],
    globalChilds: result.globalChilds ?? [],
  }
}
