import { describe, expect, it } from 'vitest'
import {
  groupAllowedMarketCreatorItems,
  isGammaApiSourceKey,
  isPublicAllowedMarketCreatorsResponse,
  normalizeAllowedMarketCreatorGammaApiInput,
  normalizeAllowedMarketCreatorSiteInput,
} from '@/lib/allowed-market-creators'

describe('allowed market creators helpers', () => {
  it('normalizes a bare domain into an https endpoint', () => {
    const result = normalizeAllowedMarketCreatorSiteInput('site2.com')

    expect('error' in result).toBe(false)
    if ('error' in result) {
      return
    }

    expect(result.origin).toBe('https://site2.com')
    expect(result.displayName).toBe('site2.com')
    expect(result.endpointUrl).toBe('https://site2.com/api/allowed-market-creators')
  })

  it('rejects invalid site input', () => {
    const result = normalizeAllowedMarketCreatorSiteInput('://bad-url')
    expect(result).toEqual({ error: 'Site URL is invalid.' })
  })

  it('rejects localhost and private-network site inputs', () => {
    expect(normalizeAllowedMarketCreatorSiteInput('http://localhost:3000')).toEqual({
      error: 'Site URL must point to a public host.',
    })
    expect(normalizeAllowedMarketCreatorSiteInput('http://127.0.0.1:3000')).toEqual({
      error: 'Site URL must point to a public host.',
    })
    expect(normalizeAllowedMarketCreatorSiteInput('https://192.168.1.10')).toEqual({
      error: 'Site URL must point to a public host.',
    })
  })

  it('allows public IPv6 hosts that only compress leading zero hextets', () => {
    const result = normalizeAllowedMarketCreatorSiteInput('https://[::fe80:1]')

    expect('error' in result).toBe(false)
    if ('error' in result) {
      return
    }

    expect(result.origin).toBe('https://[::fe80:1]')
    expect(result.displayName).toBe('[::fe80:1]')
    expect(result.endpointUrl).toBe('https://[::fe80:1]/api/allowed-market-creators')
  })

  it('groups site-backed rows into one removable source item', () => {
    expect(groupAllowedMarketCreatorItems([
      {
        walletAddress: '0x1111111111111111111111111111111111111111',
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x2222222222222222222222222222222222222222',
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
        displayName: 'Wallet 1',
        sourceUrl: null,
        sourceType: 'wallet',
      },
    ])).toEqual([
      {
        walletAddress: null,
        walletCount: 2,
        displayName: 'site2.com',
        sourceUrl: 'https://site2.com',
        sourceType: 'site',
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
        walletCount: 1,
        displayName: 'Wallet 1',
        sourceUrl: null,
        sourceType: 'wallet',
      },
    ])
  })

  it('validates the public endpoint response shape', () => {
    expect(isPublicAllowedMarketCreatorsResponse({
      wallets: ['0x1111111111111111111111111111111111111111'],
    })).toBe(true)

    expect(isPublicAllowedMarketCreatorsResponse(['0x1111111111111111111111111111111111111111'])).toBe(false)
  })

  describe('normalizeAllowedMarketCreatorGammaApiInput', () => {
    it('normalizes a bare gamma host to https origin', () => {
      const result = normalizeAllowedMarketCreatorGammaApiInput('gamma-api.polymarket.com')
      expect('error' in result).toBe(false)
      if ('error' in result) return
      expect(result.origin).toBe('https://gamma-api.polymarket.com')
      expect(result.displayName).toBe('gamma-api.polymarket.com')
      expect(result.sourceKey).toBe('gamma:https://gamma-api.polymarket.com')
    })

    it('uses caller-supplied display name when present', () => {
      const result = normalizeAllowedMarketCreatorGammaApiInput('https://gamma-api.polymarket.com', 'polymarket-prod')
      expect('error' in result).toBe(false)
      if ('error' in result) return
      expect(result.displayName).toBe('polymarket-prod')
    })

    it('rejects empty input', () => {
      expect(normalizeAllowedMarketCreatorGammaApiInput('')).toEqual({ error: 'Gamma API URL is required.' })
    })

    it('rejects private hosts', () => {
      expect(normalizeAllowedMarketCreatorGammaApiInput('http://localhost:3000')).toEqual({
        error: 'Gamma API URL must point to a public host.',
      })
      expect(normalizeAllowedMarketCreatorGammaApiInput('http://192.168.1.10')).toEqual({
        error: 'Gamma API URL must point to a public host.',
      })
    })
  })

  it('groups gamma_api rows into one removable source item', () => {
    const items = groupAllowedMarketCreatorItems([
      {
        walletAddress: 'gamma:https://gamma-api.polymarket.com',
        displayName: 'polymarket',
        sourceUrl: 'https://gamma-api.polymarket.com',
        sourceType: 'gamma_api',
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
        displayName: 'Wallet 1',
        sourceUrl: null,
        sourceType: 'wallet',
      },
    ])
    expect(items).toContainEqual({
      walletAddress: null,
      walletCount: 0,
      displayName: 'polymarket',
      sourceUrl: 'https://gamma-api.polymarket.com',
      sourceType: 'gamma_api',
    })
  })

  it('detects gamma_api source keys', () => {
    expect(isGammaApiSourceKey('gamma:https://gamma-api.polymarket.com')).toBe(true)
    expect(isGammaApiSourceKey('0x1111111111111111111111111111111111111111')).toBe(false)
  })
})
