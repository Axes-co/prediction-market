import { describe, expect, it, vi } from 'vitest'

const upsertChain = {
  values: vi.fn().mockReturnThis(),
  onConflictDoUpdate: vi.fn().mockResolvedValue([]),
}

const selectChain = {
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockResolvedValue([]),
}

vi.mock('@/lib/drizzle', () => ({
  db: {
    insert: vi.fn(() => upsertChain),
    select: vi.fn(() => selectChain),
  },
}))

const {
  upsertFromCommentProfile,
  upsertFromActivityRow,
  upsertFromHolderRow,
  getByAddress,
} = await import('@/lib/db/queries/polymarket-users')

function getValuesArg() {
  return upsertChain.values.mock.calls.at(-1)?.[0]
}

describe('polymarket-users', () => {
  it('skips comment upsert when no usable base address is present', async () => {
    upsertChain.values.mockClear()
    await upsertFromCommentProfile(null, null)
    await upsertFromCommentProfile('not-an-address', { baseAddress: '' })
    expect(upsertChain.values).not.toHaveBeenCalled()
  })

  it('normalizes addresses to lowercase and clamps long strings', async () => {
    upsertChain.values.mockClear()
    await upsertFromCommentProfile('0xAAaaAaAA000000000000000000000000bbbbBBBB', {
      baseAddress: '0xAAaaAaAA000000000000000000000000bbbbBBBB',
      proxyWallet: '0xCCCCCCCC11111111111111111111111111111111',
      pseudonym: 'Quarterly-Bond',
      name: '   thiagofelipe   ',
      displayUsernamePublic: true,
      bio: 'x'.repeat(2000),
    })
    const v = getValuesArg()
    expect(v?.base_address).toBe('0xaaaaaaaa000000000000000000000000bbbbbbbb')
    expect(v?.proxy_wallet).toBe('0xcccccccc11111111111111111111111111111111')
    expect(v?.pseudonym).toBe('Quarterly-Bond')
    expect(v?.name).toBe('thiagofelipe')
    expect(v?.display_username_public).toBe(true)
    expect(v?.bio).toHaveLength(1000)
    expect(v?.source).toBe('comments')
  })

  it('uses commentUserAddress when profile.baseAddress is empty', async () => {
    upsertChain.values.mockClear()
    await upsertFromCommentProfile('0xdddddddd00000000000000000000000000000000', {
      baseAddress: '',
      proxyWallet: null,
      pseudonym: null,
      name: null,
    })
    const v = getValuesArg()
    expect(v?.base_address).toBe('0xdddddddd00000000000000000000000000000000')
    expect(v?.proxy_wallet).toBeNull()
    expect(v?.pseudonym).toBeNull()
  })

  it('upserts from activity using proxy wallet as the base', async () => {
    upsertChain.values.mockClear()
    await upsertFromActivityRow('0xeeeeeeee00000000000000000000000000000000', {
      proxyWallet: '0xeeeeeeee00000000000000000000000000000000',
      pseudonym: 'Tradr',
    })
    const v = getValuesArg()
    expect(v?.base_address).toBe('0xeeeeeeee00000000000000000000000000000000')
    expect(v?.proxy_wallet).toBe('0xeeeeeeee00000000000000000000000000000000')
    expect(v?.source).toBe('activity')
  })

  it('upserts from holders rows', async () => {
    upsertChain.values.mockClear()
    await upsertFromHolderRow('0xffffffff00000000000000000000000000000000', {
      proxyWallet: '0xffffffff00000000000000000000000000000000',
      profileImage: 'https://example.test/avatar.png',
      profileImageOptimized: 'https://example.test/avatar.webp',
    })
    const v = getValuesArg()
    expect(v?.profile_image).toBe('https://example.test/avatar.png')
    expect(v?.profile_image_optimized).toBe('https://example.test/avatar.webp')
    expect(v?.source).toBe('holders')
  })

  it('rejects non-hex addresses in getByAddress', async () => {
    selectChain.limit.mockResolvedValueOnce([])
    expect(await getByAddress('not-an-address')).toBeNull()
    expect(await getByAddress('')).toBeNull()
    expect(await getByAddress(null)).toBeNull()
  })
})
