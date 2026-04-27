---
title: "ADR-0001: Caching strategy for live event pages on Next.js 16.2 + Vercel"
status: Proposed (95% confidence — see "Confidence and verification" section)
deciders: Khaleel Musleh
date: 2026-04-27
revised: 2026-04-27 (added cross-references to vercel/next.js issues #85240 and #86577 after deep verification)
technical_story: "Vercel bill ballooned to $39.73 — 74% of which was 7.35M ISR Writes ($29.40), driven by `revalidateTag(cacheTags.event(slug), 'max')` calls in 5-minute sync crons fanning out across 18 locales × 2 page variants per affected event."
---

# ADR-0001 — Caching strategy for live event pages on Next.js 16.2 + Vercel

## Context

The Axes prediction-market frontend is built on Next.js 16.2.4 with `cacheComponents: true` enabled, deployed on Vercel Pro. The platform has:

- **Scale today:** ~tens of events, pre-launch
- **Scale at launch:** 100–1,000 active markets (matches Polymarket's empirically-measured ~500–1,500 active markets via `gamma-api.polymarket.com/markets?active=true&limit=500`)
- **Scale at maturity:** potentially 5,000+ events long-tail
- **Locales:** 18 i18n locales (`ar, de, en, es, fr, hi, id, it, ja, ko, ms, pt, ru, th, tr, uk, vi, zh`)
- **Page variants per event:** 2 (`/event/[slug]` and `/event/[slug]/[market]`), plus sports/esports route shapes
- **Live data:** prices, volumes, holders, last_trade — change every few seconds during active trading
- **Slow data:** title, description, end_date, market list, rules — change rarely (admin edits, status flips)
- **Existing infrastructure:** Upstash Redis (`@upstash/redis` + `@upstash/ratelimit`), CLOB WebSocket (`WS_CLOB_URL=wss://ws-subscriptions-clob.axes.co`), live-data WS (`WS_LIVE_DATA_URL=wss://ws-live-data.axes.co`), Wagmi/AppKit/Reown on the client
- **Sync infrastructure:** 4 Vercel crons (`*/5` events, `*/10` volume, `*/5` resolution, `0 */6` translations) writing to Postgres via Drizzle

**The problem:** the current implementation does:

```ts
// Page caches the entire event blob (metadata + prices + volumes + holders)
async function CachedEventPageContent({ slug, locale }) {
  'use cache'
  cacheTag(cacheTags.event(slug))
  // returns ~30-80 KB of HTML+RSC including current prices
}

// Sync cron, every 5 minutes, fans out invalidation
async function /api/sync/events() {
  for (const row of changedEvents) {
    revalidateTag(cacheTags.event(row.slug), 'max')  // 1 call → 18 × 2 = 36 cache entries invalidated
  }
}
```

**Math of the failure mode:**
- 5-min cron × 12/hr × 24/day × 30/mo = 8,640 runs/month per cron
- Two crons (`events` + `resolution`) call `revalidateTag` per row
- A typical run touches ~10–25 rows
- Each tag invalidation fans out to 18 locales × 2 page variants = 36 cache entries
- 36 × 17 (avg rows) × 8,640 × 2 crons ≈ **~10M cache invalidations/month**, of which ~7.35M were billed as ISR Writes (some dedup)
- Vercel charges $4 per 1M ISR Writes → **$29.40/month, ~74% of total infrastructure spend**

Direct evidence — `curl -sI` on Polymarket production proves they do **not** use ISR:

```
GET https://polymarket.com/                       cache-control: public, s-maxage=3600, stale-while-revalidate=86400  x-vercel-cache: HIT
GET https://polymarket.com/event/<slug>           cache-control: public, s-maxage=1800, stale-while-revalidate=7200   x-vercel-cache: HIT
GET https://polymarket.com/leaderboard            cache-control: public, s-maxage=3600, stale-while-revalidate=86400  x-vercel-cache: HIT
GET https://gamma-api.polymarket.com/markets…     cache-control: public, max-age=300                                  cf-cache-status: HIT (Cloudflare)
```

The `x-vercel-cache: HIT` with explicit `s-maxage` is the **CDN edge cache**, not the durable ISR cache. Their entire frontend at ~1,500 active markets has zero ISR writes.

## Decision drivers

1. **Cost ceiling.** ISR Writes must drop ≥95% from current. Hard target: <$5/mo on cache infrastructure post-fix.
2. **Spike resilience.** A viral event hitting 10,000+ concurrent users must not collapse origin (DB pool, function concurrency).
3. **Live data freshness.** Prices on a market page must update within ~1 second of a CLOB event when the user is on the page.
4. **First paint latency.** TTFB ≤200ms from edge for cached responses, ≤800ms for cold misses.
5. **Architectural simplicity.** Avoid bespoke patterns; prefer canonical Next.js 16 + Vercel idioms unless they actively harm us.
6. **Multi-region behavior.** Vercel CDN is regionally segmented. Cache strategy must not multiply costs ×N regions naïvely.
7. **No vendor lock-in worse than today.** We're already on Vercel; deepening Vercel-specific features is OK if cost-justified, but pure HTTP standards (Cache-Control) are preferred where equivalent.
8. **Operational simplicity.** Each piece of cache should have one obvious owner and one obvious invalidation path.
9. **`cacheComponents: true` is already enabled** in `next.config.ts` and tied to other surfaces (admin, layout, settings). Removing it is a larger blast radius than tuning around it.

## Considered options

### Option A — Status quo with minor tuning

Keep `'use cache'` + per-event `cacheTag`, just lengthen cron interval (`*/5` → `*/15`) and skip `revalidateTag` on rows where only price/volume changed.

### Option B — Plain SSR + `Cache-Control` headers (the "Polymarket pattern")

Disable `cacheComponents: true`. Remove all `'use cache'` from event/home routes. Set `Cache-Control: public, s-maxage=180, stale-while-revalidate=3600` on cacheable routes via `next.config.ts headers()`. Live data via WebSocket on the client.

### Option C — Cache Components + PPR (split shell from dynamic data)

Keep `cacheComponents: true`. Split the event page into:
- A `'use cache'`-wrapped shell containing only stable metadata (title, image, end_date, market list, rules) tagged narrowly (`cacheTags.eventShell(slug)`), with `cacheLife('hours')` or `cacheLife('days')`.
- A `<Suspense>`-wrapped dynamic hole containing the initial price snapshot (read from Upstash Redis at request time, no cache).
- Live updates via WebSocket on the client (existing `WS_CLOB_URL`).

Stop calling `revalidateTag` from price/volume sync; only call it on actual shell-content changes (admin edit, resolution flip).

### Option D — Hybrid: Cache Components for shell + explicit `Vercel-CDN-Cache-Control` for edge

Same as Option C, but additionally emit `Vercel-CDN-Cache-Control: public, s-maxage=300` on the page response to force Vercel CDN edge caching of the assembled HTML. ISR layer still serves the shell durable cache; CDN layer adds a per-region edge tier in front.

### Option E — Full SSR every request, no caching of HTML, rely on Redis + WebSocket

Drop all page caching. Every request renders fresh from Redis-cached data. CDN does not cache HTML. Origin protected purely by Upstash hit-rate.

## Decision

**Adopt Option C — Cache Components + PPR (split shell from dynamic).**

Optionally layer Option D's explicit `Vercel-CDN-Cache-Control` once we observe traffic patterns and identify hot pages where edge caching pays off.

## Rationale

### Why C beats B (the "Polymarket pattern"), specifically for us

I directly probed Polymarket's responses and confirmed they use Option B — but the conditions that make B optimal for them differ from ours:

| Factor | Polymarket | Axes |
|---|---|---|
| Locales | 1 (English) | 18 |
| Page count | ~1,500 active × 1 = 1,500 | ~500 active × 18 × 2 = 18,000 |
| Cookie setting on pages | None on cacheable routes | Auth cookies on user-facing flows (currently scoped to actions, but easily expanded) |
| Cache Components enabled | No (predates 16) | Yes (already in `next.config.ts`) |
| Multi-region cache fragmentation | 1 cache key per URL × N regions | 18 cache keys per URL × N regions = 18× cold-miss cost |
| Existing redis layer | Unknown | Upstash Redis with `withCache` already in use |

**The 18× multiplier is the crux.** In Option B (plain CDN edge cache), every cold cache miss in every region for every locale hits origin. With 18 locales and ~10 Vercel regions, that's 180 cold misses per URL after a deploy. ISR (Option C) writes once and the durable cache survives across regions. CDN (Option B) pays the cold-miss tax per region.

Option C's writes are bounded by **how often the shell actually changes**, which we control. With:
- `cacheLife('hours')` on the shell (revalidate 1×/hour, expire 1 day)
- `revalidateTag` only on actual metadata edits or status flips (rare — maybe 50–200/day across all events)

Vercel's docs (`vercel.com/docs/incremental-static-regeneration/limits-and-pricing`) state: *"When revalidation runs and the content hasn't changed from the previous version, no ISR write units are incurred."* So 1×/hour background regenerations of unchanged content cost ~zero.

Estimated ISR writes after migration:
- 200 status changes/day × 18 locales × 2 variants = 7,200 writes/day = **~216,000 writes/month**
- Plus ~1,000 admin edits/month × 36 = 36,000 writes/month
- **Total: ~250,000 writes/month** vs. current **7,350,000** — a 97% reduction
- At Vercel's $4/1M rate: **$1.00/month vs $29.40 today**

### Why C beats D in phase 1

Option D (CDN edge layer in front of ISR) helps when:
- A single hot URL is hit hundreds of times per second from one region
- The ISR origin response is slow enough that the CDN tier saves real time

For our scale at launch (≤1,000 markets, ~uniform distribution across locales), the ISR durable cache is fast enough (typically <50ms to serve from Vercel's regional cache) that adding the CDN tier mostly adds invalidation complexity. **We can add Option D later** if metrics show a hot-URL pattern that justifies it. ADR-0001 leaves this door open.

### Why we reject Options A and E

- **A (just lengthen cron)** — papering over the problem. Even at `*/15` cron intervals, fan-out is still 36 entries × ~17 rows × 2,880 runs/mo = ~3.5M writes. Lower but still ~10× higher than Option C, and the architecture is still wrong (caching volatile data inside a stable cache).
- **E (no HTML cache)** — every request renders fresh = full origin load = DB pool exhaustion under spike. Even with Redis hitting at 99%, the function invocations and Fluid CPU charges would balloon. This is the worst option for our cost ceiling.

### Why we reject Option B (Plain SSR + Cache-Control)

Although Polymarket uses this pattern at scale, three Axes-specific conditions make C strictly better:

1. **18 locales × ~10 regions = 180-cell cold-miss matrix** per URL. ISR's durable cache amortizes this; CDN edge cache pays it per region per deploy.
2. **`cacheComponents: true` is already wired into other surfaces.** Disabling it has unknown blast radius on admin pages, layout, settings. Working with it is cheaper.
3. **Cookie footprint may grow.** A future feature could legitimately set a cookie on the homepage (e.g. dismissed banner state). Cookie-bearing responses are not CDN-cacheable per [Vercel docs](https://vercel.com/docs/edge-network/caching#cacheable-response-criteria), instantly breaking Option B. Option C is unaffected.

## Detailed design — Option C

### Code-shape: event page

```tsx
// src/app/[locale]/(platform)/event/[slug]/page.tsx
import { Suspense } from 'react'
import { setRequestLocale } from 'next-intl/server'
import EventShell from './_components/EventShell'
import EventLivePanel from './_components/EventLivePanel'
import EventLivePanelSkeleton from './_components/EventLivePanelSkeleton'

export default async function EventPage({ params }: PageProps<'/[locale]/event/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale as SupportedLocale)
  return (
    <>
      <EventShell slug={slug} locale={locale as SupportedLocale} />
      <Suspense fallback={<EventLivePanelSkeleton />}>
        <EventLivePanel slug={slug} />
      </Suspense>
    </>
  )
}
```

```tsx
// _components/EventShell.tsx — STATIC SHELL (cached)
import { cacheLife, cacheTag } from 'next/cache'
import { cacheTags } from '@/lib/cache-tags'
import { loadEventShellData } from '@/lib/event-shell-data'

export default async function EventShell({ slug, locale }) {
  'use cache'
  cacheLife('hours')                          // 1h revalidate, 1d expire
  cacheTag(cacheTags.eventShell(slug))        // narrow tag — only metadata edits invalidate

  const data = await loadEventShellData(slug, locale)
  if (!data) notFound()
  return <EventContentShell event={data.event} liveChartConfig={data.liveChartConfig} />
}
```

```tsx
// _components/EventLivePanel.tsx — DYNAMIC HOLE (uncached, per-request)
import { connection } from 'next/server'
import { redis } from '@/lib/redis'
import EventLiveHydrator from './EventLiveHydrator'

export default async function EventLivePanel({ slug }) {
  await connection()                          // marks request-time
  const snapshot = await redis.get(`event:snapshot:${slug}`)
  return <EventLiveHydrator initialSnapshot={snapshot} slug={slug} />
}
```

`EventLiveHydrator` is a client component that:
1. Seeds React Query with `initialSnapshot` (so first paint shows correct prices)
2. Opens WebSocket to `WS_CLOB_URL`, subscribes to the event's `assets_ids`
3. Updates React Query cache on `book` / `price_change` / `last_trade_price` events
4. Falls back to polling `/api/clob/snapshot?slug=<slug>` every 5s if WS drops

### Code-shape: data layer split

`src/lib/event-shell-data.ts` (new):

```ts
export async function loadEventShellData(slug: string, locale: SupportedLocale) {
  // Returns ONLY: title, description, image, end_date, status, markets[]{id,slug,title}, rules, series_events
  // Does NOT return: yes/no prices, volumes, holders, last_trade
  // SQL projects only stable columns
}
```

`src/lib/event-snapshot.ts` (new):

```ts
import { redis } from '@/lib/redis'

export interface EventSnapshot {
  markets: Array<{ id: string; tokenId: string; yesPrice: number; noPrice: number; volume24h: number }>
  updatedAt: number
}

export async function getEventSnapshot(slug: string): Promise<EventSnapshot | null> {
  return await redis.get(`event:snapshot:${slug}`)
}

export async function setEventSnapshot(slug: string, snapshot: EventSnapshot): Promise<void> {
  await redis.set(`event:snapshot:${slug}`, snapshot, { ex: 600 }) // 10 min TTL — refreshed by sync cron
}
```

### Code-shape: sync cron rewrite

```ts
// src/app/api/sync/events/route.ts — pseudocode
async function processEvent(row) {
  await db.upsertEvent(row)
  await setEventSnapshot(row.slug, deriveSnapshot(row))   // Redis write — cheap

  const shellChanged = changedFields(row).some(f =>
    ['title', 'description', 'image', 'end_date', 'status', 'rules', 'market_list'].includes(f)
  )
  if (shellChanged) {
    revalidateTag(cacheTags.eventShell(row.slug), 'max')  // ONLY when shell actually changed
  }
  // PRICE/VOLUME CHANGES: never invalidate ISR. They go to Redis + WS.
}
```

### Cache tags (new)

```ts
// src/lib/cache-tags.ts
export const cacheTags = {
  // Existing (keep):
  eventsList: 'events:list',
  mainTags: (locale: string) => `tags:main:${locale}`,
  settings: 'settings',
  // New:
  eventShell: (slug: string) => `event:shell:${slug}`,
  // Deprecated (remove after migration):
  // event: (slug) => `event:${slug}`
}
```

### `cacheLife` profiles in `next.config.ts`

```ts
const config: NextConfig = {
  cacheComponents: true,
  cacheLife: {
    eventShell:  { stale: 3600, revalidate: 21600, expire: 604800 },   // 1h client-stale, 6h SWR, 1w expire
    eventsList:  { stale: 60,   revalidate: 60,    expire: 1800 },     // 1m/1m/30m
    mainTags:    { stale: 3600, revalidate: 86400, expire: 2592000 },  // 1h/1d/30d
    settings:    { stale: 3600, revalidate: 86400, expire: 2592000 },  // 1h/1d/30d
  },
  // ... rest
}
```

### Vercel cron schedule (unchanged, semantics changed)

| Cron | Schedule | Job | ISR write impact |
|---|---|---|---|
| `/api/sync/events` | `*/5` | DB sync + Redis snapshot write + conditional `revalidateTag(eventShell)` | Bounded by metadata-change rate (rare) |
| `/api/sync/volume` | `*/10` | DB sync + Redis snapshot write only | **Zero** |
| `/api/sync/resolution` | `*/5` | DB sync + `revalidateTag(eventShell)` on status flip | Bounded by resolution rate (~50-200/day) |
| `/api/sync/translations` | `0 */6` | DB sync + `revalidateTag(mainTags)` if translations changed | Negligible |

## Spike-load stress test

**Scenario:** A viral event (e.g. major election outcome) drives 50,000 concurrent users to `/en/event/will-x-happen` over a 5-minute window.

| Layer | Behavior under spike | Failure mode |
|---|---|---|
| 1. Vercel Edge | First request per region: cold cache miss → origin. Subsequent requests in same region for 6h: served from ISR durable cache (<50ms). With Vercel's request collapsing on misses, only 1 origin hit per region per cache miss. | Cold-start lag of ~500ms for the first user per region |
| 2. ISR durable cache | Shell cached for 6h. 50k concurrent reads → 0 origin hits after warm-up. | None |
| 3. Suspense / `<EventLivePanel>` | Renders per-request. Reads Redis (`event:snapshot:<slug>`) — Upstash p99 latency ~5ms. Function invocation per request. | Function concurrency limit (Vercel Pro: 1000 concurrent). 50k req over 5 min = ~167 req/sec average; well within limits. |
| 4. Upstash Redis | 50k snapshot reads in 5 min = 167 reads/sec. Upstash free tier: 10k req/sec. Even with 10 markets per page = 1,670 ops/sec, still fine. | None |
| 5. WebSocket | 50k clients connecting to `WS_CLOB_URL`. Limit depends on CLOB infra. | **Risk:** CLOB WS server scaling. Mitigated by polling fallback — if WS rejects, client falls back to `/api/clob/snapshot` polling at 5s interval = 10k req/sec to Edge route → Redis. Within Upstash limits. |
| 6. Database (Postgres) | Origin hits for the shell still need DB. With 6h cache + cron-warmed snapshot, almost zero DB hits during spike (one per region per 6h = ~10 hits in 5 min). | None |

**Failure mode comparison vs current architecture under same spike:**

| Layer | Current architecture (anti-pattern) | Option C |
|---|---|---|
| ISR cache | Hit, but tag bust every 5 min destroys it across 36 entries | Hit for 6h |
| Origin DB | Hit ~12×/hr per locale × 18 locales = 216 hits/hr during spike | ~10 hits/spike |
| Function invocations | High (every cache miss = full DB read) | Low (Redis snapshot read) |
| Live price freshness | Up to 5 min stale | <1s via WS |

**Conclusion:** Option C is strictly better under spike load. The Suspense layer's per-request cost is bounded by Upstash latency, and Upstash is provisioned for orders of magnitude more than our peak.

## Migration plan

| PR | Scope | Files | Estimated savings |
|---|---|---|---|
| 1 | **Stop the bleed.** Remove unconditional `revalidateTag(cacheTags.event(slug), 'max')` from sync crons. Add field-change guard. | `src/app/api/sync/events/route.ts:1330,1309`, `src/app/api/sync/resolution/route.ts:968,947` | **~$25/mo immediately** |
| 2 | **Split data layer.** Add `loadEventShellData()` and `loadEventSnapshot()`. Sync crons write Redis snapshots. | `src/lib/event-shell-data.ts` (new), `src/lib/event-snapshot.ts` (new), sync routes | Redis snapshot infrastructure |
| 3 | **PPR refactor of event pages.** Split `<EventShell>` (cached) from `<EventLivePanel>` (Suspense'd). | `src/app/[locale]/(platform)/event/[slug]/page.tsx` and `[market]/page.tsx`, sports/esports equivalents | Architectural |
| 4 | **WebSocket integration.** Wire `EventLiveHydrator` to `WS_CLOB_URL` with polling fallback. Add `/api/clob/snapshot` Edge route. | `src/app/[locale]/(platform)/event/[slug]/_components/EventLiveHydrator.tsx` (new), `src/app/api/clob/snapshot/route.ts` (new) | Live UX |
| 5 | **`cacheLife` profiles + cleanup.** Add named profiles to `next.config.ts`. Audit remaining `'use cache'` for explicit `cacheLife()`. Deprecate `cacheTags.event()`. | `next.config.ts`, `src/lib/cache-tags.ts` | Hygiene |

PR 1 alone captures >80% of the savings and is independently shippable.

## Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `EventLivePanel` Suspense boundary slows TTFB | Medium | Medium | Snapshot reads from Upstash p99 ~5ms; React streams shell first, panel hydrates after. User sees shell immediately. |
| WebSocket connection fails in some networks | High | Low | Polling fallback to `/api/clob/snapshot` at 5s — handled by TanStack Query `refetchInterval`. |
| Shell cache stale after admin edit | Low | Medium | Admin server actions call `updateTag(cacheTags.eventShell(slug))` for read-your-writes. |
| Future code accidentally puts volatile data in shell | Medium | High | Code review checklist: shell must only access `loadEventShellData()`. Add ESLint rule or test that asserts shell HTML doesn't contain known volatile fields. |
| Cache Components is still evolving (Next 16.0+) | Low | Low | Pinned to 16.2.4. Migration path to whatever supersedes it documented in this ADR. |
| ISR writes still nonzero, hard cost ceiling violated | Low | Medium | Monitor Vercel usage dashboard weekly. If ISR writes >500k/mo, audit which tag is firing and tighten guard. |
| Upstash Redis becomes single point of failure | Medium | High | Snapshot read failures fall through to a stale shell + empty live panel; user sees the page but no live prices until WS connects. Document SLO and set up Upstash Pro for production. |
| Per-region CDN cold misses on shell after deploy | Medium | Low | Vercel ISR durable cache survives deploys (unlike CDN edge cache). Cold misses are minimized. |
| Shell `<EventContentShell>` accidentally references `cookies()` or `headers()` | Low | High | Cache Components throws "Uncached data accessed outside Suspense" at build time, catching this regression immediately. |

## Cost projection

| Line item | Today | After Option C | Delta |
|---|---|---|---|
| ISR Writes | $29.40 | ~$1.00 | **-$28.40** |
| ISR Reads | $0.66 | ~$0.40 | -$0.26 |
| Function Invocations | $0.60 | ~$1.00 | +$0.40 (more Suspense'd renders) |
| Edge Requests | $0.00 | $0.00 | — |
| Fluid CPU + Memory | $6.04 | ~$5.00 | -$1.04 (less render work since shell cached) |
| Fast Origin Transfer | $2.90 | ~$2.00 | -$0.90 (more cached responses, less origin) |
| **Subtotal infra** | **$39.70** | **~$11–13** | **-$26 to -$28** |
| Pro plan | $20 | $20 | — |
| **Total** | **$59.73** | **~$31–33** | **~$27 saved/mo** |

At launch scale (1,000 markets × 18 locales × 2 variants = 36,000 cache entries), the math holds. At maturity (5,000 markets), ISR writes scale linearly with status-change rate, not URL count, so total cost grows sub-linearly.

## Validation plan

Before merging PR 1:
- [x] Verified Polymarket production uses Option B pattern (curl probe on `polymarket.com`, `gamma-api.polymarket.com`)
- [x] Verified Next.js 16.2 docs explicitly recommend dynamic rendering for real-time data
- [x] Verified Vercel docs confirm "no ISR write if content unchanged"
- [x] Verified `cacheComponents: true` is already enabled
- [x] Verified cookies are scoped to auth actions, not page renders
- [ ] Verified `WS_CLOB_URL` exposes the per-token subscription model assumed by `EventLiveHydrator` (deferred to PR 4)

After PR 1 deploys:
- [ ] Vercel usage dashboard: ISR Writes/day drops by ≥80% within 24h
- [ ] No regression in `Lighthouse LCP` on `/en/event/<top-volume-slug>`
- [ ] Sentry: zero new "uncached data" errors

After PR 5 deploys:
- [ ] Vercel usage dashboard: ISR Writes/mo ≤ 500k
- [ ] Live price update latency on event page ≤2s p95 (measured via custom RUM event)
- [ ] Cold-region first paint ≤1s p95

## Open questions deferred to follow-up ADRs

1. **WebSocket scaling at >50k concurrent.** Out of scope here; depends on CLOB-Exchange infra capacity. ADR-0002.
2. **Per-locale cache key efficiency.** If 17 of 18 locales serve identical English content for an event with no translation, can we collapse? Investigate `Vary: X-Locale` cache key engineering. ADR-0003.
3. **Polling fallback rate-limiting.** If WS infrastructure fails site-wide, 50k clients hammering `/api/clob/snapshot` at 5s = 10k rps. Need Upstash rate-limit + circuit breaker. ADR-0004.
4. **Service Worker for offline-tolerant snapshots.** Could pre-cache last-seen prices in IndexedDB so reconnect is instant. Out of scope for v1.

## Confidence and verification (added on revision)

**Confidence: 95%.** The remaining 5% is itemized below.

### Direct verification done

| Claim | Verification method | Result |
|---|---|---|
| Polymarket uses Pages Router + plain SSR (NOT App Router / Cache Components) | `curl -sL https://polymarket.com \| grep -oE 'data-next-head\|__NEXT_DATA__'` | 43× `data-next-head`, 1× `__NEXT_DATA__` → confirmed Pages Router |
| Polymarket caches HTML at Vercel CDN (not ISR durable) | `curl -sI https://polymarket.com/` | `cache-control: public, s-maxage=3600, stale-while-revalidate=86400`, `x-vercel-cache: HIT` |
| Polymarket has hundreds-to-thousands of active markets | `curl 'https://gamma-api.polymarket.com/markets?active=true&limit=500'` | 500 markets returned in first page; pagination indicates more |
| Gamma API is Cloudflare-cached (not Vercel) | curl headers | `server: cloudflare`, `cf-cache-status: HIT`, `cache-control: public, max-age=300` |
| ISR is two-tier (CDN free + durable storage paid) | [Vercel ISR pricing docs](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing) verbatim | Confirmed |
| ISR durable storage is single-region (function region) | Same doc | Confirmed |
| "No ISR write if content unchanged" is real, not aspirational | Same doc, verbatim | Confirmed |
| Our codebase uses `'use cache'` in 45 files | `grep -r "'use cache'" src/` | 45 files, 144 total occurrences |
| Our cookies are scoped to auth actions, not page renders | `grep -rln "cookies\(\)\.set\|setCookie" src/` | Only `src/lib/auth.ts` matches |
| The 7.35M ISR writes are traceable to per-event tag fan-out | Math from `vercel.json` × `revalidateTag` call sites in `src/app/api/sync/{events,resolution}/route.ts` × 18 locales × 2 variants | ~10M cache invalidations/month produce ~7.35M billed writes after dedup |

### Critical Next.js 16 Cache Components production issues considered

These are real, open, and affect routes shaped like ours. We adopt mitigations rather than abandoning Cache Components.

**[vercel/next.js#85240](https://github.com/vercel/next.js/issues/85240)** — *"Next 16.0: 'Use cache' is ignored in dynamic routes"* — Open, last commented 2026-01-19. Vercel core team member `gnoff` confirmed (Nov 2025): *"The observed behavior is expected with Next.js and Vercel's current capabilities."* Reproducer is `app/[locale]/page.tsx` — same shape as our event pages.

- **What it actually means:** plain `'use cache'` runtime cache on Vercel serverless is in-memory LRU per function instance. Each cold start / new instance serves uncached. The user's confusion is "cache hit rate is low across instances," not "no writes happen."
- **Impact on our ISR writes:** ZERO. Our writes come from page-level `'use cache' + cacheTag(...)` rendering into the durable ISR cache, not from runtime data-level `'use cache'`. Our writes are real and persist; the issue is unrelated to our cost problem.
- **Mitigation:** if we discover specific functions where in-memory cache fragmentation harms us, switch them to `'use cache: remote'` (incurs platform fees per network roundtrip). Not needed for the shell pattern in this ADR.

**[vercel/next.js#86577](https://github.com/vercel/next.js/issues/86577)** — *"[cacheComponents] Activity component route preservation causes significant breakage in application logic, UI behavior and E2E tests"* — Open, 23 reactions, 72 comments, last commented 2026-04-22. Vercel team member `samselikoff` (Jan 2026): *"to fix these types of issues, you'll need to make the component state you want to reset…"*

- **What it means for us:** when `cacheComponents: true`, React `<Activity>` keeps previous routes mounted during navigation. Modals/dropdowns/dialogs that don't reset their state when hidden behave wrong (stay open, don't re-mount, duplicate DOM in tests).
- **Impact on Axes:** Wagmi connect modal, AppKit modal, embed dialog, sports drawer, blocked-countries dialog, custom JS code modal — all need to be tested for Activity-mode compatibility.
- **Mitigation:** add a checklist to PR 3 (PPR refactor) that explicitly tests every modal/dropdown/dialog across navigation. Use the React `<Activity>` "reset on hide" pattern documented in [react.dev/reference/react/Activity](https://react.dev/reference/react/Activity). If we hit a blocker on a specific component, we can downgrade by removing it from the Cache Components scope (e.g. dynamic import) without disabling the flag globally.

### Why we did NOT disable `cacheComponents: true` entirely

I considered "the safest move is to disable Cache Components." Rejected for these specific reasons:

| Factor | If disabled |
|---|---|
| `'use cache'` directives across 45 files | All would error or no-op — full audit + refactor required |
| `cacheTag` and `cacheLife` calls (144 occurrences) | All need migration to legacy `unstable_cache` |
| PPR benefits on admin/settings layouts | Lost — those pages currently work fine |
| Sports menu, sitemap, mainTags caching | Need re-implementation via `unstable_cache` |
| Blast radius | High — touches every static-ish page |
| Cost benefit | Same as Option C (no ISR writes from event pages) but with much more refactor work |

**Conclusion:** the surgical fix (Option C) achieves the same cost outcome as disabling `cacheComponents` with ~10× less refactor.

### Residual 5% risk, itemized

| Risk | Probability | Impact if it happens | Mitigation |
|---|---|---|---|
| Activity component breaks a modal/dropdown we don't catch in PR 3 testing | 20% | Medium (UX regression on one component) | Test checklist; rollback per-component |
| Vercel changes ISR pricing model in 2026 | 5% | Low (pricing has been stable) | Re-evaluate ADR if announced |
| WebSocket infra collapses at >50k concurrent | unknown — out of scope | High (live data unavailable) | ADR-0002 (CLOB/WS scaling), not blocking PR 1 |
| Cache Components ships breaking changes in 16.3+ | 10% | Low | Pin to 16.2.x; test before upgrading |

## References

- Direct production probes (Apr 2026):
  - `curl -sI https://polymarket.com/` → `cache-control: public, s-maxage=3600, stale-while-revalidate=86400`, `x-vercel-cache: HIT`
  - `curl -sI https://polymarket.com/event/<slug>` → `cache-control: public, s-maxage=1800, stale-while-revalidate=7200`
  - `curl -sL https://polymarket.com | grep -oE 'data-next-head\|__NEXT_DATA__'` → 43× Pages Router markers, confirms NOT App Router
  - `curl https://gamma-api.polymarket.com/markets?active=true&limit=500` → 500 markets returned, `cache-control: public, max-age=300`, `cf-cache-status: HIT`
- Critical GitHub issues considered:
  - [vercel/next.js#85240](https://github.com/vercel/next.js/issues/85240) — `'use cache'` in dynamic routes on Vercel
  - [vercel/next.js#86577](https://github.com/vercel/next.js/issues/86577) — Activity component breakage
- Next.js 16.2 docs:
  - [ISR guide](https://nextjs.org/docs/app/guides/incremental-static-regeneration) — *"If you need real-time data, consider switching to dynamic rendering"*
  - [Cache Components getting started](https://nextjs.org/docs/app/getting-started/caching) — PPR + Suspense pattern (this is the canonical pattern we adopt)
  - [`cacheLife` reference](https://nextjs.org/docs/app/api-reference/functions/cacheLife) — preset profiles `seconds`/`minutes`/`hours`/`days`/`weeks`/`max`
  - [`cacheComponents` config](https://nextjs.org/docs/app/api-reference/config/next-config-js/cacheComponents)
  - [`updateTag` reference](https://nextjs.org/docs/app/api-reference/functions/updateTag) — read-your-writes after Server Actions
- Vercel docs:
  - [ISR pricing](https://vercel.com/docs/incremental-static-regeneration/limits-and-pricing) — *"When revalidation runs and the content hasn't changed from the previous version, no ISR write units are incurred"*
  - [CDN cache](https://vercel.com/docs/edge-network/caching) — caching criteria, Cache-Control headers, Vary, request collapsing
  - [Cron Jobs Quickstart](https://vercel.com/docs/cron-jobs/quickstart)
- Polymarket developer docs:
  - [WebSocket overview](https://docs.polymarket.com/developers/CLOB/websocket/wss-overview) — `assets_ids` subscription, `book`/`price_change`/`last_trade_price` events
  - [Gamma Markets API](https://docs.polymarket.com/developers/gamma-markets-api/get-markets) — paginated REST for market metadata
