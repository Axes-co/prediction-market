---
title: Polymarket Gamma API (offline reference)
---

# Polymarket Gamma API (offline reference)

> Sources:
> - https://docs.polymarket.com/developers/gamma-markets-api/overview
> - https://docs.polymarket.com/developers/gamma-markets-api/get-events
> - https://docs.polymarket.com/developers/gamma-markets-api/get-markets
> - https://docs.polymarket.com/developers/gamma-markets-api/gamma-structure
> - https://docs.polymarket.com/api-reference/events/get-event-tags
> Saved: 2026-05-02

## Base URL

`https://gamma-api.polymarket.com`

**No authentication required.** All endpoints are public. Reachable from any IP including datacenter / Vercel functions (verified 2026-05-01: 200 OK with no User-Agent, no headers).

## Data model

- **Event**: top-level question (e.g. "2026 NBA Champion"). Has metadata: slug, title, image, dates, volume, tags, markets.
- **Market**: tradable binary outcome under an event. Has condition_id, outcomes, outcome_prices, liquidity, volume.
- **Tag**: category label. Tags are linked to events via `event_tags` join.
- One event can have many markets (multi-outcome). Each market resolves YES/NO against the CLOB.

## Key endpoints we use in the app

### `GET /events`

Discovery. Filter by status, sort, paginate.

Useful query params:
- `closed=false&archived=false&active=true` — only live events
- `tag_slug=sports` — filter by tag (single)
- `tag_id=2` — filter by tag id
- `order=volume24hr` (or `volume`, `createdAt`, `startDate`, `endDate`)
- `ascending=false` — newest/highest first
- `limit=500&offset=0` — paginate (max ~500/page)
- `related_tags=true` — include related tag markets
- `exclude_tag_id=...` — exclude

Response: array of event objects with `markets` and `tags` nested.

### `GET /markets`

Same shape as events but at market level. Less commonly used since events bundle their markets.

### `GET /tags`

All tags. Returns array. Paginated 300/page (we observed 1500+ total).

Each tag:
```ts
{
  id: number,
  slug: string,
  label: string,
  forceShow: boolean | null,    // homepage chip (~15 tags marked true)
  forceHide: boolean | null,    // suppressed even when active
  isCarousel: boolean | null,   // carousel strip
  publishedAt: string | null,
  createdAt: string | null,
  updatedAt: string | null,
}
```

Hierarchy is **implicit** — derived from event_tags overlap. No `parent_id`. Same model we use locally via `v_main_tag_subcategories`.

### `GET /events/{id}/tags`

Tags for a specific event.

### `GET /public-search`

The endpoint polymarket.com's own header search uses. Returns events shaped like `/events`.

```
GET /public-search?q=trump&events_status=active&limit_per_type=10
```

Response: `{ events: [...], pagination: {...} }`. Each event has `markets` and `tags` populated, so it's safe to feed into our `mapEvent` / `upsertEvent` pipeline (we do this in `src/lib/gamma/search.ts`).

## Polymarket homepage structure (verified 2026-05-01)

**6 primary sort tabs** (these are filters, not categories):
1. New
2. Trending
3. Popular
4. Liquid
5. Ending Soon
6. Competitive

**8 secondary category chips** (these are tags):
1. Live Crypto (a saved filter, not a tag)
2. Politics
3. Middle East
4. Crypto
5. Sports
6. Pop Culture
7. Tech
8. AI
9. Business

The sort tabs map to gamma `?order=` parameters; the category chips map to gamma `?tag_slug=` filters. Our migration `2026_05_01_002` aligns our DB's `is_main_category=true` set to those 8 tags exactly.

## Strategies for fetching markets

Per docs:

| Strategy           | Best for                                                 |
| ------------------ | -------------------------------------------------------- |
| **By slug**        | Specific market or event lookup                          |
| **By tag**         | Filtering by category or sport                           |
| **Via events**     | All active markets (most efficient — markets nested)     |

## Where we use it

- `src/lib/gamma/sync.ts` — three-lane cron: active-volume24hr, active-createdAt, all-volume historical crawl
- `src/lib/gamma/search.ts` — on-demand persist from `/public-search` for the header search bar
- `src/lib/gamma/client.ts` — typed client wrapping `/events` and pagination
- `src/lib/gamma/mapper.ts` — gamma → our DB shape (mapEvent, mapMarket, mapTags)
- `src/lib/gamma/repository.ts` — upsert helpers (upsertEvent, upsertMarketsForEvent, linkEventTags)
