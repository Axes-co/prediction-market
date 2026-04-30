'use client'

import Image from 'next/image'
import QRCode from 'react-qr-code'
import WalletAddressCard from '@/app/[locale]/(platform)/_components/wallet-modal/WalletAddressCard'
import { useSiteIdentity } from '@/hooks/useSiteIdentity'
import { COLLATERAL_TOKEN_ADDRESS } from '@/lib/contracts'

// The Polymarket V2 Onramp wraps `USDC.e` (bridged USDC, ERC-20 at
// `COLLATERAL_TOKEN_ADDRESS`) into pUSD. Native (Circle) USDC sent to the
// proxy is unwrappable and would sit invisible to the deposit detector. The
// receive UI must surface USDC.e specifically so users select the right token
// in their external wallet.
const USDC_E_LABEL = 'USDC.e'

function WalletReceiveView({
  walletAddress,
  siteName,
  onCopy,
  copied,
}: {
  walletAddress?: string | null
  siteName?: string
  onCopy: () => void
  copied: boolean
}) {
  const site = useSiteIdentity()
  const siteLabel = siteName ?? site.name

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-center text-sm font-semibold text-muted-foreground">
          <span>
            Scan QR Code or copy your
            {' '}
            {siteLabel}
            {' '}
            wallet address to transfer
          </span>
          {' '}
          <span className="inline-flex items-center gap-1 align-middle">
            <Image
              src="/images/deposit/transfer/usdc_dark.png"
              alt={USDC_E_LABEL}
              width={14}
              height={14}
              className="block"
            />
            <span>{USDC_E_LABEL}</span>
          </span>
          {' '}
          <span>on</span>
          {' '}
          <span className="inline-flex items-center gap-1 align-middle">
            <Image
              src="/images/deposit/transfer/polygon_dark.png"
              alt="Polygon"
              width={14}
              height={14}
              className="block"
            />
            <span>Polygon</span>
          </span>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Bridged USDC (
          <code className="rounded-sm bg-muted px-1 py-0.5 text-[0.7rem]">{COLLATERAL_TOKEN_ADDRESS}</code>
          ). Other USDC variants are not auto-detected.
        </p>
        <div className="flex justify-center">
          <div className="rounded-lg border bg-white p-2 transition">
            {walletAddress
              ? <QRCode value={walletAddress} size={200} />
              : <p className="text-sm">Proxy wallet not ready yet.</p>}
          </div>
        </div>
      </div>
      <WalletAddressCard
        walletAddress={walletAddress}
        onCopy={onCopy}
        copied={copied}
        label=""
      />
    </div>
  )
}

export default WalletReceiveView
