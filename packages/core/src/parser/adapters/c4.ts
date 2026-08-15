import type { Directive, DiagramType, RenderGraph, RenderSubgraph } from '../../types'
import {
  asArray,
  asRecord,
  asString,
  callDb,
  makeEdge,
  makeNode,
  stablePart,
  textValue,
  type MermaidDb,
} from './adapter-utils'

interface C4BuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

function c4Shape(type: string) {
  if (type.includes('db')) return 'cylinder' as const
  if (type.includes('person')) return 'rounded' as const
  return 'rectangle' as const
}

export function buildC4Graph(input: C4BuildInput): RenderGraph {
  const shapes = asArray(callDb(input.db, 'getC4ShapeArray')).map(asRecord)
  const nodes = new Map(
    shapes.map((shape) => {
      const id = asString(shape.alias)
      const type = textValue(shape.typeC4Shape, 'system')
      return [
        id,
        makeNode(
          id,
          textValue(shape.label, id),
          'c4',
          {
            kind: 'element',
            c4Type: type,
            description: textValue(shape.descr),
            parentBoundary: asString(shape.parentBoundary, 'global'),
          },
          c4Shape(type),
        ),
      ]
    }),
  )
  const subgraphs = new Map<string, RenderSubgraph>()
  for (const boundary of asArray(callDb(input.db, 'getBoundaries')).map(asRecord)) {
    const id = asString(boundary.alias)
    if (!id || id === 'global') continue
    subgraphs.set(id, {
      id,
      label: textValue(boundary.label, id),
      nodeIds: shapes
        .filter((shape) => asString(shape.parentBoundary) === id)
        .map((shape) => asString(shape.alias)),
      collapsed: false,
      direction: 'TB',
    })
  }
  const edges = asArray(callDb(input.db, 'getRels')).flatMap((value, index) => {
    const relation = asRecord(value)
    const source = asString(relation.from)
    const target = asString(relation.to)
    if (!source || !target) return []
    const technology = textValue(relation.techn)
    return [
      makeEdge({
        id: `c4:${stablePart(source, 'source')}:${stablePart(target, 'target')}:${index}`,
        source,
        target,
        label: [textValue(relation.label), technology].filter(Boolean).join(' · '),
        family: 'c4',
        metadata: {
          kind: asString(relation.type, 'relation'),
          technology,
          description: textValue(relation.descr),
          order: index,
        },
      }),
    ]
  })
  return {
    nodes,
    edges,
    subgraphs,
    directives: input.directives,
    direction: 'LR',
    diagramType: input.diagramType,
  }
}
