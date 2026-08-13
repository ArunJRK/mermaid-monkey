/**
 * Estimate text width for layout purposes.
 * Uses average character widths per font style.
 * More accurate than the old `length * 8` estimate.
 */

const AVG_CHAR_WIDTH_PROPORTIONAL = 9.0  // Conservative: BitmapText renders wider than CSS
const AVG_CHAR_WIDTH_MONOSPACE = 9.5     // JetBrains Mono BitmapText
const WIDE_CHARS = /[WMQODHNG@]/g       // Characters wider than average
const NARROW_CHARS = /[iljt1!|:;,.]/g   // Characters narrower than average
const DEFAULT_MAX_WRAPPED_NODE_WIDTH = 320
const DEFAULT_NODE_LINE_HEIGHT = 18

export function measureTextWidth(
  text: string,
  fontSize: number = 14,
  monospace: boolean = false,
): number {
  const lines = text.split(/\r?\n/)
  if (lines.length > 1) {
    return Math.max(...lines.map((line) => measureTextWidth(line, fontSize, monospace)))
  }

  const baseWidth = monospace ? AVG_CHAR_WIDTH_MONOSPACE : AVG_CHAR_WIDTH_PROPORTIONAL
  const scale = fontSize / 14

  // Count wide and narrow characters for proportional fonts
  let width = text.length * baseWidth
  if (!monospace) {
    const wideCount = (text.match(WIDE_CHARS) || []).length
    const narrowCount = (text.match(NARROW_CHARS) || []).length
    width += wideCount * 2.5  // wide chars add ~2.5px each
    width -= narrowCount * 2  // narrow chars save ~2px each
  }

  return width * scale
}

/**
 * Compute node width from label text, respecting min width and padding.
 */
export function computeNodeWidth(
  label: string,
  minWidth: number,
  padding: number,
  monospace: boolean = false,
): number {
  const textWidth = measureTextWidth(label, 14, monospace)
  return Math.max(minWidth, Math.min(textWidth + padding * 2, 350)) // cap at 350px
}

export function wrapTextToWidth(
  text: string,
  maxLineWidth: number,
  fontSize: number = 14,
  monospace: boolean = false,
): string {
  const wrappedLines: string[] = []

  for (const sourceLine of text.split(/\r?\n/)) {
    if (sourceLine.trim() === '') {
      wrappedLines.push('')
      continue
    }

    const words = sourceLine.split(/\s+/)
    let current = ''

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word
      if (current && measureTextWidth(candidate, fontSize, monospace) > maxLineWidth) {
        wrappedLines.push(current)
        current = word
      } else {
        current = candidate
      }
    }

    if (current) wrappedLines.push(current)
  }

  return wrappedLines.join('\n')
}

export function computeNodeLabelLayout(
  label: string,
  minWidth: number,
  minHeight: number,
  padding: number,
  monospace: boolean = false,
  maxWrappedWidth: number = DEFAULT_MAX_WRAPPED_NODE_WIDTH,
): { label: string; width: number; height: number; lineCount: number } {
  const maxLineWidth = Math.max(minWidth - padding * 2, maxWrappedWidth - padding * 2)
  const wrappedLabel = wrapTextToWidth(label, maxLineWidth, 14, monospace)
  const lineCount = Math.max(1, wrappedLabel.split(/\r?\n/).length)
  const wrappedWidth = measureTextWidth(wrappedLabel, 14, monospace)
  const hasWrapped = wrappedLabel !== label
  const width = hasWrapped
    ? Math.max(minWidth, Math.min(wrappedWidth + padding * 2, maxWrappedWidth))
    : computeNodeWidth(label, minWidth, padding, monospace)
  const height = Math.max(
    minHeight,
    Math.ceil(lineCount * DEFAULT_NODE_LINE_HEIGHT + padding * 1.5),
  )

  return {
    label: wrappedLabel,
    width,
    height,
    lineCount,
  }
}
