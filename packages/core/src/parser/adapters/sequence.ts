import type { Directive, DiagramType, RenderGraph, RenderSubgraph } from '../../types'
import {
  asArray,
  asRecord,
  asString,
  callDb,
  makeEdge,
  makeNode,
  mapEntries,
  stablePart,
  type MermaidDb,
} from './adapter-utils'

interface SequenceBuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

export function buildSequenceGraph(input: SequenceBuildInput): RenderGraph {
  const nodes = new Map(
    mapEntries(callDb(input.db, 'getActors')).map(([id, actor]) => [
      id,
      makeNode(
        id,
        asString(actor.description, asString(actor.name, id)),
        'sequence',
        { kind: 'actor', actorType: asString(actor.type, 'participant') },
        'rectangle',
      ),
    ]),
  )
  const edges = asArray(callDb(input.db, 'getMessages')).flatMap((value, order) => {
    const message = asRecord(value)
    const source = asString(message.from)
    const target = asString(message.to)
    if (!source || !target) return []
    return [
      makeEdge({
        id: `sequence:${stablePart(source, 'source')}:${stablePart(target, 'target')}:${order}`,
        source,
        target,
        label: asString(message.message),
        family: 'sequence',
        style: Number(message.type) === 1 ? 'dotted' : 'solid',
        metadata: {
          kind: 'message',
          order,
          messageType: Number(message.type),
          activate: Boolean(message.activate),
        },
      }),
    ]
  })
  return {
    nodes,
    edges,
    subgraphs: new Map<string, RenderSubgraph>(),
    directives: input.directives,
    direction: 'LR',
    diagramType: input.diagramType,
  }
}
