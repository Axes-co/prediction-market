import Image from 'next/image'
import { cn } from '@/lib/utils'

interface SiteLogoIconProps {
  logoSvg: string
  logoImageUrl?: string | null
  className?: string
  svgClassName?: string
  imageClassName?: string
  alt?: string
  size?: number
}

const HARDCODED_FILL_PATTERN = /\bfill\s*=\s*"(?!none|transparent|currentColor)#?[^"]+"/gi
const HARDCODED_STROKE_PATTERN = /\bstroke\s*=\s*"(?!none|transparent|currentColor)#?[^"]+"/gi

function makeThemeAware(svg: string) {
  return svg
    .replace(HARDCODED_FILL_PATTERN, 'fill="currentColor"')
    .replace(HARDCODED_STROKE_PATTERN, 'stroke="currentColor"')
}

export default function SiteLogoIcon({
  logoSvg,
  logoImageUrl,
  className,
  svgClassName,
  imageClassName,
  alt = '',
  size = 24,
}: SiteLogoIconProps) {
  if (logoImageUrl) {
    return (
      <span className={className}>
        <Image
          src={logoImageUrl}
          alt={alt}
          width={size}
          height={size}
          className={cn('size-full object-contain', imageClassName)}
          unoptimized
        />
      </span>
    )
  }

  return (
    <span
      className={cn(className, svgClassName)}
      dangerouslySetInnerHTML={{ __html: makeThemeAware(logoSvg) }}
    />
  )
}
