# V2 migration — full audit

Audit conducted 2026-04-29 against `clob.polymarket.com`, `relayer-v2.polymarket.com`, `data-api.polymarket.com`, `gamma-api.polymarket.com`, `user-pnl-api.polymarket.com`, `ws-subscriptions-clob.polymarket.com`. All findings backed by live `curl` + `cast` probes.

This supersedes `v2-spec.md` as the working plan. v2-spec.md was scoped only to the trading core; this audit covers every external surface our app touches, including positions, PnL, trade history, leaderboard, and sports/live-series.

## 1. What is already done and verified

| Sub-phase | What it changed | Live evidence |
|---|---|---|
| V2.0 | Spec doc | `docs/migration-polymarket/v2-spec.md` |
| V2.1 | EIP-712 V2 typed data + V2 contract addresses + V2 BlockchainOrder + buildOrderPayload V2 | typeHash matches canonical; sign+recover round-trip; V1≠V2 sig collision check |
| V2.1.5 | `defaultNetwork`: polygonAmoy → polygon (137) | EIP-712 domain.chainId=137 verified in fork test |
| V2.2 | KUEST_*→POLY_* across 10 source files + 4 env keys; store-order V2 wire body; cancel-market-orders snake_case | POST /order: 401→400 (past auth, into V2 body validation) |
| V2.2.5 | Live POST /order probe — past auth, V2 body parsed | `{"error":"Invalid order payload"}` instead of `Unauthorized/Invalid api key` |
| V2.3 | pUSD/USDC.e onboarding approvals + Onramp/Offramp helpers | Calldata decoded: 8-tx batch with verbatim V2 addresses |
| V2.3.5 | Anvil fork test of approvals batch + Onramp.wrap/unwrap | Fork tests pass: 1:1 wrap, 1:1 unwrap, 3 setApprovalForAll persisted |
| V2.4 | `getClobMarketInfo()` typed helper | GET /clob-markets/0xaf5e9038… → 200 with mts/mos/fd/tbf |

## 2. What I claimed was done but is broken or missing

| Sub-phase | Claim | Reality | Status |
|---|---|---|---|
| V2.4.5 | Wired Onramp.wrap into deposit flow via `pending-deposit.ts` | Code rewritten correctly; `Submit` POSTs `/submit` not `/swap/usdc-e/submit`. **But cannot run because user has no Safe yet, and Safe deployment is also broken — see V2.6.** | Code fix done, end-to-end blocked |
| V2.4.6 | Trading auth derives L2 from CLOB only | Fixed `trading-auth.ts` to drop relayer L1 call. Live: relayer 404 confirmed. | Fix applied |
| V2.5 | Live test gate | Cannot run until V2.6 lands and Safe is deployed. | Blocked |

## 3. What is broken right now in the running app

Probes performed today; reproducible with `curl` against current Polymarket V2 hosts.

### 3.1 Relayer — `relayer-v2.polymarket.com`

| Path | What our code does | V2 reality |
|---|---|---|
| `POST /wallet/safe` | `_actions/proxy-wallet.ts:149` calls it for Safe deployment | **404** — endpoint does not exist on V2 relayer |
| `POST /auth/api-key` | `_actions/trading-auth.ts:103` (pre-V2.4.6) used to call it | **404** — does not exist (CLOB-only L1 in V2). Fixed in V2.4.6. |
| `POST /swap/usdc-e/build` | `pending-deposit.ts` (pre-V2.4.5) | **Path doesn't exist on V2.** Replaced with local Onramp.wrap calldata in V2.4.5. |
| `POST /swap/usdc-e/submit` | same | **Path doesn't exist on V2.** Replaced with `/submit` in V2.4.5. |
| `POST /submit` | `_actions/approve-tokens.ts:122` + `_actions/portfolio/pending-deposit.ts` (V2.4.5) | **401 unauth** — exists, accepts our HMAC scheme |
| `GET /nonce?address&type=SAFE` | `_actions/approve-tokens.ts` + `pending-deposit.ts` (V2.4.5) | **200 unauth** — returns `{"nonce":"<n>"}` |
| `GET /deployed?address=` | not currently used | **200 unauth** — returns `{"deployed":bool}` |

### 3.2 CLOB — `clob.polymarket.com`

| Path | Our use | V2 reality |
|---|---|---|
| `POST /order` | store-order.ts:325 | ✅ accepts our V2 body shape (V2.2.5 verified) |
| `DELETE /order` | cancel-order.ts | not yet probed; same auth pattern, expected to work |
| `DELETE /cancel-market-orders` | cancel-market-orders.ts | not yet probed; same auth pattern |
| `POST /auth/api-key` | trading-auth.ts:34 | ✅ exists; needs L1 headers |
| `GET /book?token_id=X` | not currently used | ✅ 200 — single-token book |
| `POST /books` | EventOrderBookUtils.ts | ✅ batch with array body works |
| `GET /midpoint?token_id=X` | useEventMidPrices.ts:51 | ✅ 200 `{"mid":"0.715"}` |
| `POST /midpoints` | not currently used | ✅ batch with array body |
| `POST /prices` | useEventMidPrices.ts:77 | ✅ accepts `[{token_id, side}]` array body |
| `POST /last-trades-prices` | useEventLastTrades.ts:26 + EventOrderBookUtils.ts:28 | ✅ accepts array body |
| `POST /batch-prices-history` | priceHistoryApi.ts:94 | ⚠️ exists but **400 on our current body** — needs `interval` field added (master plan PR-A8) |
| `GET /prices-history?market=&interval=` | not currently used | ✅ alternate single-market form |
| `GET /clob-markets/{condition_id}` | V2.4 helper | ✅ verified |
| `POST /data/volumes` | MarketOutcomeGraph.tsx:518, EventMetaInformation.tsx:48, EventMarketCard.tsx:58 | **404** — endpoint removed in V2 |
| `GET /data/orders?owner=apikey` | api/open-orders/route.ts | 401 unauth — exists, needs L2 auth |
| `GET /marks/latest`, `/marks/history`, `/series-map`, `/trackings` | api/price-reference/live-series/route.ts and related | **404** — kuest-only endpoints, no V2 equivalent on CLOB |

