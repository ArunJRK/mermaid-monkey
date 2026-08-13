import type {
  Directive,
  DiagramType,
  RenderEdge,
  RenderGraph,
  RenderNode,
  RenderSubgraph,
} from '../../types'
import {
  asArray,
  asRecord,
  asString,
  callDb,
  makeEdge,
  makeNode,
  stablePart,
  type MermaidDb,
} from './adapter-utils'

interface MindmapBuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

export function buildMindmapGraph(input: MindmapBuildInput): RenderGraph {
  const nodes = new Map<string, RenderNode>()
  const edges: RenderEdge[] = []

  function visit(value: unknown, parentId: string | undefined, depth: number) {
    const item = asRecord(value)
    const fallbackId = `mindmap:${depth}:${nodes.size}`
    let id = asString(item.nodeId, fallbackId)
    if (nodes.has(id)) id = `${id}:${nodes.size}`
    const nodeType = Number(item.type)
    nodes.set(
      id,
      makeNode(
        id,
        asString(item.descr, id),
        'mindmap',
        { kind: 'topic', depth, parentId, nodeType },
        nodeType === 3 ? 'circle' : 'rounded',
      ),
    )
    if (parentId) {
      edges.push(
        makeEdge({
          id: `mindmap:${stablePart(parentId, 'parent')}:${stablePart(id, 'child')}`,
          source: parentId,
          target: id,
          family: 'mindmap',
          metadata: { kind: 'branch', depth },
        }),
      )
    }
    for (const child of asArray(item.children)) visit(child, id, depth + 1)
  }

  const root = callDb(input.db, 'getMindmap')
  if (root) visit(root, undefined, 0)
  return {
    nodes,
    edges,
    subgraphs: new Map<string, RenderSubgraph>(),
    directives: input.directives,
    direction: 'LR',
    diagramType: input.diagramType,
  }
}
