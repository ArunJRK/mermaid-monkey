import type {
  DiagramType,
  Directive,
  EdgeStyle,
  RenderEdge,
  RenderGraph,
  RenderNode,
  RenderSubgraph,
} from '../../types'
import { parseMermaidLabel } from '../../label-markup'

type MermaidState = {
  stmt?: 'state'
  id?: string
  type?: string
  description?: string
  start?: boolean
  doc?: MermaidStateStatement[]
}

type MermaidStateRelation = {
  stmt?: 'relation'
  state1?: MermaidState
  state2?: MermaidState
  description?: string
}

type MermaidStateDirection = {
  stmt?: 'dir'
  value?: string
}

type MermaidStateStatement = MermaidState | MermaidStateRelation | MermaidStateDirection

type MermaidStateRoot = {
  id?: string
  doc?: MermaidStateStatement[]
}

export interface StateBuildInput {
  db: any
  direction: string
  diagramType: DiagramType
  directives: Directive[]
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function cleanStateText(value: unknown, fallback = ''): string {
  return parseMermaidLabel(value, fallback).text.trim()
}

function stableIdPart(value: string | undefined, fallback: string): string {
  const base = value?.trim() || fallback
  return base.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_.-]/g, '_')
}

function getStateRoot(db: any): MermaidStateRoot {
  if (typeof db.getRootDocV2 === 'function') {
    const root = db.getRootDocV2()
    if (root && typeof root === 'object') return root as MermaidStateRoot
  }
  if (typeof db.getRootDoc === 'function') {
    const doc = db.getRootDoc()
    if (Array.isArray(doc)) return { id: 'root', doc }
  }
  return { id: 'root', doc: [] }
}

function getStateDirection(db: any, root: MermaidStateRoot, fallback: string): string {
  const docDirection = root.doc?.find((statement): statement is MermaidStateDirection => {
    return statement.stmt === 'dir' && asString(statement.value) !== undefined
  })?.value
  if (asString(docDirection)) return docDirection!
  return typeof db.getDirection === 'function'
    ? asString(db.getDirection()) ?? fallback
    : fallback
}

function stateId(state: MermaidState | undefined): string | null {
  return asString(state?.id) ?? null
}

function stateLabel(id: string, state: MermaidState): string {
  if (state.start === true) return 'Start'
  if (state.start === false) return 'End'
  return cleanStateText(state.description, id) || id
}

function stateKind(state: MermaidState, composite: boolean): string {
  if (state.start === true) return 'start'
  if (state.start === false) return 'end'
  if (composite) return 'composite'
  return asString(state.type) ?? 'state'
}

function upsertStateNode(nodes: Map<string, RenderNode>, state: MermaidState, composite = false): void {
  const id = stateId(state)
  if (!id) return

  const existing = nodes.get(id)
  const kind = stateKind(state, composite)
  const label = stateLabel(id, state)
  const shape = kind === 'start' || kind === 'end'
    ? 'circle'
    : kind === 'choice'
      ? 'diamond'
      : 'rounded'

  nodes.set(id, {
    id,
    label: existing?.label && existing.label !== id ? existing.label : label,
    shape,
    metadata: {
      ...(existing?.metadata ?? {}),
      diagramFamily: 'state',
      state: {
        ...((existing?.metadata?.state as Record<string, unknown> | undefined) ?? {}),
        kind,
        type: asString(state.type) ?? 'default',
      },
    },
  })
}

function buildStateEdge(relation: MermaidStateRelation, index: number): RenderEdge | null {
  const source = stateId(relation.state1)
  const target = stateId(relation.state2)
  if (!source || !target) return null

  const label = cleanStateText(relation.description, '')
  const id = `state:${stableIdPart(source, `source${index}`)}:${stableIdPart(target, `target${index}`)}:${stableIdPart(label, 'transition')}`

  return {
    id,
    source,
    target,
    style: 'solid' satisfies EdgeStyle,
    ...(label ? { label } : {}),
    metadata: {
      diagramFamily: 'state',
      state: {
        kind: 'transition',
        ...(label ? { label } : {}),
      },
    },
  }
}

function collectStateGraph(
  statements: MermaidStateStatement[],
  graph: {
    nodes: Map<string, RenderNode>
    edges: RenderEdge[]
    subgraphs: Map<string, RenderSubgraph>
  },
  options: {
    direction: string
    parentStateId?: string
    edgeIndex: { value: number }
  },
): string[] {
  const localNodeIds: string[] = []
  const addLocalNode = (id: string | null) => {
    if (id && !localNodeIds.includes(id)) localNodeIds.push(id)
  }

  for (const statement of statements) {
    if (statement.stmt === 'dir') continue

    if (statement.stmt === 'relation') {
      upsertStateNode(graph.nodes, statement.state1 ?? {})
      upsertStateNode(graph.nodes, statement.state2 ?? {})
      addLocalNode(stateId(statement.state1))
      addLocalNode(stateId(statement.state2))

      const edge = buildStateEdge(statement, options.edgeIndex.value)
      options.edgeIndex.value += 1
      if (edge) graph.edges.push(edge)
      continue
    }

    if (statement.stmt === 'state') {
      const id = stateId(statement)
      const hasChildren = Array.isArray(statement.doc) && statement.doc.length > 0
      upsertStateNode(graph.nodes, statement, hasChildren)
      addLocalNode(id)

      if (id && hasChildren) {
        const childNodeIds = collectStateGraph(statement.doc!, graph, {
          direction: options.direction,
          parentStateId: id,
          edgeIndex: options.edgeIndex,
        })
        graph.subgraphs.set(`state:${id}`, {
          id: `state:${id}`,
          label: stateLabel(id, statement),
          nodeIds: childNodeIds,
          collapsed: false,
          direction: options.direction,
        })
      }
    }
  }

  if (options.parentStateId) {
    return localNodeIds.filter((id) => id !== options.parentStateId)
  }
  return localNodeIds
}

export function buildStateGraph(input: StateBuildInput): RenderGraph {
  const { db, direction, diagramType, directives } = input
  const root = getStateRoot(db)
  const stateDirection = getStateDirection(db, root, direction)
  const nodes = new Map<string, RenderNode>()
  const edges: RenderEdge[] = []
  const subgraphs = new Map<string, RenderSubgraph>()

  collectStateGraph(root.doc ?? [], {
    nodes,
    edges,
    subgraphs,
  }, {
    direction: stateDirection,
    edgeIndex: { value: 0 },
  })

  return {
    nodes,
    edges,
    subgraphs,
    directives,
    direction: stateDirection,
    diagramType,
  }
}
