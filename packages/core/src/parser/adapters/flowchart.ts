import type {
  RenderGraph,
  RenderNode,
  RenderEdge,
  RenderSubgraph,
  NodeShape,
  EdgeStyle,
  DiagramType,
  Directive,
  DirectiveMetadata,
  EntityDirective,
  EdgeDirective,
  RenderStyle,
} from '../../types'
import { parseMermaidLabel } from '../../label-markup'

/**
 * Map mermaid's internal vertex type to our NodeShape.
 */
function mapShape(mermaidType: string | undefined): NodeShape {
  switch (mermaidType) {
    case 'square':
    case 'rect':
      return 'rectangle'
    case 'round':
      return 'rounded'
    case 'circle':
    case 'doublecircle':
    case 'ellipse':
      return 'circle'
    case 'diamond':
      return 'diamond'
    case 'hexagon':
      return 'hexagon'
    case 'stadium':
      return 'stadium'
    case 'cylinder':
      return 'cylinder'
    case 'subroutine':
      return 'subroutine'
    case 'odd':
    case 'lean_right':
    case 'lean_left':
    case 'trapezoid':
    case 'inv_trapezoid':
      return 'asymmetric'
    default:
      return 'unknown'
  }
}

/**
 * Map mermaid's stroke to our EdgeStyle.
 */
function mapEdgeStyle(stroke: string | undefined): EdgeStyle {
  switch (stroke) {
    case 'dotted':
      return 'dotted'
    case 'thick':
      return 'thick'
    case 'normal':
    default:
      return 'solid'
  }
}

function parseHexColor(value: string): number | undefined {
  const trimmed = value.trim()
  const hexMatch = trimmed.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!hexMatch) return undefined

  const hex = hexMatch[1].length === 3
    ? hexMatch[1].split('').map((char) => `${char}${char}`).join('')
    : hexMatch[1]
  return Number.parseInt(hex, 16)
}

function parseStrokeDasharray(value: string): number[] | undefined {
  const parts = value
    .trim()
    .split(/[,\s]+/)
    .filter(Boolean)
    .map((part) => Number(part))
  return parts.length > 0 && parts.every((part) => Number.isFinite(part) && part > 0)
    ? parts
    : undefined
}

function parseStyleEntries(entries: unknown[]): RenderStyle | undefined {
  const style: RenderStyle = {}

  for (const entry of entries) {
    if (typeof entry !== 'string') continue
    const [rawKey, ...rawValueParts] = entry.replace(/;$/, '').split(':')
    if (!rawKey || rawValueParts.length === 0) continue
    const key = rawKey.trim()
    const value = rawValueParts.join(':').trim()

    switch (key) {
      case 'fill': {
        const color = parseHexColor(value)
        if (color !== undefined) style.fill = color
        break
      }
      case 'stroke': {
        const color = parseHexColor(value)
        if (color !== undefined) style.stroke = color
        break
      }
      case 'color': {
        const color = parseHexColor(value)
        if (color !== undefined) style.text = color
        break
      }
      case 'stroke-width': {
        const width = Number(value.replace(/px$/, ''))
        if (Number.isFinite(width) && width > 0) style.strokeWidth = width
        break
      }
      case 'stroke-dasharray': {
        const dasharray = parseStrokeDasharray(value)
        if (dasharray) style.strokeDasharray = dasharray
        break
      }
    }
  }

  return Object.keys(style).length > 0 ? style : undefined
}

function getClassStyleEntries(db: any, classNames: string[]): unknown[] {
  if (typeof db.getClasses !== 'function' || classNames.length === 0) return []
  const classDefs = db.getClasses()
  const entries: unknown[] = []

  for (const className of classNames) {
    const classDef = classDefs.get?.(className)
    if (!classDef) continue
    if (Array.isArray(classDef.styles)) entries.push(...classDef.styles)
  }

  return entries
}

function getClasses(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const classes = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
  return classes.length > 0 ? [...new Set(classes)] : undefined
}

