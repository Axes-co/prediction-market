'use client'

import type { SafeOperationType } from '@/lib/safe/transactions'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowDownToLineIcon, CheckIcon, Loader2Icon } from 'lucide-react'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { hashTypedData } from 'viem'
import { useSignMessage } from 'wagmi'
import { useTradingOnboarding } from '@/app/[locale]/(platform)/_providers/TradingOnboardingProvider'
import { buildPendingUsdcSwapAction, submitPendingUsdcSwapAction } from '@/app/[locale]/(platform)/portfolio/_actions/pending-deposit'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { SAFE_BALANCE_QUERY_KEY } from '@/hooks/useBalance'
import { usePendingUsdcDeposit } from '@/hooks/usePendingUsdcDeposit'
import { useSignaturePromptRunner } from '@/hooks/useSignaturePromptRunner'
import { useWalletSignatureGate } from '@/hooks/useWalletSignatureGate'
import { useRouter } from '@/i18n/navigation'
import { defaultNetwork } from '@/lib/appkit'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { formatCurrency } from '@/lib/formatters'
import { IS_TEST_MODE } from '@/lib/network'
import { getSafeTxTypedData, packSafeSignature } from '@/lib/safe/transactions'
import { isTradingAuthRequiredError } from '@/lib/trading-auth/errors'
import { triggerConfettiColorful } from '@/lib/utils'
import { isUserRejectedRequestError } from '@/lib/wallet'
import { useUser } from '@/stores/useUser'

const CONFIRMATION_DELAY_MS = 900

type PendingDepositStep = 'prompt' | 'signing' | 'success'

function usePendingDepositDialogState() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<PendingDepositStep>('prompt')
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const resetDialogState = useCallback(() => {
    setStep('prompt')
    setStatusMessage(null)
  }, [])

  const openDialog = useCallback(() => {
    resetDialogState()
    setOpen(true)
  }, [resetDialogState])

  const closeDialog = useCallback(() => {
    setOpen(false)
    resetDialogState()
  }, [resetDialogState])

  const handleOpenChange = useCallback((next: boolean) => {
    if (next) {
      openDialog()
      return
    }

    closeDialog()
  }, [openDialog, closeDialog])

  return {
    open,
    step,
    setStep,
    statusMessage,
    setStatusMessage,
    openDialog,
    closeDialog,
    handleOpenChange,
  }
}

function usePendingDepositSwap({
  step,
  setStep,
  setStatusMessage,
  closeDialog,
  userAddress,
  userProxyWalletAddress,
  pendingBalance,
  refetchPendingDeposit,
  invalidateTradeBalance,
  openTradeRequirements,
  runWithSignaturePrompt,
  requireSignatureWallet,
  signMessageAsync,
}: {
  step: PendingDepositStep
  setStep: (step: PendingDepositStep) => void
  setStatusMessage: (message: string | null) => void
  closeDialog: () => void
  userAddress: string | null
  userProxyWalletAddress: string | null
  pendingBalance: ReturnType<typeof usePendingUsdcDeposit>['pendingBalance']
  refetchPendingDeposit: () => void
  invalidateTradeBalance: () => void
  openTradeRequirements: ReturnType<typeof useTradingOnboarding>['openTradeRequirements']
  runWithSignaturePrompt: ReturnType<typeof useSignaturePromptRunner>['runWithSignaturePrompt']
  requireSignatureWallet: () => Promise<void>
  signMessageAsync: ReturnType<typeof useSignMessage>['signMessageAsync']
}) {
  const handleConfirm = useCallback(async () => {
    if (step === 'signing') {
      return
    }

    if (IS_TEST_MODE) {
      setStatusMessage('Swap is disabled on test Mode.')
      return
    }

    if (!userAddress || !userProxyWalletAddress) {
      toast.error('Connect your wallet to continue.')
      return
    }

    // Pick whichever variant has the larger balance — the Onramp accepts both
    // native USDC and USDC.e per the deployed contract. If both have funds,
    // wrap the bigger one first; the smaller stays as a follow-up pending
    // deposit on the next render.
    const assetToWrap = pendingBalance.bridged && pendingBalance.native
      ? (BigInt(pendingBalance.bridged.rawBase) >= BigInt(pendingBalance.native.rawBase)
          ? pendingBalance.bridged
          : pendingBalance.native)
      : pendingBalance.bridged ?? pendingBalance.native ?? null

    if (!assetToWrap || assetToWrap.rawBase === '0') {
      toast.error('No pending deposit found.')
      return
    }

    setStatusMessage(null)
    setStep('signing')

    try {
      await requireSignatureWallet()
      const buildResult = await buildPendingUsdcSwapAction({
        amount: assetToWrap.rawBase,
        asset: assetToWrap.asset,
      })

      if (buildResult.error || !buildResult.payload) {
        if (isTradingAuthRequiredError(buildResult.error)) {
          closeDialog()
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(buildResult.error ?? DEFAULT_ERROR_MESSAGE)
        }
        setStep('prompt')
        return
      }

      const { transaction, nonce, signatureParams } = buildResult.payload
      const typedData = getSafeTxTypedData({
        chainId: defaultNetwork.id,
        safeAddress: userProxyWalletAddress as `0x${string}`,
        transaction: {
          to: transaction.to as `0x${string}`,
          value: transaction.value,
          data: transaction.data as `0x${string}`,
          operation: transaction.operation as SafeOperationType,
        },
        nonce,
      })

      const { signatureParams: typedSignatureParams, ...safeTypedData } = typedData
      const structHash = hashTypedData({
        domain: safeTypedData.domain,
        types: safeTypedData.types,
        primaryType: safeTypedData.primaryType,
        message: safeTypedData.message,
      }) as `0x${string}`

      const signature = await runWithSignaturePrompt(() => signMessageAsync({ message: { raw: structHash } }))
      const submitPayload = {
        type: 'SAFE' as const,
        from: userAddress,
        to: transaction.to,
        proxyWallet: userProxyWalletAddress,
        data: transaction.data,
        nonce,
        signature: packSafeSignature(signature as `0x${string}`),
        signatureParams: signatureParams ?? typedSignatureParams,
        metadata: 'wrap_usdc_e',
      }

      const submitResult = await submitPendingUsdcSwapAction(submitPayload)
      if (submitResult.error) {
        if (isTradingAuthRequiredError(submitResult.error)) {
          closeDialog()
          openTradeRequirements({ forceTradingAuth: true })
        }
        else {
          toast.error(submitResult.error)
        }
        setStep('prompt')
        return
      }

      await new Promise(resolve => setTimeout(resolve, CONFIRMATION_DELAY_MS))
      setStep('success')
      triggerConfettiColorful()
      // The wrap consumes the source USDC and mints pUSD to the proxy. Both
      // the pre-wrap (USDC variants) and post-wrap (pUSD) balances changed,
      // so refresh both readers — otherwise trade panels still show $0
      // until their interval poll catches up.
      void refetchPendingDeposit()
      invalidateTradeBalance()
    }
    catch (error) {
      if (!isUserRejectedRequestError(error)) {
        const message = error instanceof Error ? error.message : DEFAULT_ERROR_MESSAGE
        toast.error(message)
      }
      setStep('prompt')
    }
  }, [
    closeDialog,
    invalidateTradeBalance,
    openTradeRequirements,
    pendingBalance,
    refetchPendingDeposit,
    requireSignatureWallet,
    runWithSignaturePrompt,
    setStatusMessage,
    setStep,
    signMessageAsync,
    step,
    userAddress,
    userProxyWalletAddress,
  ])

  return { handleConfirm }
}

