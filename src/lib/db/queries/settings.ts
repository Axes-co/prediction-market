import type { QueryResult } from '@/types'
import { sql } from 'drizzle-orm'
import { cacheTag, updateTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { settings } from '@/lib/db/schema/settings/tables'
import { runQuery } from '@/lib/db/utils/run-query'
import { db } from '@/lib/drizzle'
import { cacheKeys, cacheTTL, invalidateCache, withCache } from '@/lib/redis'

type SettingsByGroup = Record<string, Record<string, { value: string, updated_at: string }>>

async function fetchSettingsFromDb(): Promise<QueryResult<SettingsByGroup>> {
  try {
    const data = await db.select({
      group: settings.group,
      key: settings.key,
      value: settings.value,
      updated_at: settings.updated_at,
    }).from(settings)

    const settingsByGroup: SettingsByGroup = {}

    for (const setting of data) {
      settingsByGroup[setting.group] ??= {}
      settingsByGroup[setting.group][setting.key] = {
        value: setting.value,
        updated_at: setting.updated_at.toISOString(),
      }
    }

    return { data: settingsByGroup, error: null }
  }
  catch (error) {
    console.error('Failed to fetch settings:', error)
    return { data: null, error: 'Failed to fetch settings.' }
  }
}

export const SettingsRepository = {
  async getSettings(): Promise<QueryResult<SettingsByGroup>> {
    'use cache'
    cacheTag(cacheTags.settings)

    return runQuery(async () => {
      return withCache(
        cacheKeys.settings,
        fetchSettingsFromDb,
        cacheTTL.settings,
        result => result.data !== null,
      )
    })
  },

  async updateSettings(settingsArray: Array<{ group: string, key: string, value: string }>): Promise<QueryResult<Array<typeof settings.$inferSelect>>> {
    return runQuery(async () => {
      const data = await db
        .insert(settings)
        .values(settingsArray)
        .onConflictDoUpdate({
          target: [settings.group, settings.key],
          set: {
            value: sql`EXCLUDED.value`,
          },
        })
        .returning({
          id: settings.id,
          group: settings.group,
          key: settings.key,
          value: settings.value,
          created_at: settings.created_at,
          updated_at: settings.updated_at,
        })

      // Invalidate both Next.js cache and Redis cache
      updateTag(cacheTags.settings)
      await invalidateCache(cacheKeys.settings)

      return { data, error: null }
    })
  },
}