function getMermaidStyle(db: any, classes: string[] | undefined, inlineStyles: unknown): RenderStyle | undefined {
  const entries = [
    ...getClassStyleEntries(db, classes ?? []),
    ...(Array.isArray(inlineStyles) ? inlineStyles : []),
  ]
  return parseStyleEntries(entries)
}

function mergeDirectiveMetadata(target: Record<string, unknown>, metadata: DirectiveMetadata): void {
  for (const [key, value] of Object.entries(metadata)) {
    target[key] = value
  }
}

function buildEntityMetadata(directives: EntityDirective[]): Record<string, unknown> {
  const metadata: Record<string, unknown> = {}
  for (const directive of directives) {
    metadata.entity = {
      type: directive.entityType,
      id: directive.entityId,
    }
    mergeDirectiveMetadata(metadata, directive.metadata)
  }
  return metadata
}

function buildEdgeMetadata(directives: EdgeDirective[]): Record<string, unknown> | undefined {
  if (directives.length === 0) return undefined
  const metadata: Record<string, unknown> = {}
  for (const directive of directives) {
    mergeDirectiveMetadata(metadata, directive.metadata)
  }
  return metadata
}

export interface FlowchartBuildInput {
  db: any
  direction: string
  diagramType: DiagramType
  directives: Directive[]
}

/**
 * Build a RenderGraph from a flowchart diagram's db.
 */
export function buildFlowchartGraph(input: FlowchartBuildInput): RenderGraph {
  const { db, direction, diagramType, directives } = input
  const entityDirectives = directives.filter((directive): directive is EntityDirective => directive.type === 'entity')
  const edgeDirectives = directives.filter((directive): directive is EdgeDirective => directive.type === 'edge')

  // Build nodes from vertices
  const nodes = new Map<string, RenderNode>()
  const vertices: Map<string, any> = db.getVertices()
  for (const [id, vertex] of vertices) {
    const classes = getClasses(vertex.classes)
    const style = getMermaidStyle(db, classes, vertex.styles)
    const nodeEntityDirectives = entityDirectives.filter((directive) => directive.nodeId === id)
    const label = parseMermaidLabel(vertex.text, id)
    nodes.set(id, {
      id,
      label: label.text,
      ...(label.richLabel ? { labelMarkup: label.richLabel } : {}),
      shape: mapShape(vertex.type),
      metadata: buildEntityMetadata(nodeEntityDirectives),
      ...(classes ? { classes } : {}),
      ...(style ? { style } : {}),
    })
  }

  // Build edges
  const mermaidEdges: any[] = db.getEdges()
  const edges: RenderEdge[] = mermaidEdges.map((e: any, i: number) => {
    const renderStyle = getMermaidStyle(db, undefined, e.style)
    const edge: RenderEdge = {
      id: `e${i}`,
      source: e.start,
      target: e.end,
      style: mapEdgeStyle(e.stroke),
      ...(renderStyle ? { renderStyle } : {}),
    }
    const matchingEdgeDirectives = edgeDirectives.filter(
      (directive) => directive.source === edge.source && directive.target === edge.target,
    )
    const metadata = buildEdgeMetadata(matchingEdgeDirectives)
    if (metadata) {
      edge.metadata = metadata
    }
    if (e.text && e.text.length > 0) {
      edge.label = parseMermaidLabel(e.text, '').text
    }
    return edge
  })

  // Build subgraphs
  const subgraphs = new Map<string, RenderSubgraph>()
  const mermaidSubgraphs: any[] = db.getSubGraphs()
  for (const sg of mermaidSubgraphs) {
    const classes = getClasses(sg.classes)
    const style = getMermaidStyle(db, classes, undefined)
    const label = parseMermaidLabel(sg.title, sg.id)
    subgraphs.set(sg.id, {
      id: sg.id,
      label: label.text,
      nodeIds: sg.nodes ?? [],
      collapsed: false,
      ...(typeof sg.dir === 'string' ? { direction: sg.dir } : {}),
      ...(classes ? { classes } : {}),
      ...(style ? { style } : {}),
    })
  }

  return {
    nodes,
    edges,
    subgraphs,
    directives,
    direction,
    diagramType,
  }
}
