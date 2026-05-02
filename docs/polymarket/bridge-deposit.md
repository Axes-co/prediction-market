---
title: Polymarket Bridge Deposit (offline reference)
---

# Polymarket Bridge Deposit (offline reference)

> Source: https://docs.polymarket.com/trading/bridge/deposit
> Saved: 2026-05-02

Polymarket uses **pUSD** (Polymarket USD) on Polygon as collateral for all trading. The Bridge API lets users deposit assets from any supported chain — they're auto-converted to pUSD on Polygon.

## Flow

1. Request deposit addresses for the user's Polymarket wallet
2. User sends assets to the appropriate address for their source chain
3. Assets are bridged + swapped to pUSD automatically
4. pUSD credited to wallet, ready to trade

## Endpoint

```bash
curl -X POST https://bridge.polymarket.com/deposit \
  -H "Content-Type: application/json" \
  -d '{"address": "0x56687bf447db6ffa42ffe2204a05edaa20f55839"}'
```

Response: deposit addresses for each supported chain.

## Address types

| Address | Use For                                                  |
| ------- | -------------------------------------------------------- |
| `evm`   | Ethereum, Arbitrum, Base, Optimism, and other EVM chains |
| `svm`   | Solana                                                   |
| `btc`   | Bitcoin                                                  |
| `tvm`   | Tron                                                     |

Each address is **unique to the user wallet**. Only send assets from supported chains to the correct address type.

## Other endpoints

- `/supported-assets` — verify token support and minimum deposit amounts.
- `/status/{address}` — track deposit progress.

## USDC vs pUSD

User can deposit either USDC (native) or USDC.e (bridged) as the source asset. Either is wrapped into pUSD via the Collateral Onramp (`COLLATERAL_ONRAMP_ADDRESS = 0x93070a847efEf7F70739046A929D47a521F5B8ee` per our `src/lib/contracts.ts`).

## Large deposits (> $50k)

Recommended third-party bridges (not Polymarket-affiliated):
- DeBridge: https://app.debridge.finance/
- Across:   https://app.across.to/bridge
- Portal:   https://portalbridge.com/

Bridge directly to the user's Polygon USDC deposit address.

## Recovery (wrong-token deposits)

- Ethereum: https://recovery.polymarket.com/
- Polygon:  https://matic-recovery.polymarket.com/

## Where this applies in our app

- `src/app/api/lifi/quote/route.ts` calls LI.FI's quote API to bridge to USDC on Polygon. We pin `toChain=137` and `toToken=COLLATERAL_TOKEN_ADDRESS` (Polygon USDC).
- After the bridge completes, our deposit flow wraps USDC into pUSD via the Onramp (`COLLATERAL_ONRAMP_ADDRESS`).
- We use LI.FI rather than Polymarket's `/bridge` endpoint because LI.FI gives us cross-chain flexibility plus a quote API for the UI; Polymarket's `/bridge` is just an address-issuer (no quote / no UI helper).

If LI.FI degrades or costs become an issue, the migration target is to issue Polymarket Bridge deposit addresses via `/deposit` and let the user send from their native wallet directly. That removes our LI.FI dep but loses cross-chain quoting.
