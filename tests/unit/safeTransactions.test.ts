import { describe, expect, it } from 'vitest'
import { decodeFunctionData, erc20Abi } from 'viem'
import { COLLATERAL_ONRAMP_ADDRESS, COLLATERAL_TOKEN_ADDRESS, NATIVE_USDC_TOKEN_ADDRESS } from '@/lib/contracts'
import { buildApproveTokenTransactions } from '@/lib/safe/transactions'

describe('safe transactions', () => {
  it('approves both supported USDC variants for the collateral onramp', () => {
    const transactions = buildApproveTokenTransactions()
    const approvals = transactions
      .filter(transaction =>
        transaction.to.toLowerCase() === COLLATERAL_TOKEN_ADDRESS.toLowerCase()
        || transaction.to.toLowerCase() === NATIVE_USDC_TOKEN_ADDRESS.toLowerCase(),
      )
      .map(transaction => ({
        token: transaction.to.toLowerCase(),
        decoded: decodeFunctionData({ abi: erc20Abi, data: transaction.data }),
      }))

    expect(approvals.map(approval => approval.token)).toEqual([
      COLLATERAL_TOKEN_ADDRESS.toLowerCase(),
      NATIVE_USDC_TOKEN_ADDRESS.toLowerCase(),
    ])
    for (const approval of approvals) {
      expect(approval.decoded.functionName).toBe('approve')
      expect(approval.decoded.args[0].toLowerCase()).toBe(COLLATERAL_ONRAMP_ADDRESS.toLowerCase())
    }
  })
})
