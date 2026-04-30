import { sql } from 'drizzle-orm'
import {
  conditions as conditionsTable,
  events as eventsTable,
  subgraph_syncs as subgraphSyncs,
  tags as tagsTable,
} from '@/lib/db/schema'
import { db } from '@/lib/drizzle'

export interface GammaWipeResult {
  events_deleted: number
  conditions_deleted: number
  tags_deleted: number
}

/**
 * Wipe every Gamma-derived row so the next sync pass repopulates from
 * scratch with the current mapper output.
 *
 * Cascade semantics:
 *   - `DELETE FROM events` → cascades to `markets`, `comments`,
 *     `event_tags`, `event_translations`, `event_sports`. Native comments
 *     authored by users are deleted too (they FK to events with CASCADE);
 *     the caller (cron route) confirms this is intentional.
 *   - `DELETE FROM conditions` → cascades to `outcomes`. Markets are already
 *     gone via the events cascade, so this only cleans orphan rows.
 *   - `DELETE FROM tags` (optional, controlled by `clearTags`) — fresh tag
 *     metadata makes the next sync's main-category promotion deterministic.
 *
 * Cursor state is reset on `subgraph_syncs.gamma_sync.polymarket` so the
 * next run starts from offset 0 in the volume-sorted Gamma feed.
 */
export async function wipeGammaSourcedData(options: { clearTags?: boolean } = {}): Promise<GammaWipeResult> {
  const clearTags = options.clearTags ?? false

  const eventsDeleted = await db
    .delete(eventsTable)
    .returning({ id: eventsTable.id })

  const conditionsDeleted = await db
    .delete(conditionsTable)
    .returning({ id: conditionsTable.id })

  let tagsDeleted: { id: number | null }[] = []
  if (clearTags) {
    tagsDeleted = await db
      .delete(tagsTable)
      .returning({ id: tagsTable.id })
  }

  // Reset gamma sync cursors so the next pass starts from offset 0.
  await db
    .update(subgraphSyncs)
    .set({
      cursor_id: null,
      cursor_updated_at: null,
      total_processed: 0,
      status: 'idle',
      error_message: null,
      updated_at: sql`NOW()`,
    })
    .where(sql`${subgraphSyncs.service_name} = 'gamma_sync' AND ${subgraphSyncs.subgraph_name} = 'polymarket'`)

  return {
    events_deleted: eventsDeleted.length,
    conditions_deleted: conditionsDeleted.length,
    tags_deleted: tagsDeleted.length,
  }
}

/**
 * Soft-reseed: keep all rows in place but clear the gamma cursors so the
 * next sync pass starts from offset 0 of the volume-sorted feed. Use this
 * when only cursors are stale (e.g. after a deploy that introduces new
 * mapper fields).
 */
export async function resetGammaSyncCursors(): Promise<void> {
  await db
    .update(subgraphSyncs)
    .set({
      cursor_id: null,
      cursor_updated_at: null,
      updated_at: sql`NOW()`,
    })
    .where(sql`${subgraphSyncs.service_name} = 'gamma_sync' AND ${subgraphSyncs.subgraph_name} = 'polymarket'`)
}
