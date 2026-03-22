import type { EmbedTheme } from '@/lib/embed-theme'
import { resolveEmbedPalette } from '@/lib/embed-theme'

interface EmbedHeaderProps {
  siteName: string
  logoSvg: string
  marketUrl: string
  theme: EmbedTheme
  /** When true, renders compact inline layout for banner mode */
  inline?: boolean
  /** Translated label for "View Market" link */
  viewMarketLabel?: string
}

function ChevronRight({ className, color }: { className?: string, color: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg">
      <path d="M4.5 3L7.5 6L4.5 9" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" />
    </svg>
  )
}

export default function EmbedHeader({
  siteName,
  logoSvg,
  marketUrl,
  theme,
  inline = false,
  viewMarketLabel = 'View Market',
}: EmbedHeaderProps) {
  const palette = resolveEmbedPalette(theme)

  if (inline) {
    return (
      <a
        className="group flex items-center gap-1 no-underline"
        style={{ color: palette.muted }}
        aria-label={siteName}
        href={marketUrl}
        rel="noopener"
        target="_blank"
      >
        <span
          className="h-2.5 w-auto shrink-0"
          dangerouslySetInnerHTML={{ __html: logoSvg }}
        />
        <span className="text-xs font-semibold">{siteName}</span>
        <ChevronRight className="w-2 h-2 transition-transform group-hover:translate-x-0.5" color={palette.muted} />
      </a>
    )
  }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <a
          className="group flex items-center gap-1.5 no-underline"
          style={{ color: palette.muted }}
          aria-label={siteName}
          href={marketUrl}
          rel="noopener"
          target="_blank"
        >
          <span
            className="h-4 w-auto shrink-0"
            dangerouslySetInnerHTML={{ __html: logoSvg }}
          />
          <span className="text-sm font-semibold">{siteName}</span>
        </a>
      </div>
      <a
        className="group flex items-center gap-1 text-xs font-medium no-underline"
        style={{ color: palette.muted }}
        href={marketUrl}
        rel="noopener"
        target="_blank"
      >
        <span>{viewMarketLabel}</span>
        <ChevronRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" color={palette.muted} />
      </a>
    </div>
  )
}