### 3.3 data-api — `data-api.polymarket.com`

| Path | Our use | V2 reality |
|---|---|---|
| `GET /positions?user=` | `usePublicPositionsQuery.ts:103,145`, `lib/portfolio.ts:102`, `PortfolioMarketsWonCard.tsx:138`, `api/og/profile/route.tsx:230` | ✅ 200, `[]` for unfunded user |
| `GET /closed-positions?user=` | same hook + lib/portfolio.ts:103 | ✅ 200 |
| `GET /activity?user&limit=` | `usePublicActivityQuery.ts:40` | ✅ 200 |
| `GET /value?user=` | `usePortfolioValue.ts:47`, `lib/portfolio.ts:81` | ✅ 200 `[{user, value}]` |
| `GET /traded?user=` | `lib/portfolio.ts:104` | ✅ 200 `{user, traded}` |
| `GET /trades?user= or market=` | `api/event-activity/route.ts:83` | ✅ 200 |
| `GET /holders?market=&limit=` | `lib/data-api/holders.ts`, `lib/comments/holders-allowlist.ts` | ✅ 200 (real V2 data) |
| `GET /leaderboard?timePeriod=` | `LeaderboardClient.tsx:112,161` | **404** — V2 moved to `/v1/leaderboard` |
| `GET /v1/leaderboard?timePeriod=` | `api/og/leaderboard/route.tsx:212` (already uses /v1) | ✅ 200 |
| `GET /biggest-winners?timePeriod=&category=` | `leaderboardApi.ts:115` | **404** — endpoint removed in V2 |

### 3.4 user-pnl-api — `user-pnl-api.polymarket.com`

| Path | Our use | V2 reality |
|---|---|---|
| `GET /user-pnl?user_address&timeframe=` | `PublicProfileHeroCards.tsx:73`, `api/leaderboard/timeframe-pnl/route.ts:234` | ✅ 200 `[]` for our wallet (endpoint exists; just no PnL data for an unfunded address). The master plan claimed 404 — that was wrong. |

### 3.5 gamma-api — `gamma-api.polymarket.com`

| Path | Our use | V2 reality |
|---|---|---|
| `GET /events` | `lib/gamma/sync.ts` | ✅ 200 |
| `GET /tags` | `lib/gamma/tags-sync.ts` | ✅ 200 |
| `GET /comments?parent_entity_type=Event&parent_entity_id=` | `lib/gamma/comments-sync.ts` | ✅ 200 |
| `GET /markets?condition_ids=` | not directly used; could replace some of our gamma sync flow | ✅ 200 |

### 3.6 WebSockets — `wss://ws-subscriptions-clob.polymarket.com`

| Path | Our use | V2 reality |
|---|---|---|
| `/ws/market` | `EventMarketChannelProvider.tsx:328` | ✅ open succeeds |
| `/ws/user` | not currently used (master plan PR-D2) | expected to work; needs L2 auth in subscribe payload |
| `/ws` (RTDS for crypto_prices/equity_prices/comments) | `useLiveCommentsChannel.ts`, `useLiveSeriesWebSocket.ts`, `useLiveChartStream.ts`, `ActivityFeed.tsx` | RTDS lives on a different host: `wss://ws-live-data.polymarket.com` — needs verification |

### 3.7 price-reference — DNS does not resolve

`PRICE_REFERENCE_URL=https://clob.polymarket.com` in `.env.local`. Our calls go to `${CLOB_URL}/marks/latest` etc. → **404** on V2. The V2 equivalent for sports/live-series may be the RTDS WebSocket on `ws-live-data.polymarket.com`.

`api/price-reference/live-series/route.ts` and `useLiveSeriesWebSocket.ts` are entirely V1-kuest patterns that don't have a direct V2 HTTP analog.

## 4. User data flows — what's needed for positions / PnL / trade history

These are the user-data surfaces you specifically called out. Status of each:

### 4.1 Positions

- `usePublicPositionsQuery.ts` uses `/positions` and `/closed-positions` — **both work** on V2.
- `lib/portfolio.ts` uses both — **works**.
- The DB-backed `PublicPositionsList.tsx` reads from data-api.
- **Risk:** position rows reference `conditionId` and `tokenId`. Polymarket V2 returns the same field names; visually checked the response.

### 4.2 Portfolio value

- `usePortfolioValue.ts` calls `/value?user=` — **works**, returns `[{user, value}]`.
- `lib/portfolio.ts` aggregates value + positions + closed-positions + traded count — **all paths work**.

### 4.3 Trade history

- `api/event-activity/route.ts` calls `/trades?user= or market=` — **works**.
- `usePublicActivityQuery.ts` calls `/activity?user=` — **works**.

