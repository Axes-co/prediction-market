import type { EmbedTheme } from '@/lib/embed-theme'
import { formatCentsLabel } from '@/lib/formatters'

interface OutcomeButton {
  label: string
  price: number
  color?: string | null
  marketUrl: string
  outcomeIndex: number
}

interface EmbedOutcomeButtonsProps {
  outcomes: OutcomeButton[]
  theme: EmbedTheme
  /** When true, renders stacked layout for banner mode */
  stacked?: boolean
  /** Whether to use team-style colored buttons (multi-outcome) */
  teamStyle?: boolean
}

/**
 * Tailwind class sets for binary outcome buttons.
 * Index 0 = YES/Up (green), Index 1 = NO/Down (red).
 * Matches Polymarket: bg-green-500/15 text-green-500 hover:bg-green-500/25
 */
const BINARY_BUTTON_CLASSES: Record<number, string> = {
  0: 'bg-green-500/15 text-green-500 hover:bg-green-500/25',
  1: 'bg-red-500/15 text-red-500 hover:bg-red-500/25',
}

function getFallbackButtonClasses(index: number): string {
  // Cycle through colors for 3+ outcomes
  const palette = [
    'bg-blue-500/15 text-blue-500 hover:bg-blue-500/25',
    'bg-amber-500/15 text-amber-500 hover:bg-amber-500/25',
    'bg-purple-500/15 text-purple-500 hover:bg-purple-500/25',
    'bg-pink-500/15 text-pink-500 hover:bg-pink-500/25',
  ]
  return palette[index % palette.length]
}

export default function EmbedOutcomeButtons({
  outcomes,
  theme,
  stacked = false,
  teamStyle = false,
}: EmbedOutcomeButtonsProps) {
  if (outcomes.length === 0) {
    return null
  }

  const containerClass = stacked
    ? 'flex flex-col gap-1 shrink-0 ml-2'
    : 'flex mt-auto gap-1.5'

  return (
    <div className={containerClass}>
      {outcomes.map((outcome) => {
        const centsLabel = formatCentsLabel(outcome.price)
        const href = `${outcome.marketUrl}&tid=${outcome.outcomeIndex}`

        // Multi-outcome: team-colored buttons with custom color
        if (teamStyle && outcome.color) {
          return (
            <a
              key={outcome.outcomeIndex}
              className="group flex-1 flex items-center justify-center rounded-lg text-white text-sm no-underline gap-1 transition-all hover:brightness-125"
              style={{
                backgroundColor: `color-mix(in srgb, ${outcome.color} 80%, transparent)`,
                height: stacked ? undefined : '40px',
                padding: stacked ? '4px 16px' : undefined,
              }}
              href={href}
              rel="noopener"
              target="_blank"
            >
              <span className="opacity-70 text-xs">{outcome.label}</span>
              <span className="font-bold text-[15px]"> {centsLabel}</span>
            </a>
          )
        }

        // Binary: Tailwind classes with hover (matches Polymarket exactly)
        const colorClasses = BINARY_BUTTON_CLASSES[outcome.outcomeIndex]
          ?? getFallbackButtonClasses(outcome.outcomeIndex)

        return (
          <a
            key={outcome.outcomeIndex}
            className={`flex-1 flex items-center justify-center rounded-lg transition-colors no-underline gap-1 h-7 text-xs ${colorClasses}`}
            style={stacked ? { height: 'auto', padding: '4px 16px' } : undefined}
            href={href}
            rel="noopener"
            target="_blank"
          >
            {outcome.label}
            <span className="font-bold">{centsLabel}</span>
          </a>
        )
      })}
    </div>
  )
}
