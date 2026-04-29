---
title: V2 migration spec — native HTTP, no SDK
status: in-progress
owner: khaleel
last-updated: 2026-04-29
---

# V2 migration spec — native HTTP, no SDK

Status as of 2026-04-29. Source of truth for the V2.x sub-phases.

## 0. Where we are right now

- `.env.local`: `CLOB_URL=clob.polymarket.com`, `RELAYER_URL=relayer-v2.polymarket.com`, `GAMMA_URL=gamma-api.polymarket.com`. All three already point at Polymarket production.
- Polymarket cut over to V2 on 2026-04-28. V1-signed orders are rejected by `clob.polymarket.com`.
- Our `_actions/store-order.ts` still:
  - Signs the V1 12-field Order struct (taker / expiration / nonce / feeRateBps).
  - Sends `KUEST_*` HMAC headers (we copied kuest's header names verbatim).
  - Posts `taker`, `nonce`, `feeRateBps` in the wire body.
- Net effect today: every order our app submits is rejected at the 401 boundary because the header is named `KUEST_API_KEY` and Polymarket expects `POLY_API_KEY`. Even past that, the wire body would fail validation. We are 0-for-2 on the trading path.

## 1. Decision log (signed off 2026-04-29)

| Decision | Choice |
|---|---|
| Implementation style | **Native HTTP + viem signing.** No `@polymarket/clob-client-v2` SDK. |
| Collateral UX | UI keeps showing **USDC**. Onchain we wrap USDC.e → pUSD via Collateral Onramp once per user, transparent to the user. |
| Builder code | `0x23a45b95958270c7094680b5ee0c572662b167b5ea3abb04dd08862e9fb7e309` (already in `.env.local` as `POLYMARKET_BUILDER_CODE`). |
| WebSockets | Native — no SDK. Subscribe shapes already in plan-19 for `/ws/market`, `/ws/user`, RTDS. Out of scope for this spec; covered later. |

## 2. Live probe results — 2026-04-29

Run today against `clob.polymarket.com`.

### 2.1 `POST /order` no auth → confirms POLY_ headers required

```
$ curl -i -X POST https://clob.polymarket.com/order \
    -H "Content-Type: application/json" \
    -d '{"order":{},"owner":"none","orderType":"GTC"}'

HTTP/2 401
content-type: application/json
{"error":"Unauthorized/Invalid api key"}
```

The 401 fires before body validation, so the auth header is the first wall. The error message mentions `api key` — the `POLY_API_KEY` header name from the docs.

### 2.2 `GET /clob-markets/{condition_id}` → V2 lean schema confirmed

```
$ curl https://clob.polymarket.com/clob-markets/0xaf5e903876ad42de97e1cf02c2ef8484df69bcfc5541b96a400116557d1e504e

HTTP/2 200
{
  "r": { "mi": 50, "ma": 4.5, "e": true, "moas": 30 },
  "t": [
    { "t": "24728518923560590462781163189278709895252190308448350456902151936161951637265", "o": "Yes" },
    { "t": "45723826239462064163562635149866907605746041821652382155618599906100270480124", "o": "No" }
  ],
  "c": "0xaf5e903876ad42de97e1cf02c2ef8484df69bcfc5541b96a400116557d1e504e",
  "mos": 5,
  "mts": 0.01,
  "mbf": 1000,
  "tbf": 1000,
  "ao": true,
  "cbos": true,
  "aot": "2026-03-08T23:25:07Z",
  "ibce": true,
  "fd": { "r": 0.072, "e": 1, "to": true }
}
```

Schema matches `docs.polymarket.com/api-reference/markets/get-clob-market-info.md`.

## 3. Verbatim quotes from Polymarket docs

Source URLs end in `.md` for raw markdown.

### 3.1 EIP-712 domain change

> ```ts
> {
>   name: "Polymarket CTF Exchange",
>   version: "2",                                     // was "1"
>   chainId: 137,
>   verifyingContract: "0xE111180000d2663C0091e4f400237545B87B996B"   // was V1 addr
> }
> ```
> For Neg Risk markets:
> ```ts
> { verifyingContract: "0xe2222d279d744050d28e00520010520000310F59" }
> ```
> Only the Exchange domain changes. The `ClobAuthDomain` used for L1 API authentication stays at version `"1"` — L1/L2 auth is identical in V2.
>
> — `https://docs.polymarket.com/v2-migration.md`

### 3.2 EIP-712 Order type — 12 fields → 11

> ```
> Order(
>   uint256 salt,
>   address maker,
>   address signer,
>   uint256 tokenId,
>   uint256 makerAmount,
>   uint256 takerAmount,
>   uint8 side,
>   uint8 signatureType,
>   uint256 timestamp,    // ms; replaces nonce for per-address uniqueness, not expiration
>   bytes32 metadata,     // zero unless special use
>   bytes32 builder       // zero unless attaching a builder code
> )
> ```
> Removed: `taker`, `expiration`, `nonce`, `feeRateBps`.
>
> — `https://docs.polymarket.com/v2-migration.md`

### 3.3 POST /order wire body

> ```json
> {
>   "order": {
>     "salt": "12345",
>     "maker": "0x...",
>     "signer": "0x...",
>     "tokenId": "102936...",
>     "makerAmount": "1000000",
>     "takerAmount": "2000000",
>     "expiration": "0",
>     "side": "BUY",
>     "signatureType": 1,
>     "timestamp": "1713398400000",
>     "metadata": "0x0000000000000000000000000000000000000000000000000000000000000000",
>     "builder": "0x0000000000000000000000000000000000000000000000000000000000000000",
>     "signature": "0x..."
>   },
>   "owner": "<api-key>",
>   "orderType": "GTC"
> }
> ```
> `expiration` is still in the wire body for GTD/order-expiry handling, but is not part of the V2 EIP-712 signed struct. `taker`, `nonce`, `feeRateBps` are gone. `side` is the string `"BUY"` / `"SELL"` in wire (still `uint8 0/1` in the signed struct).
>
> — `https://docs.polymarket.com/v2-migration.md`

### 3.4 Headers — `POLY_BUILDER_*` removed from /order

> ```yaml
> POLY_ADDRESS: 0x...
> POLY_SIGNATURE: 0x...
> POLY_TIMESTAMP: 1713398400
> POLY_API_KEY: ...
> POLY_PASSPHRASE: ...
> # removed in V2:
> # POLY_BUILDER_API_KEY
> # POLY_BUILDER_SECRET
> # POLY_BUILDER_PASSPHRASE
> # POLY_BUILDER_SIGNATURE
> ```
> Builder attribution moves into the signed `builder` field on the order. The `POLY_BUILDER_*` HMAC headers are gone from `/order`.
>
> — `https://docs.polymarket.com/v2-migration.md`

> Your builder API key isn't retired. The HMAC-based builder API key is still used to authenticate with the Relayer for gasless transactions. Only the order-signing flow moves to the `builderCode` field — your relayer integration keeps the same credentials.
>
> — same doc

So `POLY_BUILDER_*` HMAC stays alive for relayer (`/submit`, `/transactions`) but disappears from `/order` POST.

### 3.5 V2 contract addresses on Polygon

From `https://docs.polymarket.com/resources/contracts.md`:

| Contract | Address |
|---|---|
| CTF Exchange (V2) | `0xE111180000d2663C0091e4f400237545B87B996B` |
| Neg Risk CTF Exchange (V2) | `0xe2222d279d744050d28e00520010520000310F59` |
| Neg Risk Adapter | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
| Conditional Tokens (CTF) | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| pUSD (proxy) | `0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB` |
| Collateral Onramp | `0x93070a847efEf7F70739046A929D47a521F5B8ee` |
| Collateral Offramp | `0x2957922Eb93258b93368531d39fAcCA3B4dC5854` |

Compared to our `src/lib/contracts.ts:11-12`:

| Our V1 (current) | Polymarket V2 |
|---|---|
| `CTF_EXCHANGE_ADDRESS = 0xB5592f7CccA122558D2201e190826276f3a661cb` | `0xE111180000d2663C0091e4f400237545B87B996B` |
| `NEG_RISK_CTF_EXCHANGE_ADDRESS = 0xef02d1Ea5B42432C4E99C2785d1a4020d2FB24F5` | `0xe2222d279d744050d28e00520010520000310F59` |
| `UMA_NEG_RISK_ADAPTER_ADDRESS = 0x724259Fe88100FE18C134324C4853975FBDa4d76` | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` (renamed Neg Risk Adapter) |

### 3.6 pUSD migration — silent UX path

> Polymarket USD (pUSD) replaces USDC.e as the collateral token. Backing is enforced onchain by the smart contract.
> For users on polymarket.com, the frontend handles wrapping automatically with a one-time approval.
>
> — `https://docs.polymarket.com/v2-migration.md`

> To wrap USDC.e into pUSD, first approve the CollateralOnramp contract for the USDC.e amount, then call `wrap()`.
>
> — `https://docs.polymarket.com/concepts/pusd.md`

This is the path: deposit flow detects user has USDC.e but no pUSD, runs an Onramp `wrap()` Safe-tx batched with the USDC.e approval. UI never says "pUSD".

### 3.7 Builder fees are V2-exclusive

> Builder fees are exclusive to CLOB V2.
> Builders configure fees through their account at `polymarket.com/settings?tab=builder`. They set two rates: `builder_taker_fee_bps` (max 100 bps) and `builder_maker_fee_bps` (max 50 bps).
>
> — `https://docs.polymarket.com/builders/fees.md`

So if we want builder revenue, V2 is mandatory. There is no V1 path.

## 4. Field-by-field diff applied to our codebase

### 4.1 `src/lib/constants.ts` (lines 33-62)

```ts
// CURRENT V1
export const EIP712_DOMAIN = {
  name: 'CTF Exchange',                              // → 'Polymarket CTF Exchange'
  version: '1',                                      // → '2'
  chainId: defaultNetwork.id,
  verifyingContract: CTF_EXCHANGE_ADDRESS,
}
export const EIP712_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'maker', type: 'address' },
    { name: 'signer', type: 'address' },
    { name: 'taker', type: 'address' },              // DROP
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },         // DROP (still in wire, not signed)
    { name: 'nonce', type: 'uint256' },              // DROP
    { name: 'feeRateBps', type: 'uint256' },         // DROP
    { name: 'side', type: 'uint8' },
    { name: 'signatureType', type: 'uint8' },
                                                     // ADD timestamp uint256
                                                     // ADD metadata bytes32
                                                     // ADD builder bytes32
  ],
}
```

### 4.2 `src/lib/contracts.ts` (lines 11-19)

```ts
// CURRENT
CTF_EXCHANGE_ADDRESS = '0xB5592f7CccA122558D2201e190826276f3a661cb'
NEG_RISK_CTF_EXCHANGE_ADDRESS = '0xef02d1Ea5B42432C4E99C2785d1a4020d2FB24F5'
UMA_NEG_RISK_ADAPTER_ADDRESS = '0x724259Fe88100FE18C134324C4853975FBDa4d76'

// V2
CTF_EXCHANGE_ADDRESS = '0xE111180000d2663C0091e4f400237545B87B996B'
NEG_RISK_CTF_EXCHANGE_ADDRESS = '0xe2222d279d744050d28e00520010520000310F59'
NEG_RISK_ADAPTER_ADDRESS = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296'   // NEW
PUSD_ADDRESS = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB'                // NEW
COLLATERAL_ONRAMP_ADDRESS = '0x93070a847efEf7F70739046A929D47a521F5B8ee'   // NEW
```

`UMA_NEG_RISK_ADAPTER_ADDRESS` keeps its name (used for UMA-specific paths). The new `NEG_RISK_ADAPTER_ADDRESS` is a different Polymarket V2 contract and is what `safe/transactions.ts buildApproveTokenTransactions` should approve as a spender.

### 4.3 `src/types/index.ts` (line 435 — `BlockchainOrder`)

Drop fields: `taker`, `expiration` (no — keep, used in wire), `nonce`, `fee_rate_bps`.

Wait — `expiration` is needed in the wire body for GTD orders. So `BlockchainOrder` keeps `expiration` in the type; it's just not in the signed struct. `signOrderPayload` reads from `BlockchainOrder` minus expiration; `serializeOrder` writes the wire body which still includes expiration.

Add fields: `timestamp: bigint`, `metadata: \`0x${string}\``, `builder: \`0x${string}\``.

### 4.4 `src/lib/orders/index.ts` (`buildOrderPayload`)

```ts
return {
  salt,
  maker,
  signer: userAddress,
  // taker: ZERO_ADDRESS,   // DROP
  token_id: BigInt(outcome.token_id),
  maker_amount: makerAmount,
  taker_amount: takerAmount,
  expiration: expirationValue,                       // KEEP (wire only, not signed)
  // nonce: 0n,             // DROP
  side: rest.side,
  // fee_rate_bps,          // DROP
  signature_type: signatureTypeValue,
  timestamp: BigInt(Date.now()),                     // NEW — milliseconds
  metadata: ZERO_BYTES32,                            // NEW
  builder: process.env.POLYMARKET_BUILDER_CODE
    ?? ZERO_BYTES32,                                 // NEW
}
```

Add `ZERO_BYTES32 = '0x' + '00'.repeat(32)` in `contracts.ts`.

### 4.5 `src/lib/orders/signing.ts` (`signOrderPayload`)

Build the typed-data `message` from the V2 11 fields (no taker/expiration/nonce/feeRateBps). viem's `signTypedData({ types: EIP712_TYPES, ... })` reads only fields named in `EIP712_TYPES.Order`, so as long as constants.ts is updated, signing.ts naturally signs the right thing. The explicit field assignments in signing.ts that reference `taker` / `feeRateBps` need to be removed and replaced with `timestamp` / `metadata` / `builder`.

### 4.6 `_actions/store-order.ts` (lines 22-30 zod, 282-300 wire body, 318-323 headers)

- Zod schema: drop `taker`, `nonce`, `fee_rate_bps`. Add `timestamp` (string), `metadata` (string), `builder` (string).
- `clobPayload.order`: remove `taker`, `nonce`, `feeRateBps`. Add `timestamp`, `metadata`, `builder`. Keep `expiration` (V2 wire still expects it for GTD).
- Headers: rename **all 5** `KUEST_*` → `POLY_*`. HMAC algorithm unchanged.
- Drop `POLY_BUILDER_*` headers from `/order` POST (we don't currently send any — was in plan-19 but contradicted by V2 docs).

### 4.7 `_actions/cancel-market-orders.ts:65-68`

`assetId` → `asset_id` per V2 wire convention. KUEST_* → POLY_* on the auth headers.

### 4.8 Other endpoints sending `KUEST_*` (need rename to `POLY_*`)

```
$ git grep -l "KUEST_" src/
```
Run this in V2.2; rename everywhere except inside the kuest fork comments. HMAC algorithm is byte-identical between kuest and Polymarket, only the header **names** change.

### 4.9 Relayer flows — keep `POLY_BUILDER_*` HMAC

Files to NOT touch in V2.5:
- `_actions/proxy-wallet.ts` — calls `/submit`
- `_actions/approve-tokens.ts` — calls relayer
- `(platform)/portfolio/_actions/pending-deposit.ts`

These use `POLY_BUILDER_API_KEY` + `POLY_BUILDER_SECRET` HMAC. Per docs, relayer auth is unchanged in V2.

### 4.10 New file: `src/lib/polymarket/onramp.ts`

```ts
// Builds a Safe-tx batch:
//   1. USDC.e.approve(Onramp, amount)
//   2. Onramp.wrap(amount, recipient)
// Used in deposit flow; user never sees "pUSD" in UI.
```

### 4.11 New file: `src/lib/polymarket/clob-market-info.ts`

```ts
// GET /clob-markets/{condition_id} → { mts, mos, mbf, tbf, t: [{t, o}], fd: {r, e, to}, ... }
// Used by order panel for tick size + min order size + fee preview.
```

### 4.12 `src/lib/safe/transactions.ts buildApproveTokenTransactions`

V2 spender set per `wagmi-safe-builder-example/utils/approvals.ts`:

- pUSD `approve()` to: `CONDITIONAL_TOKENS_CONTRACT, NEG_RISK_ADAPTER, CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE` (4 spenders).
- ERC1155 `setApprovalForAll()` on: `CTF_EXCHANGE, NEG_RISK_CTF_EXCHANGE, NEG_RISK_ADAPTER` (3 operators).

Replaces the current 2-spender list at `src/lib/safe/transactions.ts:212-217`.

## 5. What is NOT in this spec (out of scope for V2.x)

- `@polymarket/clob-client-v2` SDK adoption — explicitly rejected per decision log.
- `POLYMARKET_BUILDER_CODE` env addition — already present and correct.
- WebSocket subscribe shape changes (`/ws/market`, `/ws/user`, RTDS) — separate spec doc later.
- Frontend pUSD UI strings — UI keeps showing "USDC".
- Removing `/data/volumes` cron — kuest still has it, gamma populates `volume`. Will revisit only if a live probe today shows V2 endpoint fails.
- Dropping `/user-pnl` calls — separate cleanup, not part of V2 trading core.

## 6. Sub-phases — execution order

Each sub-phase ends green on `tsc + eslint + vitest run`.

| # | Title | Files | Validates |
|---|---|---|---|
| V2.1 | Types + constants + addresses + builder/sign | constants.ts, contracts.ts, types/index.ts, orders/index.ts, orders/signing.ts | tsc, lint, vitest |
| V2.2 | store-order action V2 wire + KUEST_→POLY_ rename | store-order.ts + every file with `KUEST_` headers | tsc, lint, vitest, **dev-server probe POST /order** with the new shape from a logged-in test wallet (curl with our session cookie) |
| V2.3 | pUSD wrap helper + V2 token approvals | New `lib/polymarket/onramp.ts`, `safe/transactions.ts` | tsc, lint, vitest, **calldata decode** of the produced Safe-tx |
| V2.4 | getClobMarketInfo helper | New `lib/polymarket/clob-market-info.ts`, hook into order panel | tsc, lint, vitest, **GET probe** confirms tick/min flow into UI |
| V2.5 | Live test gate | (no code) | **You authorize**, place 1-share far-OTM order, verify orderID + builder attribution in `/builder/trades` |

Rollback if any sub-phase fails: `git revert <V2.x commit>`. Each sub-phase is an isolated commit on a feature branch — main stays green.

## 7. Risks I want flagged before V2.1

1. **`signatureType` default.** Our V1 default is `0` (EOA). Polymarket V2 most users have a Gnosis Safe → `signatureType=2` (POLY_GNOSIS_SAFE). Need to verify what our `_actions/trading-auth.ts` flow sets. If it sets 0 for users with proxy wallets, orders signed by EOA will not match the on-chain Safe owner check and will reject. Tracking; will pre-read in V2.1.

2. **`expiration: "0"` in wire body for GTC.** Docs example shows `"expiration": "0"` — meaning never. For GTC this is correct. For GTD we must pass a non-zero unix-seconds value. Our existing `expirationTimestamp` arg in `buildOrderPayload` already does this; just need to confirm units (seconds vs ms — V2 `timestamp` is **ms**, but `expiration` in wire is **seconds** per spec).

3. **Maker / signer when proxy wallet exists.** For Safe users, `maker = funderAddress = proxy_wallet`, `signer = EOA`. Our current code at `store-order.ts:276` already enforces `validated.data.maker.toLowerCase() === user.proxy_wallet_address.toLowerCase()`. Should still work, but verify on first live test.

## 8. Estimate

- V2.1: ~1 turn, ~6 files changed.
- V2.2: ~1 turn, ~10 files changed (mostly mechanical KUEST_→POLY_).
- V2.3: ~1 turn, ~3 files changed.
- V2.4: ~1 turn, ~2 files changed.
- V2.5: 0 code; user-driven live test.

Total: ~21 files modified, ~3 new files. No new dependencies. No DB schema change in V2.x (orders table keeps V1 columns nullable for historical rows; new V2 columns only if we want to query timestamp/metadata/builder later — defer).
