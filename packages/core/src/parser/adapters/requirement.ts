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

interface RequirementBuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

export function buildRequirementGraph(input: RequirementBuildInput): RenderGraph {
  const nodes = new Map()
  for (const [id, requirement] of mapEntries(callDb(input.db, 'getRequirements'))) {
    const requirementId = asString(requirement.id)
    const text = asString(requirement.text)
    nodes.set(
      id,
      makeNode(
        id,
        [requirementId || id, text].filter(Boolean).join('\n'),
        'requirement',
        {
          kind: 'requirement',
          id: requirementId,
          requirementType: asString(requirement.type, 'Requirement'),
          text,
          risk: asString(requirement.risk),
          verifyMethod: asString(requirement.verifyMethod),
        },
      ),
    )
  }
  for (const [id, element] of mapEntries(callDb(input.db, 'getElements'))) {
    nodes.set(
      id,
      makeNode(
        id,
        id,
        'requirement',
        {
          kind: 'element',
          elementType: asString(element.type),
          documentReference: asString(element.docRef ?? element.docref),
        },
        'rectangle',
      ),
    )
  }
  const edges = asArray(callDb(input.db, 'getRelationships')).flatMap((value, index) => {
    const relationship = asRecord(value)
    const source = asString(relationship.src)
    const target = asString(relationship.dst)
    if (!source || !target) return []
    const kind = asString(relationship.type, 'relates')
    return [
      makeEdge({
        id: `requirement:${stablePart(source, 'source')}:${stablePart(target, 'target')}:${stablePart(kind, String(index))}`,
        source,
        target,
        label: kind,
        family: 'requirement',
        metadata: { kind, order: index },
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
