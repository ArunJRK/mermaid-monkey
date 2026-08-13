import type {
  DirectiveMetadataValue,
  LensDirective,
  RenderGraph,
  RenderNode,
} from './types'

export interface LensEvaluation {
  name: string
  criteria: string[]
  nodeScores: Map<string, number>
  edgeScores: Map<string, number>
  matchedNodeIds: string[]
  matchedEdgeIds: string[]
}

export interface LensSummary {
  name: string
  criteria: string[]
  matchedNodeCount: number
  matchedEdgeCount: number
}

function criteriaFrom(value: DirectiveMetadataValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean)
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function collectValues(
  value: unknown,
  byKey: Map<string, Set<string>>,
  inheritedKey?: string,
): void {
  if (Array.isArray(value)) {
    for (const item of value) collectValues(item, byKey, inheritedKey)
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) collectValues(child, byKey, key)
    return
  }
  if (!inheritedKey || value === undefined || value === null) return
  const normalized = String(value).toLowerCase()
  const values = byKey.get(inheritedKey) ?? new Set<string>()
  values.add(normalized)
  byKey.set(inheritedKey, values)
}

function symbolValues(metadata: Record<string, unknown>, node?: RenderNode): Map<string, Set<string>> {
  const values = new Map<string, Set<string>>()
  collectValues(metadata, values)
  if (node?.classes) collectValues(node.classes, values, 'tags')
  return values
}

function matchesCriterion(values: Map<string, Set<string>>, criterion: string): boolean {
  const separator = criterion.indexOf(':')
  if (separator < 0) {
    const key = criterion.toLowerCase()
    return values.get(key)?.has('true') === true || values.get('tags')?.has(key) === true
  }
  const rawKey = criterion.slice(0, separator).trim().toLowerCase()
  const expected = criterion.slice(separator + 1).trim().toLowerCase()
  const key = rawKey === 'tag' ? 'tags' : rawKey
  return values.get(key)?.has(expected) === true
}

function scoreSymbol(
  metadata: Record<string, unknown>,
  criteria: string[],
  node?: RenderNode,
): number {
  if (criteria.length === 0) return 0
  const values = symbolValues(metadata, node)
  const matches = criteria.filter((criterion) => matchesCriterion(values, criterion)).length
  return matches / criteria.length
}

function evaluateLens(graph: RenderGraph, lens: LensDirective): LensEvaluation {
  const criteria = criteriaFrom(lens.metadata.include)
  const nodeScores = new Map<string, number>()
  const edgeScores = new Map<string, number>()

  for (const [id, node] of graph.nodes) {
    nodeScores.set(id, scoreSymbol(node.metadata, criteria, node))
  }
  for (const edge of graph.edges) {
    const score = scoreSymbol(edge.metadata ?? {}, criteria)
    edgeScores.set(edge.id, score)
    if (score <= 0) continue
    nodeScores.set(edge.source, Math.max(nodeScores.get(edge.source) ?? 0, score * 0.85))
    nodeScores.set(edge.target, Math.max(nodeScores.get(edge.target) ?? 0, score * 0.85))
  }

  return {
    name: lens.name,
    criteria,
    nodeScores,
    edgeScores,
    matchedNodeIds: [...nodeScores].flatMap(([id, score]) => (score > 0 ? [id] : [])),
    matchedEdgeIds: [...edgeScores].flatMap(([id, score]) => (score > 0 ? [id] : [])),
  }
}

export function evaluateGraphLenses(graph: RenderGraph): LensEvaluation[] {
  return graph.directives
    .filter((directive): directive is LensDirective => directive.type === 'lens')
    .map((lens) => evaluateLens(graph, lens))
}
