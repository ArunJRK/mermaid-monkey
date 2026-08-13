export type RichLabelRange = {
  start: number
  end: number
  bold: boolean
}

export type RichLabel = {
  text: string
  ranges: RichLabelRange[]
}

export type RichLabelSpan = {
  text: string
  bold: boolean
}

export type RichLabelLine = RichLabelSpan[]

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
}

export function parseMermaidLabel(value: unknown, fallback: string): { text: string; richLabel?: RichLabel } {
  const decoded = decodeHtmlEntities(String(value ?? fallback))
    .replace(/<\s*(script|style)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')

  let text = ''
  const ranges: RichLabelRange[] = []
  let cursor = 0
  let boldDepth = 0
  const tagPattern = /<[^>]*>/g
  let match: RegExpExecArray | null

  const append = (chunk: string) => {
    if (!chunk) return
    const start = text.length
    text += chunk
    const end = text.length
    if (boldDepth > 0) ranges.push({ start, end, bold: true })
  }

  while ((match = tagPattern.exec(decoded)) !== null) {
    append(decoded.slice(cursor, match.index))
    cursor = match.index + match[0].length

    const rawTag = match[0].slice(1, -1).trim().toLowerCase()
    const isClosing = rawTag.startsWith('/')
    const tagName = rawTag
      .replace(/^\//, '')
      .split(/\s+/)[0]
      ?.replace(/\/$/, '')

    if (tagName === 'br') {
      append('\n')
    } else if (tagName === 'b' || tagName === 'strong') {
      if (isClosing) boldDepth = Math.max(0, boldDepth - 1)
      else boldDepth += 1
    }
  }

  append(decoded.slice(cursor))

  text = text.replace(/\r\n?/g, '\n')

  if (text.length === 0) {
    text = fallback
  }

  const normalizedRanges = mergeRanges(
    ranges
      .filter((range) => range.end > range.start)
      .map((range) => ({
        ...range,
        start: Math.min(range.start, text.length),
        end: Math.min(range.end, text.length),
      }))
      .filter((range) => range.end > range.start),
  )

  return {
    text,
    ...(normalizedRanges.length > 0 ? { richLabel: { text, ranges: normalizedRanges } } : {}),
  }
}

export function splitRenderedLabelIntoRichLines(renderedText: string, richLabel?: RichLabel): RichLabelLine[] {
  const lines: RichLabelLine[] = [[]]
  let sourceIndex = 0

  const append = (char: string, bold: boolean) => {
    const line = lines[lines.length - 1]
    const previous = line[line.length - 1]
    if (previous && previous.bold === bold) {
      previous.text += char
    } else {
      line.push({ text: char, bold })
    }
  }

  for (const char of renderedText) {
    if (char === '\n') {
      if (richLabel?.text[sourceIndex] === '\n') sourceIndex += 1
      lines.push([])
      continue
    }

    const bold = richLabel ? isBoldAt(richLabel, sourceIndex) : false
    append(char, bold)
    sourceIndex += 1
  }

  return lines.length > 0 ? lines : [[]]
}

function isBoldAt(richLabel: RichLabel, index: number): boolean {
  return richLabel.ranges.some((range) => range.bold && index >= range.start && index < range.end)
}

function mergeRanges(ranges: RichLabelRange[]): RichLabelRange[] {
  const merged: RichLabelRange[] = []
  for (const range of ranges.sort((a, b) => a.start - b.start || a.end - b.end)) {
    const previous = merged[merged.length - 1]
    if (previous && previous.bold === range.bold && previous.end >= range.start) {
      previous.end = Math.max(previous.end, range.end)
    } else {
      merged.push({ ...range })
    }
  }
  return merged
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    const key = entity.toLowerCase()
    if (key.startsWith('#x')) {
      const codePoint = Number.parseInt(key.slice(2), 16)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    if (key.startsWith('#')) {
      const codePoint = Number.parseInt(key.slice(1), 10)
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match
    }
    return NAMED_ENTITIES[key] ?? match
  })
}
