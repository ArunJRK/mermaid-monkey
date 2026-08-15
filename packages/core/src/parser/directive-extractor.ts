import type {
  Directive,
  DirectiveMetadata,
  EntityDirective,
  EdgeDirective,
  FileDirective,
  LensDirective,
  LinkDirective,
  LayoutDirective,
  PinDirective,
  RankDirective,
  SpacingDirective,
  LayoutPhilosophy,
  RenderWarning,
} from '../types'

export interface ExtractionResult {
  directives: Directive[]
  cleanedSource: string
  warnings: RenderWarning[]
}

// %% @link <nodeId> -> <path>#<fragment>
const LINK_RE = /^%%\s+@link\s+(\S+)\s+->\s+(\S+)$/

// %% @entity <nodeId> <kind>:<canonicalId> [key=value ...]
const ENTITY_RE = /^%%\s+@entity\s+(\S+)\s+(\S+)(?:\s+(.+))?$/

// %% @edge <sourceId> -> <targetId> [key=value ...]
const EDGE_RE = /^%%\s+@edge\s+(\S+)\s+->\s+(\S+)(?:\s+(.+))?$/

// %% @file [key=value ...]
const FILE_RE = /^%%\s+@file(?:\s+(.+))?$/

// %% @lens <name> [key=value ...]
const LENS_RE = /^%%\s+@lens\s+(\S+)(?:\s+(.+))?$/

// %% @layout <philosophy>
const LAYOUT_RE = /^%%\s+@layout\s+(\S+)$/

// %% @pin <nodeId> <x> <y>
const PIN_RE = /^%%\s+@pin\s+(\S+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/

// %% @rank <nodeId1> <nodeId2> ...
const RANK_RE = /^%%\s+@rank\s+(.+)$/

// %% @spacing <value>  (or %% @spacing nodeSpacing=<v> rankSpacing=<v>)
const SPACING_RE = /^%%\s+@spacing\s+(.+)$/

function parseLinkTarget(raw: string): { targetFile: string; targetNode?: string } {
  const hashIdx = raw.indexOf('#')
  if (hashIdx === -1) {
    return { targetFile: raw }
  }
  return {
    targetFile: raw.slice(0, hashIdx),
    targetNode: raw.slice(hashIdx + 1),
  }
}

function splitDirectiveArgs(raw = ''): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]
    if (char === '"') {
      inQuote = !inQuote
      continue
    }
    if (/\s/.test(char) && !inQuote) {
      if (current) {
        tokens.push(current)
        current = ''
      }
      continue
    }
    current += char
  }

  if (current) tokens.push(current)
  return tokens
}

function parseMetadata(raw?: string): DirectiveMetadata {
  const metadata: DirectiveMetadata = {}
  for (const token of splitDirectiveArgs(raw)) {
    const equalsIdx = token.indexOf('=')
    if (equalsIdx === -1) {
      metadata[token] = true
      continue
    }

    const key = token.slice(0, equalsIdx).trim()
    const value = token.slice(equalsIdx + 1).trim()
    if (!key) continue
    metadata[key] = value.includes(',') || key === 'tags' || key === 'include'
      ? value.split(',').map((part) => part.trim()).filter(Boolean)
      : value
  }
  return metadata
}

function parseEntityRef(raw: string): { entityType: string; entityId: string } | null {
  const colonIdx = raw.indexOf(':')
  if (colonIdx <= 0 || colonIdx === raw.length - 1) return null
  return {
    entityType: raw.slice(0, colonIdx),
    entityId: raw.slice(colonIdx + 1),
  }
}

