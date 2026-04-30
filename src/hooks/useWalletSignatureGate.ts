'use client'

import { useCallback } from 'react'
import { useAccount, useChainId, useSwitchChain } from 'wagmi'
import { defaultNetwork } from '@/lib/appkit'
import { normalizeAddress } from '@/lib/wallet'

export function useWalletSignatureGate(expectedAddress?: string | null) {
  const account = useAccount()
  const chainId = useChainId()
  const { switchChainAsync } = useSwitchChain()

  return useCallback(async () => {
    const expected = normalizeAddress(expectedAddress)
    const connected = normalizeAddress(account.address)

    if (!expected) {
      throw new Error('Connect your wallet before signing.')
    }

    if (!account.isConnected || !connected) {
      throw new Error('Connect your wallet before signing.')
    }

    if (connected.toLowerCase() !== expected.toLowerCase()) {
      throw new Error('The connected wallet does not match your signed-in wallet. Switch wallets and try again.')
    }

    if (chainId !== defaultNetwork.id) {
      try {
        await switchChainAsync({ chainId: defaultNetwork.id })
      }
      catch {
        throw new Error(`Switch your wallet to ${defaultNetwork.name} and try again.`)
      }
    }
  }, [account.address, account.isConnected, chainId, expectedAddress, switchChainAsync])
}
