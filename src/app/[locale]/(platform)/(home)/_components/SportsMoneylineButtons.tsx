'use client'

import type { CSSProperties } from 'react'
import type { HomeSportsMoneylineButton, HomeSportsMoneylineModel } from '@/lib/sports-home-card'
import type { Event } from '@/types'
import { useMemo } from 'react'
import AppLink from '@/components/AppLink'
import { ensureReadableTextColorOnDark } from '@/lib/color-contrast'
import { resolveEventOutcomePath } from '@/lib/events-routing'
import { resolveSportsTeamFallbackClassName } from '@/lib/sports-team-colors'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Button tone styling — shared logic for sports moneyline buttons
// ---------------------------------------------------------------------------

interface ButtonToneStyles {
  className: string
  style: CSSProperties | undefined
  backgroundClassName: string | undefined
  backgroundStyle: CSSProperties | undefined
}

export function getButtonToneStyles(
  button: HomeSportsMoneylineButton,
  heightClass: string,
): ButtonToneStyles {
  if (button.tone === 'draw') {
    return {
      className: `${heightClass} w-18 shrink-0 rounded-sm border border-border px-4 text-sm font-semibold text-muted-foreground`,
      style: undefined,
      backgroundClassName: undefined,
      backgroundStyle: undefined,
    }
  }

  if (!button.color) {
    return {
      className: `${heightClass} flex-1 rounded-sm px-2 text-sm font-semibold text-foreground`,
      style: undefined,
      backgroundClassName: resolveSportsTeamFallbackClassName(button.tone),
      backgroundStyle: undefined,
    }
  }

  const textColor = ensureReadableTextColorOnDark(button.color)

  return {
    className: `${heightClass} flex-1 rounded-sm px-2 text-sm font-semibold`,
    style: textColor ? { color: textColor } : undefined,
    backgroundClassName: undefined,
    backgroundStyle: { backgroundColor: button.color },
  }
}

// ---------------------------------------------------------------------------
// Shared sports moneyline button list
// ---------------------------------------------------------------------------

interface SportsMoneylineButtonsProps {
  event: Event
  model: HomeSportsMoneylineModel
  heightClass?: string
}

export default function SportsMoneylineButtons({
  event,
  model,
  heightClass = 'h-[40px]',
}: SportsMoneylineButtonsProps) {
  const marketSlugByConditionId = useMemo(
    () => new Map(event.markets.map(m => [m.condition_id, m.slug])),
    [event.markets],
  )

  function resolveButtonHref(button: HomeSportsMoneylineButton) {
    const marketSlug = marketSlugByConditionId.get(button.conditionId)
    return resolveEventOutcomePath(event, {
      marketSlug,
      conditionId: button.conditionId,
      outcomeIndex: button.outcomeIndex,
    })
  }

  return (
    <div className="flex h-fit items-center justify-center gap-2">
      {[model.team1Button, model.drawButton, model.team2Button]
        .filter((button): button is HomeSportsMoneylineButton => Boolean(button))
        .map((button) => {
          const toneStyles = getButtonToneStyles(button, heightClass)

          return (
            <AppLink
              key={`${button.conditionId}:${button.outcomeIndex}`}
              href={resolveButtonHref(button) as never}
              className={cn(
                `
                  relative inline-flex items-center justify-center overflow-hidden transition duration-150
                  active:scale-[97%]
                `,
                button.tone === 'draw'
                  ? 'hover:bg-secondary/80 hover:text-foreground'
                  : 'group/team-button hover:bg-transparent',
                toneStyles.className,
              )}
              style={toneStyles.style}
            >
              {button.tone === 'draw'
                ? <span className="relative z-1">{button.label}</span>
                : (
                    <span className="relative z-1 truncate">
                      <span className="group-hover/team-button:hidden">{button.label}</span>
                      <span className="hidden text-foreground group-hover/team-button:inline">{button.label}</span>
                    </span>
                  )}
              {(toneStyles.backgroundClassName || toneStyles.backgroundStyle) && (
                <span
                  className={cn(
                    `
                      absolute inset-0 z-0 rounded-sm opacity-20 transition-opacity
                      group-hover/team-button:opacity-40
                      dark:opacity-30
                      dark:group-hover/team-button:opacity-50
                    `,
                    toneStyles.backgroundClassName,
                  )}
                  style={toneStyles.backgroundStyle}
                />
              )}
            </AppLink>
          )
        })}
    </div>
  )
}
