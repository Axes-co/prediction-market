/**
 * HTML syntax highlighting for embed code preview.
 *
 * Shared between EventChartEmbedDialog and AffiliateWidgetDialog to
 * avoid duplicating the same tokenizer and renderer.
 */

// ---------------------------------------------------------------------------
// Token styles (Tailwind classes)
// ---------------------------------------------------------------------------

const STYLES = {
  tag: 'text-muted-foreground',
  attr: 'text-red-500',
  value: 'text-rose-500',
  punctuation: 'text-muted-foreground',
} as const

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

interface CodeToken {
  text: string
  className?: string
}

function tokenizeHtmlLine(line: string): CodeToken[] {
  const tokens: CodeToken[] = []
  let remaining = line

  while (remaining.length > 0) {
    // Tag open/close: <tag or </tag
    const tagMatch = remaining.match(/^(<\/?)([\w-]+)/)
    if (tagMatch) {
      tokens.push({ text: tagMatch[1], className: STYLES.tag })
      tokens.push({ text: tagMatch[2], className: STYLES.tag })
      remaining = remaining.slice(tagMatch[0].length)
      continue
    }

    // Attribute="value"
    const attrMatch = remaining.match(/^(\s+)([\w-]+)(=)(")((?:[^"\\]|\\.)*)(")/s)
    if (attrMatch) {
      tokens.push({ text: attrMatch[1] })
      tokens.push({ text: attrMatch[2], className: STYLES.attr })
      tokens.push({ text: attrMatch[3], className: STYLES.punctuation })
      tokens.push({ text: attrMatch[4], className: STYLES.punctuation })
      tokens.push({ text: attrMatch[5], className: STYLES.value })
      tokens.push({ text: attrMatch[6], className: STYLES.punctuation })
      remaining = remaining.slice(attrMatch[0].length)
      continue
    }

    // Self-close /> or close >
    const closeMatch = remaining.match(/^(\s*)(\/?>)/)
    if (closeMatch) {
      tokens.push({ text: closeMatch[1] })
      tokens.push({ text: closeMatch[2], className: STYLES.tag })
      remaining = remaining.slice(closeMatch[0].length)
      continue
    }

    // Plain text
    tokens.push({ text: remaining[0] })
    remaining = remaining.slice(1)
  }

  return tokens
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

interface EmbedCodeHighlightProps {
  code: string
}

export default function EmbedCodeHighlight({ code }: EmbedCodeHighlightProps) {
  const lines = code.split('\n')

  return (
    <pre className="min-w-max font-mono text-xs/5">
      {lines.map((line, lineIndex) => (
        <div key={lineIndex} className="whitespace-pre">
          {tokenizeHtmlLine(line).map((token, tokenIndex) => (
            <span key={tokenIndex} className={token.className}>
              {token.text}
            </span>
          ))}
        </div>
      ))}
    </pre>
  )
}
