import type { SafeTransaction } from '@/lib/safe/transactions'
import { encodeFunctionData } from 'viem'
import {
  COLLATERAL_OFFRAMP_ADDRESS,
  COLLATERAL_ONRAMP_ADDRESS,
  COLLATERAL_TOKEN_ADDRESS,
} from '@/lib/contracts'
import { SafeOperationType } from '@/lib/safe/transactions'

/**
 * Polymarket Collateral Onramp / Offramp wrappers.
 *
 * V2 settles trades in pUSD, but we keep the user-facing UX in USDC. The
 * Onramp/Offramp pair handles 1:1 conversion onchain:
 *
 *   - `Onramp.wrap(asset, recipient, amount)` pulls `asset` from `recipient`
 *     and mints `amount` pUSD to `recipient`.
 *   - `Offramp.unwrap(asset, recipient, amount)` does the reverse.
 *
 * The deployed `CollateralOnramp` at `COLLATERAL_ONRAMP_ADDRESS` accepts
 * BOTH native (Circle) USDC at `0x3c499c…` and bridged USDC.e at
 * `0x2791bca1…`. The pUSD docs only documented USDC.e; the on-chain ABI is
 * looser. Verified against the deployed contract source.
 *
 * Function signatures (verbatim from the deployed contract):
 *   `function wrap(address _asset, address _to, uint256 _amount) external`
 *   `function unwrap(address _asset, address _to, uint256 _amount) external`
 */

const collateralOnrampAbi = [
  {
    name: 'wrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

const collateralOfframpAbi = [
  {
    name: 'unwrap',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_asset', type: 'address' },
      { name: '_to', type: 'address' },
      { name: '_amount', type: 'uint256' },
    ],
    outputs: [],
  },
] as const

export interface WrapTransactionArgs {
  /** Recipient of the minted pUSD. Typically the user's Safe address. */
  recipient: `0x${string}`
  /** Amount of USDC.e (6-decimals base units) to convert into pUSD. */
  amountBaseUnits: bigint
  /**
   * Override the source asset address. Defaults to USDC.e
   * (`COLLATERAL_TOKEN_ADDRESS`). The Onramp accepts other configured assets
   * as well, but the only one we surface in our deposit flow is USDC.e.
   */
  asset?: `0x${string}`
}

/**
 * Build a Safe-tx that wraps USDC.e into pUSD via the Collateral Onramp. The
 * Safe must already have approved the Onramp to spend its USDC.e
 * (`buildApproveTokenTransactions` handles this in the onboarding batch).
 */
export function buildOnrampWrapTransaction(args: WrapTransactionArgs): SafeTransaction {
  return {
    to: COLLATERAL_ONRAMP_ADDRESS as `0x${string}`,
    value: '0',
    data: encodeFunctionData({
      abi: collateralOnrampAbi,
      functionName: 'wrap',
      args: [
        args.asset ?? COLLATERAL_TOKEN_ADDRESS,
        args.recipient,
        args.amountBaseUnits,
      ],
    }),
    operation: SafeOperationType.Call,
  }
}

export interface UnwrapTransactionArgs {
  recipient: `0x${string}`
  amountBaseUnits: bigint
  asset?: `0x${string}`
}

/**
 * Build a Safe-tx that unwraps pUSD back into USDC.e via the Collateral
 * Offramp. Used in the withdrawal flow when the user wants USDC out.
 */
export function buildOfframpUnwrapTransaction(args: UnwrapTransactionArgs): SafeTransaction {
  return {
    to: COLLATERAL_OFFRAMP_ADDRESS as `0x${string}`,
    value: '0',
    data: encodeFunctionData({
      abi: collateralOfframpAbi,
      functionName: 'unwrap',
      args: [
        args.asset ?? COLLATERAL_TOKEN_ADDRESS,
        args.recipient,
        args.amountBaseUnits,
      ],
    }),
    operation: SafeOperationType.Call,
  }
}