### 4.4 PnL

- `PublicProfileHeroCards.tsx` calls `user-pnl-api.polymarket.com/user-pnl` — **works** (returned 200 empty for our wallet).
- `api/leaderboard/timeframe-pnl/route.ts` calls same — **works**.
- The master plan said this was 404; live probe disagrees. Don't drop the calls.

### 4.5 Leaderboard

- `LeaderboardClient.tsx` calls `/leaderboard?timePeriod=` — **404 on V2**. Must be `/v1/leaderboard`.
- `api/og/leaderboard/route.tsx` already uses `/v1/leaderboard` — fine.
- `leaderboardApi.ts` calls `/biggest-winners` — **404 on V2**. No V2 equivalent. Two options: drop the feature, or re-derive from `/v1/leaderboard` rows.

### 4.6 Holders

- `data-api/holders.ts` and `lib/comments/holders-allowlist.ts` call `/holders` — **works**.

## 5. Required sub-phases (concrete plan)

Order chosen so each sub-phase compiles, validates, and unblocks the next.

### V2.6 — Safe deployment via `/submit` (UNBLOCKS V2.5 entirely)

**Files:** `src/app/[locale]/(platform)/_actions/proxy-wallet.ts:138-218`, `src/lib/safe-proxy.ts:6-21`.

**Reality:** `POST relayer-v2.polymarket.com/wallet/safe` returns 404. Polymarket V2 deploys Safes by submitting a **canonical Gnosis Safe `createProxyWithNonce` Safe-tx through `/submit`**, signed via the standard SafeTx EIP-712 (the same `getSafeTxTypedData` we already use elsewhere).

