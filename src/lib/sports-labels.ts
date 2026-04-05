import type { Event } from '@/types'

function normalizeComparableText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() ?? ''
}

export function formatSportsDisplayLabel(value: string | null | undefined) {
  const normalized = value?.trim()
  if (!normalized) {
    return null
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((token) => {
      const lowerToken = token.toLowerCase()
      if (/^[a-z0-9]{1,3}$/i.test(lowerToken)) {
        return lowerToken.toUpperCase()
      }
      return lowerToken.charAt(0).toUpperCase() + lowerToken.slice(1)
    })
    .join(' ')
}

export function resolveSportsCompetitionLabel(event: Event) {
  const normalizedSportSlug = normalizeComparableText(event.sports_sport_slug)
  const preferredCompetitionTag = (event.sports_tags ?? []).find((tag) => {
    const normalizedTag = normalizeComparableText(tag)
    return normalizedTag
      && normalizedTag !== normalizedSportSlug
      && normalizedTag !== 'games'
      && normalizedTag !== 'game'
      && normalizedTag !== 'props'
      && normalizedTag !== 'prop'
  })

  return formatSportsDisplayLabel(preferredCompetitionTag)
    ?? formatSportsDisplayLabel(event.sports_sport_slug)
}
