import { IS_TEST_MODE } from '@/lib/network'

export const NATIVE_USDC_TOKEN_ADDRESS = IS_TEST_MODE
  ? '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' as `0x${string}`
  : '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' as `0x${string}`
export const COLLATERAL_TOKEN_ADDRESS = IS_TEST_MODE
  ? '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582' as `0x${string}`
  : '0x2791bca1f2de4661ed88a30c99a7a9449aa84174' as `0x${string}`

// Polymarket V2 Conditional Tokens (CTF). Verbatim from
// `docs.polymarket.com/resources/contracts.md`. V1 used the canonical Gnosis
// CTF at 0x4682…A9C7; V2 ships its own CTF deployment.
export const CONDITIONAL_TOKENS_CONTRACT = '0x4D97DCd97eC945f40cF65F87097ACe5EA0476045' as `0x${string}`

// CLOB V2 exchanges. Verbatim from
// `docs.polymarket.com/resources/contracts.md` and the V2 cutover on
// 2026-04-28. The V1 addresses (0xB5592f7C…/0xef02d1Ea…) no longer accept
// orders on production.
export const CTF_EXCHANGE_ADDRESS = '0xE111180000d2663C0091e4f400237545B87B996B' as `0x${string}`
export const NEG_RISK_CTF_EXCHANGE_ADDRESS = '0xe2222d279d744050d28e00520010520000310F59' as `0x${string}`

// V2 Polymarket Neg Risk Adapter — used as a token-approval spender for
// neg-risk markets. Distinct from `UMA_NEG_RISK_ADAPTER_ADDRESS`, which is
// the UMA-resolver flow and stays at its V1 address.
export const NEG_RISK_ADAPTER_ADDRESS = '0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296' as `0x${string}`

// pUSD — the V2 collateral token. Backed 1:1 by USDC.e. Users keep depositing
// USDC.e in our UI; the deposit flow wraps to pUSD via the Onramp transparently.
export const PUSD_ADDRESS = '0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB' as `0x${string}`
export const COLLATERAL_ONRAMP_ADDRESS = '0x93070a847efEf7F70739046A929D47a521F5B8ee' as `0x${string}`
export const COLLATERAL_OFFRAMP_ADDRESS = '0x2957922Eb93258b93368531d39fAcCA3B4dC5854' as `0x${string}`

export const UMA_CTF_ADAPTER_POLYMARKET_ADDRESS = '0x65070BE91477460D8A7AeEb94ef92fe056C2f2A7' as `0x${string}`
export const UMA_NEG_RISK_ADAPTER_POLYMARKET_ADDRESS = '0x2F5e3684cb1F318ec51b00Edba38d79Ac2c0aA9d' as `0x${string}`
export const UMA_CTF_ADAPTER_ADDRESS = '0x20088f6aa9D8D5947c9f002167355Cb332134bf8' as `0x${string}`
export const UMA_NEG_RISK_ADAPTER_ADDRESS = '0x724259Fe88100FE18C134324C4853975FBDa4d76' as `0x${string}`
export const SAFE_MULTISEND_ADDRESS = '0xA238CBeb142c10Ef7Ad8442C6D1f9E89e07e7761' as `0x${string}`

// Canonical Polymarket Safe Factory. Verbatim from
// `@polymarket/builder-relayer-client@0.0.6/dist/config/index.js`. The V2 CTF
// Exchange has this factory's address baked into its immutable bytecode, so
// using the wrong factory makes the V2 Exchange reject our orders.
export const SAFE_PROXY_FACTORY_ADDRESS = '0xaacFeEa03eb1561C4e67d661e40682Bd20E3541b' as `0x${string}`
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as `0x${string}`
export const ZERO_COLLECTION_ID = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
export const ZERO_BYTES32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`