**What changes:**
- Drop `SAFE_PROXY_DOMAIN_NAME = 'Contract Proxy Factory'` and `SAFE_PROXY_TYPES.CreateProxy` (kuest-custom typed data) from `safe-proxy.ts`.
- `getSafeProxyWalletAddress` (predicts via factory's `computeProxyAddress`) — **keep**, factory address verified live.
- Rewrite `triggerSafeProxyDeployment` to:
  1. Build calldata: `factory.createProxyWithNonce(singleton, initializer, saltNonce)` against the Polymarket Safe Factory.
  2. Wrap that calldata in a SafeTx via existing `getSafeTxTypedData`.
  3. POST the signed Safe-tx to `/submit` (reuse the helper from `approve-tokens.ts`).

**Validation:** Deploy a test wallet's Safe on the anvil fork, verify the predicted address matches the deployed bytecode size > 0.

### V2.7 — Remove dead `/data/volumes` calls

**Files:** `MarketOutcomeGraph.tsx:496-549`, `EventMetaInformation.tsx:18-79`, `EventMarketCard.tsx:38-90`.

**Reality:** `POST clob.polymarket.com/data/volumes` returns 404. The `volume` field is already populated by our gamma sync; the live-fetch was a kuest pattern.

**What changes:** Replace each `useQuery({queryKey:[..., 'volumes', ...]})` block with a direct read of `event.volume` / `market.volume`. Delete `src/app/api/sync/volume/{route,helpers}.ts` and remove the cron from `vercel.json`.

**Risk:** none. Falls back to gamma-supplied data which is already populated.

### V2.8 — Leaderboard `/v1` prefix + drop `/biggest-winners`

**Files:** `LeaderboardClient.tsx:112,161`, `leaderboardApi.ts:115`.

**What changes:**
- `LeaderboardClient.tsx`: `/leaderboard` → `/v1/leaderboard`.
- `leaderboardApi.ts:fetchBiggestWins` → either delete (drop the feature on the leaderboard page) or reimplement using `/v1/leaderboard` filtered/sorted client-side.

### V2.9 — Sports / live-series / price-reference cleanup

**Files:** `useLiveSeriesWebSocket.ts`, `useLiveChartStream.ts`, `useLiveCommentsChannel.ts`, `ActivityFeed.tsx`, `api/price-reference/live-series/route.ts`.

**Reality:** kuest's `price-reference.polymarket.com` host doesn't resolve. The HTTP `/marks/*` paths don't exist on `clob.polymarket.com`. Polymarket V2's RTDS lives on `wss://ws-live-data.polymarket.com` per master plan PR-D1, but the HTTP marks/series-map endpoints have no documented V2 equivalent.

**Two options:**
1. **Defer sports/live-series to a follow-up phase.** Stub the endpoints to return empty, gate the UI features off. The non-sports trading flow (everything else) doesn't need this.
2. **Wire to RTDS now.** Subscribe to `crypto_prices`/`equity_prices` topics on `wss://ws-live-data.polymarket.com`. No HTTP price-reference; the UI reads from a WS-backed cache.

Option 1 is simpler; Option 2 restores the live charts but needs verification of the RTDS subscribe message format and topic catalog.

### V2.10 — `/batch-prices-history` body fix

**Files:** `priceHistoryApi.ts:122-148`.

**Reality:** Endpoint exists on V2 but returns 400 on our current body shape. Per master plan PR-A8: needs `interval` field added to the bounded path bodies.

### V2.11 — Live test gate (V2.5 promoted)

After V2.6, V2.7, V2.8, V2.10 land, V2.5 becomes runnable: SIWE → deploy Safe via `/submit` → 8-tx approval batch → deposit USDC.e → wrap to pUSD → place 1-share far-OTM order → cancel.

V2.9 (sports) doesn't block V2.5 if Option 1 (defer) is chosen.

## 6. Deeper audit findings — 2026-04-29 follow-up

After the initial audit I went deeper on the §6 items I had flagged. Several turn out to be more important than originally thought.

### 6.1 Safe factory address is WRONG in our code (CRITICAL)

Our `src/lib/contracts.ts:18` has:
```ts
export const SAFE_PROXY_FACTORY_ADDRESS = '0x0202c1c426C77cEE55979e4fB3496288fAba8413'
```

That contract exists on Polygon mainnet, has a working `computeProxyAddress(address)` view, masterCopy = Safe v1.5.0 at `0xFf51A5898e281Db6DfC7855790607438dF2ca44b`, and `NAME() = "Contract Proxy Factory"`. It looks plausible.

**But it is not the canonical Polymarket V2 factory.** Per `Polymarket/proxy-factories` (their public repo), the V2 factory is:

```
0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b
```

Live on Polygon mainnet:
- `NAME()` returns `"Polymarket Contract Proxy Factory"` (vs our `"Contract Proxy Factory"`)
- `masterCopy()` returns `0xE51abdf814f8854941b9Fe8e3A4F65CAB4e7A4a8` (Safe v1.3.0, 24,170 bytes)
- `fallbackHandler()` returns `0xe16bA5bF81E5BB113e4752E4fdC20351d796fB24`

Predicted Safe address for our test EOA `0xfc34…780b`:

| Factory | Predicted Safe | Bytecode at predicted addr |
|---|---|---|
| OUR (wrong) `0x0202c1c4…` | `0x04E00eB7…f579` | **0 bytes — not deployed** |
| CANONICAL `0xaacFeEa03e…` | `0xa60218297E…1d77` | **124 bytes — Gnosis Safe Proxy deployed** |

**Concrete consequence:** had we run the live test today against our current factory, the predicted address would have been `0x04E00eB7…` — wrong. Approvals + funds sent there would not be controllable by Polymarket's CLOB, because that Safe was never created.

### 6.2 The user's Safe already exists — fully provisioned

The Safe at `0xa60218297E48C1764E5B469b507f55C38a8d1d77` (predicted by the canonical factory for `0xfc34…780b`):

```
getOwners()       → [0xfc34C1726079668396e32bCAEC78481834cF780b]   ← our test EOA
getThreshold()    → 1
nonce()           → 6                                              ← 6 prior Safe-txs done
VERSION()         → "1.3.0"
balance pUSD      → 4,514,241 base units = 4.51 pUSD
balance USDC.e    → 0
balance MATIC     → 0

allowance USDC.e → Onramp:  uint256.max  ✅
allowance pUSD   → CTF Exchange (V2):  uint256.max  ✅
allowance pUSD   → NegRisk Exchange (V2):  uint256.max  ✅
isApprovedForAll CTF → CTF Exchange (V2):  true  ✅
isApprovedForAll CTF → NegRisk Exchange (V2):  true  ✅
```

**The user has $4.51 pUSD sitting in a fully-approved Polymarket Safe right now.** They're an existing Polymarket V2 user. They went through onboarding on polymarket.com at some point.

### 6.3 V2.6 scope flips

V2.6 was scoped as "deploy a Safe via `/submit`." That's still required for *new* Axes users who haven't onboarded on Polymarket. But:

- **For our V2.5 live test**, no deployment needed. The Safe exists. We can run a 1-share order against the existing $4.51 pUSD balance immediately.
- **For new users**, we still need the canonical factory address + the canonical Safe deployment flow. Without the source code from `Polymarket/safe-wallet-integration` or `Polymarket/builder-relayer-client`, the exact relayer call sequence is opaque (the `relay-client` source I fetched only shows it calls `SUBMIT_TRANSACTION` with a `SafeCreateTransactionArgs` payload — full schema needs the SDK source).

### 6.4 DELETE /order field naming

`src/app/[locale]/(platform)/event/[slug]/_actions/cancel-order.ts:36` sends body `{"orderId": ...}` (camelCase). Polymarket V2's POST /order response uses `"orderID"` (uppercase D); the canonical V2 SDK and docs use `orderID` for the cancel body too. Our body field is likely wrong.

Quick fix in V2.x: `{ orderId: ... }` → `{ orderID: ... }` in `cancel-order.ts:36`. Sanity-check by reading the V2 SDK source after we clone the repos.

### 6.5 Trading-auth `auth.relayer` reuse — design assumption

V2.4.6 fix: derive L2 once from CLOB, store the same triple as `auth.relayer` and `auth.clob`. **The V2 docs literally say "L1/L2 auth is identical in V2", so the same HMAC L2 secret signs valid HMACs for both `clob.polymarket.com` and `relayer-v2.polymarket.com`.** Live-confirmed `/submit` returns 401 (not 404) — exists. Until an actual onboarded user POSTs, the reuse isn't end-to-end verified.

### 6.6 Items still unverified after this turn

1. **WS subscribe message format on `/ws/market`, `/ws/user`, RTDS** — open succeeds; subscribe payload not yet round-tripped.
2. **`/v1/leaderboard` field-shape match** vs `LeaderboardClient.tsx` expectations — got a 200, didn't diff field-by-field.
3. **Polymarket V2 relayer's exact `/submit` body schema for Safe deployment** — `Polymarket/proxy-factories` README references the factory address but not the deploy mechanism. The `builder-relayer-client` source uses opaque types (`SafeCreateTransactionArgs`) that we'd need the type definition file for.
4. **The exact `Safe.setup(...)` initializer calldata Polymarket uses** when deploying — i.e. owners + threshold + fallbackHandler + payment params.

## 7. Why we should clone Polymarket's reference repos

The remaining unknowns (§6.6) all live in Polymarket's public source code, not their docs site. Cloning these into the parent folder of our repo gives us the definitive answers without further guessing.

Recommended clones (parent folder, e.g. `~/Desktop/Projects/Axes/`):

| Repo | What we'd extract |
|---|---|
| `Polymarket/wagmi-safe-builder-example` | End-to-end builder flow: connect → deploy Safe → approve tokens → wrap → place order. Definitive reference. |
| `Polymarket/builder-relayer-client` | Exact relayer API: every endpoint, body schema, header/auth pattern. Resolves §6.6.3 + §6.5. |
| `Polymarket/proxy-factories` | Safe factory source + deployment script. Definitive factory address, singleton, fallbackHandler, initializer template. Resolves §6.1 + §6.6.4. |
| `Polymarket/safe-wallet-integration` | Safe-specific integration glue. |
| `Polymarket/real-time-data-client` | RTDS subscribe message format. Resolves §6.6.1 for RTDS topics. |
| `Polymarket/clob-client-v2` | V2 CLOB client — we've already inspected pieces. Has the cancel/order/etc. exact wire shapes. Resolves §6.4 + §6.6 generally. |

After clone, the audit can confirm with source-level evidence rather than empirical probes.

## 8. Source-level evidence — Polymarket SDK + ctf-exchange-v2 repos read

User cloned the 4 builder examples + ctf-exchange-v2 into `~/Desktop/Projects/Axes/polymarket/`. Pulling the SDK source from unpkg/jsdelivr where node_modules wasn't installed. Findings are now backed by Polymarket's own source code, not just docs/probes.

### 8.1 V2 contract addresses — ALL CORRECT in our `contracts.ts`

From `polymarket/ctf-exchange-v2/README.md` (the canonical source for V2 trading contracts):

| Contract | Address | Match `src/lib/contracts.ts`? |
|---|---|---|
| pUSD (impl) | `0x6bBCef9f7ef3B6C592c99e0f206a0DE94Ad0925f` | not stored, ok |
| pUSD (proxy) | `0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB` | ✅ |
| CollateralOnramp | `0x93070a847efEf7F70739046A929D47a521F5B8ee` | ✅ |
| CollateralOfframp | `0x2957922Eb93258b93368531d39fAcCA3B4dC5854` | ✅ |
| CTFExchangeV2 | `0xE111180000d2663C0091e4f400237545B87B996B` | ✅ |
| NegRiskCtfExchangeV2 | `0xe2222d279d744050d28e00520010520000310F59` | ✅ |

**Plus three additional V2 contracts not yet in our code (may be needed):**
- `PermissionedRamp` `0xebC2459Ec962869ca4c0bd1E06368272732BCb08`
- `CtfCollateralAdapter` `0xADa100874d00e3331D00F2007a9c336a65009718`
- `NegRiskCtfCollateralAdapter` `0xAdA200001000ef00D07553cEE7006808F895c6F1`

V2 Exchange has these critical changes per `ctf-exchange-v2/README.md`:
- "Mutable factory addresses — `setProxyFactory()` / `setSafeFactory()` removed. Factory addresses are now immutable constructor parameters with address derivation computed in pure assembly."

This means the V2 Exchange has the canonical Polymarket Safe Factory address baked into its immutable bytecode. **Using the wrong factory in our app means the V2 Exchange rejects orders from our Safes** — the Safe address derivation won't match its hardcoded immutable.

### 8.2 The Safe Factory — DEFINITIVE CONSTANTS

From `@polymarket/builder-relayer-client@0.0.6/dist/config/index.js`:

```js
const POL = {
  SafeContracts: {
    SafeFactory: "0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b",
    SafeMultisend: "0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761",
  }
};
```

From `@polymarket/builder-relayer-client@0.0.6/dist/constants/index.js`:

```js
SAFE_INIT_CODE_HASH = "0x2bce2127ff07fb632d16c8347c4ebf501f4841168bed00d9e6ef715ddb6fcecf";
SAFE_FACTORY_NAME = "Polymarket Contract Proxy Factory";
```

**Our code wrong values:**
| Constant | Our code | Canonical V2 |
|---|---|---|
| `SAFE_PROXY_FACTORY_ADDRESS` | `0x0202c1c4…8413` | `0xaacFeEa03e…541b` |
| `SAFE_PROXY_DOMAIN_NAME` | `'Contract Proxy Factory'` | `'Polymarket Contract Proxy Factory'` |
| `SAFE_MULTISEND_ADDRESS` | `0xA238CBeb…7761` | `0xA238CBeb…7761` ✅ (already correct) |

### 8.3 Safe deployment flow — verbatim source

From `@polymarket/builder-relayer-client@0.0.6/dist/builder/create.js`:

```js
async function buildSafeCreateTransactionRequest(signer, safeContractConfig, args) {
  const sig = await createSafeCreateSignature(signer, ...);  // EIP-712 sign over CreateProxy
  const safeAddress = deriveSafe(args.from, safeFactory);
  return {
    from: args.from,                  // EOA
    to: safeFactory,                  // 0xaacFeEa03e...
    proxyWallet: safeAddress,         // predicted (not yet deployed)
    data: "0x",
    signature: sig,
    signatureParams: { paymentToken, payment, paymentReceiver },
    type: TransactionType.SAFE_CREATE,
  };
}

async createSafeCreateSignature(signer, safeFactory, chainId, paymentToken, payment, paymentReceiver) {
  const domain = {
    name: "Polymarket Contract Proxy Factory",
    chainId: BigInt(chainId),
    verifyingContract: safeFactory,
  };
  const types = {
    CreateProxy: [
      { name: "paymentToken", type: "address" },
      { name: "payment", type: "uint256" },
      { name: "paymentReceiver", type: "address" },
    ],
  };
  const values = { paymentToken, payment, paymentReceiver };
  return await signer.signTypedData(domain, types, values, "CreateProxy");
}
```

And `RelayClient.deploy()` from `client.js`:

```js
async _deploy() {
  const args = {
    from: from,                       // EOA
    chainId: this.chainId,            // 137
    paymentToken: zeroAddress,
    payment: "0",
    paymentReceiver: zeroAddress,
  };
  const request = await buildSafeCreateTransactionRequest(this.signer, safeContractConfig, args);
  const requestPayload = JSON.stringify(request);
  const resp = await this.sendAuthedRequest(POST, SUBMIT_TRANSACTION, requestPayload);
  // SUBMIT_TRANSACTION = "/submit"
  return new ClientRelayerTransactionResponse(resp.transactionID, resp.state, resp.transactionHash, this);
}
```

**Conclusion for V2.6:** our existing `safe-proxy.ts` already has the correct `SAFE_PROXY_TYPES.CreateProxy` typed-data shape. Only 3 things change:
1. Update `SAFE_PROXY_FACTORY_ADDRESS` to `0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b`.
2. Update `SAFE_PROXY_DOMAIN_NAME` to `'Polymarket Contract Proxy Factory'`.
3. Replace `proxy-wallet.ts:triggerSafeProxyDeployment` to POST `/submit` with `type: "SAFE_CREATE"` instead of POSTing `/wallet/safe`.

### 8.4 Relayer endpoints — definitive list

From `@polymarket/builder-relayer-client@0.0.6/dist/endpoints.js`:

```js
GET_NONCE          = "/nonce"
GET_TRANSACTION    = "/transaction"
GET_TRANSACTIONS   = "/transactions"
SUBMIT_TRANSACTION = "/submit"
GET_DEPLOYED       = "/deployed"
```

`/wallet/safe` is **not in the SDK** — that was a kuest-only endpoint. Our `proxy-wallet.ts:149` will 404 against V2 relayer.

### 8.5 Relayer auth — V2.4.6 was WRONG

From `@polymarket/builder-relayer-client@0.0.6/dist/client.js`:

```js
async sendAuthedRequest(method, path, body) {
  if (this.canBuilderAuth()) {
    const builderHeaders = await this._generateBuilderHeaders(method, path, body);
    if (builderHeaders !== undefined) {
      return this.send(path, method, { headers: builderHeaders, data: body });
    }
  }
  return this.send(path, method, { data: body });
}
```

`builderHeaders` come from `BuilderConfig.generateBuilderHeaders()` which is the `@polymarket/builder-signing-sdk` package. From `wagmi-safe-builder-example/app/api/polymarket/sign/route.ts`:

```js
const BUILDER_CREDENTIALS = {
  key: process.env.POLYMARKET_BUILDER_API_KEY!,
  secret: process.env.POLYMARKET_BUILDER_SECRET!,
  passphrase: process.env.POLYMARKET_BUILDER_PASSPHRASE!,
};

return NextResponse.json({
  POLY_BUILDER_SIGNATURE: signature,
  POLY_BUILDER_TIMESTAMP: sigTimestamp,
  POLY_BUILDER_API_KEY: BUILDER_CREDENTIALS.key,
  POLY_BUILDER_PASSPHRASE: BUILDER_CREDENTIALS.passphrase,
});
```

**Definitive:** Polymarket V2 relayer authenticates with `POLY_BUILDER_*` headers (server-level builder credentials), **not** `POLY_*` (per-user L2). Our V2.4.6 fix made `auth.relayer = clobCreds` (per-user CLOB-derived L2). That's wrong. The relayer doesn't need or use per-user credentials at all — the user's authorization is the EIP-712 signature embedded in the request body.

V2 docs explicitly confirm this:
> "Your builder API key isn't retired. The HMAC-based builder API key is still used to authenticate with the Relayer for gasless transactions."

**Implications for our code:**
- `proxy-wallet.ts`, `approve-tokens.ts`, `pending-deposit.ts` should send `POLY_BUILDER_*` headers (not `POLY_*`) when calling the relayer.
- The HMAC algorithm itself is unchanged.
- The credentials come from `process.env.POLYMARKET_BUILDER_API_KEY/SECRET/PASSPHRASE` (already in `.env.local`), not from per-user `auth.relayer.*`.

### 8.6 Order signing flow — what we got right

From `wagmi-safe-builder-example/hooks/useClobClient.ts`:

```js
return new ClobClient(
  CLOB_API_URL,                  // "https://clob.polymarket.com"
  POLYGON_CHAIN_ID,              // 137
  ethersSigner,
  tradingSession.apiCredentials, // user L2 from /auth/api-key
  2,                             // signatureType = 2 (POLY_GNOSIS_SAFE)
  derivedSafeAddressFromEoa,     // funderAddress = Safe
  undefined,
  false,
  builderConfig                  // optional: for builder attribution headers on /order
);
```

For trading endpoints (`/order`, `/cancel-market-orders`, `/data/orders`):
- Auth: `POLY_*` headers (user L2 derived from CLOB `/auth/api-key`)
- Builder attribution: optional `POLY_BUILDER_*` headers OR `builder` field in the signed order body
- `signatureType = 2` for Safe-funded users
- `funderAddress = Safe address`
- `signer = EOA`
- `maker = Safe`

**Our V2.1 + V2.2 code matches this exactly.**

### 8.7 Token approvals — example uses V1 contracts (DO NOT TRUST)

`wagmi-safe-builder-example/constants/tokens.ts`:

```ts
export const CTF_EXCHANGE_ADDRESS =
  "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E"  // V1 — V2 is 0xE111180000…
export const NEG_RISK_CTF_EXCHANGE_ADDRESS =
  "0xC5d563A36AE78145C45a50134d48A1215220f80a"  // V1 — V2 is 0xe2222d279d…
```

The example's `package.json` also pins `@polymarket/clob-client: ^4.22.8` (V1 SDK; V2 is a separate package `clob-client-v2` per `v2-migration.md`). **The example was published before V2 cutover and its trading-side constants are stale.** Trust the V2 migration doc + `ctf-exchange-v2/README.md` for V2 addresses (which we already do).

The example's *flow patterns* (RelayClient init, BuilderConfig + remote signing, Safe address derivation) are still correct because the SDK packages it depends on were updated.

The example's `utils/approvals.ts` approves USDC.e to V1 exchanges — that's V1 behavior. Our V2.3 already corrected this: pUSD to V2 exchanges + USDC.e to Onramp.

### 8.8 Final scoreboard — what's right and what's left

**Already correct:**
- V2 EIP-712 typed data + V2 contract addresses (V2.1)
- chainId 137 mainnet (V2.1.5)
- POLY_* headers for CLOB endpoints (V2.2)
- V2 wire body for `/order` (V2.2)
- pUSD/Onramp helpers + 8-tx approval batch (V2.3)
- `getClobMarketInfo()` (V2.4)
- Onramp.wrap wired into deposit flow (V2.4.5)
- `safe-proxy.ts` `SAFE_PROXY_TYPES.CreateProxy` typed data (matches SDK source)
- ClobClient pattern (signatureType=2, funderAddress=Safe) is what our `EventOrderPanelForm.tsx` already does

**Still wrong / needs fixing:**

| Sub-phase | Fix | Files |
|---|---|---|
| V2.6 | `SAFE_PROXY_FACTORY_ADDRESS` → `0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b` | `src/lib/contracts.ts:18` |
| V2.6 | `SAFE_PROXY_DOMAIN_NAME` → `'Polymarket Contract Proxy Factory'` | `src/lib/safe-proxy.ts:6` |
| V2.6 | Replace `triggerSafeProxyDeployment`: POST `/submit` with `type: "SAFE_CREATE"` instead of POST `/wallet/safe` | `src/app/[locale]/(platform)/_actions/proxy-wallet.ts:138-218` |
| V2.6 | Relayer auth: switch from `POLY_*` headers (user L2) to `POLY_BUILDER_*` headers (server builder L2) | `proxy-wallet.ts`, `approve-tokens.ts`, `pending-deposit.ts` |
| V2.6 | Revert V2.4.6 `auth.relayer = clobCreds`. Relayer doesn't use per-user creds. | `_actions/trading-auth.ts:107-109` |
| V2.6 | Add `/api/polymarket/sign` route that mints `POLY_BUILDER_*` headers on demand (matches example pattern) | new file |
| V2.7 | Remove dead `/data/volumes` calls | 3 components + cron |
| V2.8 | Leaderboard `/v1` prefix; drop `/biggest-winners` | 2 files |
| V2.10 | `/batch-prices-history` body needs `interval` | `priceHistoryApi.ts:122-148` |
| Fix | `cancel-order.ts:36` body field `orderId` → `orderID` | small |
| V2.5 | Live test | user-driven |
| V2.9 (deferred) | Sports/live-series RTDS or stub | post V2.5 |

### 8.9 Big takeaway

The previously-flagged transparency items (§6) all resolved. The biggest correction is in §8.5: **our `_actions/proxy-wallet.ts` + `approve-tokens.ts` + `pending-deposit.ts` should send `POLY_BUILDER_*` headers, not `POLY_*` headers, when calling the relayer.** Equivalently: the relayer doesn't use the per-user L2 derivation flow at all. V2.4.6 conflated CLOB and relayer auth schemes.

After V2.6 lands the corrected factory + domain name + relayer auth scheme + Safe-deployment endpoint, our existing test wallet's already-deployed Safe (`0xa60218297E…1d77`, $4.51 pUSD) becomes the V2.5 test target. New users go through the standard `RelayClient.deploy()` flow.

## 9. Phase completion summary — 2026-04-29 final

All non-V2.5 sub-phases completed in the same session.

### V2.6 — Safe deployment + builder relayer auth (DONE)

Files changed:
- `src/lib/contracts.ts` — `SAFE_PROXY_FACTORY_ADDRESS = 0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b`
- `src/lib/safe-proxy.ts` — `SAFE_PROXY_DOMAIN_NAME = 'Polymarket Contract Proxy Factory'`; `SAFE_PROXY_CREATE_PROXY_MESSAGE.factoryAddress` exposed for the deploy payload
- `src/lib/polymarket/relayer-auth.ts` — NEW. `buildRelayerHeaders()` mints `POLY_BUILDER_*` HMAC headers from server env
- `src/app/[locale]/(platform)/_actions/proxy-wallet.ts` — `triggerSafeProxyDeployment` rewritten to POST `/submit` with `type: "SAFE_CREATE"`. Per-user `auth.relayer` lookups removed.
- `src/app/[locale]/(platform)/_actions/approve-tokens.ts` — `getSafeNonceAction` + `submitSafeTransactionAction` use `buildRelayerHeaders()`. Per-user `auth.relayer` lookups removed.
- `src/app/[locale]/(platform)/portfolio/_actions/pending-deposit.ts` — `fetchSafeNonce` + submit use `buildRelayerHeaders()`. Per-user `auth.relayer` lookups removed.

**Live verification:**
- `cast call <factory> computeProxyAddress(testEOA)` returns `0xa60218297E…1d77` (matches the deployed Polymarket Safe found in §6.2).
- `POST /submit` with builder HMAC + `SAFE_CREATE` body: 401 → 400 (past auth, into body validation). The auth scheme is correct.

### V2.7 — `/data/volumes` removal (DONE)

Files changed:
- `src/app/[locale]/(platform)/event/[slug]/_components/EventMarketCard.tsx` — `useQuery(/data/volumes)` removed; `resolveMarketVolume(market)` returns `market.volume` directly.
- `src/app/[locale]/(platform)/event/[slug]/_components/EventMetaInformation.tsx` — same pattern.
- `src/app/[locale]/(platform)/event/[slug]/_components/MarketOutcomeGraph.tsx` — same pattern.
- `src/app/api/sync/volume/{route,helpers}.ts` — deleted.
- `vercel.json` — `/api/sync/volume` cron entry removed.

### V2.8 — Leaderboard (NO-OP)

Live probe with our existing category values (`overall`, `politics`, `sports`, `crypto`, `finance`, `culture`):
- `GET /v1/leaderboard?timePeriod=...&category=...` → 200 ✅
- `GET /v1/biggest-winners?timePeriod=...&category=...` → 200 ✅

`LEADERBOARD_API_URL = ${DATA_API_URL}/v1` already prefixes /v1 correctly. The earlier 404 was on the un-versioned path. No code change needed.

### V2.10 — `/batch-prices-history` body fix (DONE)

File changed: `src/app/[locale]/(platform)/event/[slug]/_hooks/useEventPriceHistory.ts:122-148`

Both bounded paths now include `interval: config.interval` alongside `startTs`/`endTs`. Live-verified with curl: bounded request now returns 200 with full history points.

### Cancel order field name (DONE)

`src/app/[locale]/(platform)/event/[slug]/_actions/cancel-order.ts:36` — `{orderId}` → `{orderID}`. Per V2 docs canonical body shape.

### V2.4.5 — Onramp.wrap into deposit flow (DONE)

`src/app/[locale]/(platform)/portfolio/_actions/pending-deposit.ts` rewritten to build wrap calldata locally via `buildOnrampWrapTransaction`, fetch Safe nonce via builder-auth GET `/nonce`, and submit via POST `/submit`. Frontend payload shape unchanged.

### Validation

- `tsc --noEmit` — 0 errors
- `eslint <changed files>` — 0 errors
- `vitest run` — 565/565 passing
- Dev server smoke: `/en/event/<slug>` 307 (locale redirect, expected); `/en/leaderboard` 307; `/api/comments/metrics` 200
- All Polymarket V2 live probes pass per §3 / §8

### What remains for V2.5 (user-driven)

The **only blocker is your authorization** to place a real (1-share far-OTM) order with the test wallet. The Safe at `0xa60218297E48C1764E5B469b507f55C38a8d1d77` already exists, owned by your EOA, with $4.51 pUSD and all approvals set.

To run V2.5:
1. Sign in to the dev server with `0xfc34…780b`. Trading session orchestration uses `auth.clob` derived from CLOB `/auth/api-key` (relayer no longer derives — V2.6 cleanup).
2. Confirm the order panel renders.
3. Place a 1-share order on a far-OTM market (e.g. NO at 1¢ on a market resolving 99% YES).
4. Confirm `orderID` returned, attribution shows in `/builder/trades`, cancel works.

V2.9 (sports/live-series RTDS) deferred — does not block trading. Will be addressed once V2.5 confirms the trading flow end-to-end.

## 7. Tasks lifecycle update

- V2.4.5 — code is correct; remains pending because end-to-end requires V2.6 first.
- V2.4.6 — completed (this audit was the work).
- V2.5 — pending; blocked on V2.6.
- V2.6, V2.7, V2.8, V2.9, V2.10 — new sub-phases per this audit.

## 8. Recommended execution order

1. **V2.6** — Safe deployment via `/submit`. Highest-value unblock.
2. **V2.7** — `/data/volumes` removal. Mechanical, low-risk, fixes 3 components.
3. **V2.8** — Leaderboard `/v1` + drop biggest-winners. Mechanical.
4. **V2.10** — Fix `/batch-prices-history` body. Mechanical.
5. **V2.5** — Live test gate (the user-driven 1-share order test).
6. **V2.9** — Sports/live-series cleanup. Defer to after V2.5 passes.

After V2.5 passes: WebSocket subscription verifications (V2.D1 from master plan: subscribe shape on `/ws/market`, `/ws/user`, RTDS).