export default function PendingDepositBanner() {
  const { pendingBalance, hasPendingDeposit, refetchPendingDeposit } = usePendingUsdcDeposit()
  const queryClient = useQueryClient()
  const { signMessageAsync } = useSignMessage()
  const { runWithSignaturePrompt } = useSignaturePromptRunner()
  const router = useRouter()
  const user = useUser()
  const userAddress = user?.address ?? null
  const userProxyWalletAddress = user?.proxy_wallet_address ?? null
  const requireSignatureWallet = useWalletSignatureGate(userAddress)
  const { openTradeRequirements } = useTradingOnboarding()
  const {
    open,
    step,
    setStep,
    statusMessage,
    setStatusMessage,
    openDialog,
    closeDialog,
    handleOpenChange,
  } = usePendingDepositDialogState()
  const invalidateTradeBalance = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [SAFE_BALANCE_QUERY_KEY] })
  }, [queryClient])
  const { handleConfirm } = usePendingDepositSwap({
    step,
    setStep,
    setStatusMessage,
    closeDialog,
    userAddress,
    userProxyWalletAddress,
    pendingBalance,
    refetchPendingDeposit,
    invalidateTradeBalance,
    openTradeRequirements,
    runWithSignaturePrompt,
    requireSignatureWallet,
    signMessageAsync,
  })

  const formattedAmount = formatCurrency(pendingBalance.raw, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (!hasPendingDeposit) {
    return null
  }

  return (
    <>
      <Button
        className="h-11 w-full justify-between px-4 text-left"
        onClick={openDialog}
      >
        <span className="text-sm font-semibold">Confirm pending deposit</span>
        <ArrowDownToLineIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-md border bg-background p-8 text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-yes">
            {step === 'signing'
              ? <Loader2Icon className="size-9 animate-spin text-background" />
              : <CheckIcon className="size-10 text-background" />}
          </div>

          {step === 'signing' && (
            <p className="mt-6 text-base font-semibold text-foreground">Waiting for signature...</p>
          )}

          {step === 'prompt' && (
            <p className="mt-6 text-base font-semibold text-foreground">
              Activate your funds (
              {formattedAmount}
              ) to begin trading.
            </p>
          )}

          {step === 'success' && (
            <p className="mt-6 text-base font-semibold text-foreground">Your funds are available to trade!</p>
          )}

          {step === 'prompt' && (
            <Button className="mt-6 h-11 w-full text-base" onClick={handleConfirm}>
              Continue
            </Button>
          )}

          {step === 'prompt' && statusMessage && (
            <div className="mt-3 text-sm text-muted-foreground">
              {statusMessage}
            </div>
          )}

          {step === 'signing' && (
            <div className="mt-6 text-sm text-muted-foreground">
              Confirm the signature in your wallet.
            </div>
          )}

          {step === 'success' && (
            <Button
              className="mt-6 h-11 w-full text-base"
              onClick={() => {
                closeDialog()
                router.push('/')
              }}
            >
              Start Trading
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
