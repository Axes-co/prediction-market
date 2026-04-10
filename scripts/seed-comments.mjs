#!/usr/bin/env node

/**
 * Seed test comments on hero events for the comment marquee.
 *
 * Usage:
 *   node scripts/seed-comments.mjs
 *
 * Requirements:
 *   - COMMUNITY_URL env var (defaults to https://community.kuest.com)
 *   - A throwaway private key is generated automatically (no real wallet needed)
 *
 * The script:
 *   1. Creates a random wallet
 *   2. Authenticates via the community API (nonce + signature)
 *   3. Queries the DB for the current top 6 trending events (hero events)
 *   4. Posts 4-6 comments on each hero event
 */

import { randomBytes } from 'node:crypto'
import postgres from 'postgres'
import { privateKeyToAccount } from 'viem/accounts'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const COMMUNITY_URL = process.env.COMMUNITY_URL || 'https://community.axes.co'
const DATABASE_URL = process.env.POSTGRES_URL

if (!DATABASE_URL) {
  console.error('Missing POSTGRES_URL env var. Set it or run with dotenv.')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Sample comments — varied, realistic-sounding, short
// ---------------------------------------------------------------------------

const COMMENT_POOL = [
  'This market is underpriced right now imo',
  'Been watching this one closely for weeks',
  'The odds are shifting fast on this',
  'I think the market is sleeping on this outcome',
  'Loaded up on YES, feeling good about it',
  'NO seems like the obvious play here',
  'This is going to be wild when it resolves',
  'Anyone else think this is a lock?',
  'The resolution criteria is interesting on this one',
  'Just got in at a great price',
  'Surprised this isn\'t getting more attention',
  'What a move in the last hour',
  'This is the most interesting market on the platform right now',
  'Going contrarian on this one, NO all the way',
  'The smart money is on YES here',
  'This could go either way honestly',
  'Reminds me of a similar market that resolved YES last month',
  'I\'m hedging with a small NO position',
  'Great entry point right now',
  'The news cycle is about to make this pop',
  'I think most people are over-estimating the probability',
  'Under-the-radar pick, this is going to print',
  'The current odds are basically free money',
  'Watching from the sidelines for now, interesting market though',
  'This is my highest conviction trade this week',
  'Love the liquidity on this one',
  'The volatility here is insane',
  'Just flipped from NO to YES after today\'s news',
  'Following the whale wallets on this one',
  'Early movers are going to get rewarded here',
]

// ---------------------------------------------------------------------------
// Display names for seeded comment authors
// ---------------------------------------------------------------------------

const AUTHOR_NAMES = [
  'TraderJoe',
  'MarketWatcher',
  'CryptoKing',
  'PredictorPro',
  'BullishBob',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom(arr, count) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

function randomDelay(min = 200, max = 600) {
  return new Promise(resolve =>
    setTimeout(resolve, min + Math.random() * (max - min)),
  )
}

// ---------------------------------------------------------------------------
// Auth — mirrors the client-side ensureCommunityToken flow
// ---------------------------------------------------------------------------

async function authenticate(account) {
  // Step 1: Request nonce
  const nonceRes = await fetch(`${COMMUNITY_URL}/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address: account.address }),
  })

  if (!nonceRes.ok) {
    throw new Error(`Nonce request failed: ${nonceRes.status} ${await nonceRes.text()}`)
  }

  const { message } = await nonceRes.json()

  // Step 2: Sign the message
  const signature = await account.signMessage({ message })

  // Step 3: Verify signature and get token
  // Pass proxy_wallet_address so the community API creates a profile for this wallet
  const verifyRes = await fetch(`${COMMUNITY_URL}/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: account.address,
      signature,
      proxy_wallet_address: account.address,
    }),
  })

  if (!verifyRes.ok) {
    throw new Error(`Verify request failed: ${verifyRes.status} ${await verifyRes.text()}`)
  }

  const { token } = await verifyRes.json()
  return token
}

// ---------------------------------------------------------------------------
// Set profile username via the community API
// ---------------------------------------------------------------------------

async function setProfileUsername(token, username) {
  const form = new FormData()
  form.append('username', username)

  const res = await fetch(`${COMMUNITY_URL}/profile`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to set username "${username}": ${res.status} ${body}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Post a single comment
// ---------------------------------------------------------------------------

async function postComment(token, eventSlug, content) {
  const res = await fetch(`${COMMUNITY_URL}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      event_slug: eventSlug,
      content,
      parent_comment_id: null,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Failed to post comment on ${eventSlug}: ${res.status} ${body}`)
  }

  return res.json()
}

// ---------------------------------------------------------------------------
// Fetch hero event slugs from the database
// ---------------------------------------------------------------------------

async function fetchHeroEventSlugs(sql) {
  const rows = await sql`
    SELECT e.slug, e.title
    FROM events e
    WHERE e.status = 'active' AND e.is_hidden = false
    ORDER BY
      COALESCE(
        NULLIF((SELECT SUM(m.volume_24h) FROM markets m WHERE m.event_id = e.id), 0),
        (SELECT SUM(m.volume) FROM markets m WHERE m.event_id = e.id)
      ) DESC NULLS LAST,
      e.created_at DESC
    LIMIT 6
  `
  return rows.map(r => ({ slug: r.slug, title: r.title }))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Seed Hero Event Comments ===\n')

  // Connect to database
  const sql = postgres(DATABASE_URL)

  try {
    // Get hero events
    console.log('Fetching hero events from database...')
    const heroEvents = await fetchHeroEventSlugs(sql)

    if (heroEvents.length === 0) {
      console.error('No hero events found. Is the database seeded with events?')
      process.exit(1)
    }

    console.log(`Found ${heroEvents.length} hero events:`)
    heroEvents.forEach((e, i) => console.log(`  ${i + 1}. ${e.title} (${e.slug})`))
    console.log()

    // Create multiple wallets for variety in usernames/avatars
    const walletCount = 5
    console.log(`Creating ${walletCount} random wallets for comment authors...`)

    const accounts = []
    const tokens = []

    for (let i = 0; i < walletCount; i++) {
      const privateKey = `0x${randomBytes(32).toString('hex')}`
      const account = privateKeyToAccount(privateKey)
      accounts.push(account)
      console.log(`  Wallet ${i + 1}: ${account.address}`)

      const token = await authenticate(account)
      tokens.push(token)
      console.log(`  Authenticated wallet ${i + 1}`)

      const displayName = AUTHOR_NAMES[i]
      await setProfileUsername(token, displayName)
      console.log(`  Set username to "${displayName}"`)
      await randomDelay(100, 300)
    }

    console.log()

    // Post comments
    let totalPosted = 0

    for (const event of heroEvents) {
      const commentCount = 4 + Math.floor(Math.random() * 3) // 4-6 comments per event
      const selectedComments = pickRandom(COMMENT_POOL, commentCount)

      console.log(`Posting ${commentCount} comments on "${event.title}"...`)

      for (let i = 0; i < selectedComments.length; i++) {
        const walletIndex = i % walletCount
        const token = tokens[walletIndex]
        const content = selectedComments[i]

        try {
          await postComment(token, event.slug, content)
          totalPosted++
          process.stdout.write(`  [${i + 1}/${commentCount}] ✓ "${content.slice(0, 50)}..."\n`)
        }
        catch (err) {
          console.error(`  [${i + 1}/${commentCount}] ✗ ${err.message}`)
        }

        await randomDelay()
      }
    }

    console.log(`\nDone! Posted ${totalPosted} comments across ${heroEvents.length} hero events.`)
  }
  finally {
    await sql.end()
  }
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