export function extractDirectives(source: string): ExtractionResult {
  const lines = source.split('\n')
  const directives: Directive[] = []
  const cleanedLines: string[] = []
  const warnings: RenderWarning[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // Try @link
    const linkMatch = trimmed.match(LINK_RE)
    if (linkMatch) {
      const { targetFile, targetNode } = parseLinkTarget(linkMatch[2])
      const d: LinkDirective = {
        type: 'link',
        nodeId: linkMatch[1],
        targetFile,
        ...(targetNode !== undefined ? { targetNode } : {}),
      }
      directives.push(d)
      continue
    }
    if (trimmed.startsWith('%% @link')) {
      warnings.push({
        code: 'LINK_DIRECTIVE_INVALID',
        message: `Malformed @link directive ignored: "${trimmed}"`,
      })
      continue
    }

    // Try @entity
    const entityMatch = trimmed.match(ENTITY_RE)
    if (entityMatch) {
      const entityRef = parseEntityRef(entityMatch[2])
      if (!entityRef) {
        warnings.push({
          code: 'ENTITY_DIRECTIVE_INVALID',
          message: `Malformed @entity directive ignored: "${trimmed}"`,
        })
        continue
      }
      const d: EntityDirective = {
        type: 'entity',
        nodeId: entityMatch[1],
        entityType: entityRef.entityType,
        entityId: entityRef.entityId,
        metadata: parseMetadata(entityMatch[3]),
      }
      directives.push(d)
      continue
    }
    if (trimmed.startsWith('%% @entity')) {
      warnings.push({
        code: 'ENTITY_DIRECTIVE_INVALID',
        message: `Malformed @entity directive ignored: "${trimmed}"`,
      })
      continue
    }

    // Try @edge
    const edgeMatch = trimmed.match(EDGE_RE)
    if (edgeMatch) {
      const d: EdgeDirective = {
        type: 'edge',
        source: edgeMatch[1],
        target: edgeMatch[2],
        metadata: parseMetadata(edgeMatch[3]),
      }
      directives.push(d)
      continue
    }
    if (trimmed.startsWith('%% @edge')) {
      warnings.push({
        code: 'EDGE_DIRECTIVE_INVALID',
        message: `Malformed @edge directive ignored: "${trimmed}"`,
      })
      continue
    }

    // Try @file
    const fileMatch = trimmed.match(FILE_RE)
    if (fileMatch) {
      const d: FileDirective = {
        type: 'file',
        metadata: parseMetadata(fileMatch[1]),
      }
      directives.push(d)
      continue
    }

    // Try @lens
    const lensMatch = trimmed.match(LENS_RE)
    if (lensMatch) {
      const d: LensDirective = {
        type: 'lens',
        name: lensMatch[1],
        metadata: parseMetadata(lensMatch[2]),
      }
      directives.push(d)
      continue
    }
    if (trimmed.startsWith('%% @lens')) {
      warnings.push({
        code: 'LENS_DIRECTIVE_INVALID',
        message: `Malformed @lens directive ignored: "${trimmed}"`,
      })
      continue
    }

    // Try @layout
    const layoutMatch = trimmed.match(LAYOUT_RE)
    if (layoutMatch) {
      const d: LayoutDirective = {
        type: 'layout',
        philosophy: layoutMatch[1] as LayoutPhilosophy,
      }
      directives.push(d)
      continue
    }

    // Try @pin
    const pinMatch = trimmed.match(PIN_RE)
    if (pinMatch) {
      const d: PinDirective = {
        type: 'pin',
        nodeId: pinMatch[1],
        x: parseFloat(pinMatch[2]),
        y: parseFloat(pinMatch[3]),
      }
      directives.push(d)
      continue
    }

    // Try @rank
    const rankMatch = trimmed.match(RANK_RE)
    if (rankMatch) {
      const nodeIds = rankMatch[1].trim().split(/\s+/)
      const d: RankDirective = {
        type: 'rank',
        nodeIds,
        rank: 'same', // default rank when not specified
      }
      directives.push(d)
      continue
    }

    // Try @spacing
    const spacingMatch = trimmed.match(SPACING_RE)
    if (spacingMatch) {
      const val = parseFloat(spacingMatch[1])
      const d: SpacingDirective = {
        type: 'spacing',
        nodeSpacing: val,
      }
      directives.push(d)
      continue
    }

    // Not a directive — keep in cleaned output
    cleanedLines.push(line)
  }

  return {
    directives,
    cleanedSource: cleanedLines.join('\n'),
    warnings,
  }
}
