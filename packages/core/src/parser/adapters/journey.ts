import type { Directive, DiagramType, RenderGraph, RenderSubgraph } from '../../types'
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

interface JourneyBuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

export function buildJourneyGraph(input: JourneyBuildInput): RenderGraph {
  const tasks = asArray(callDb(input.db, 'getTasks')).map(asRecord)
  const ids = tasks.map((task, index) => {
    const section = asString(task.section, 'Journey')
    const label = asString(task.task, `Step ${index + 1}`)
    return `journey:${section}:${label}:${index}`
  })
  const nodes = new Map(
    tasks.map((task, index) => {
      const people = asArray(task.people).map((value) => asString(value)).filter(Boolean)
      return [
        ids[index],
        makeNode(
          ids[index],
          asString(task.task, ids[index]),
          'journey',
          {
            kind: 'step',
            section: asString(task.section),
            order: index,
            score: Number(task.score),
            people,
          },
          'rounded',
        ),
      ]
    }),
  )
  const edges = ids.slice(1).map((target, index) =>
    makeEdge({
      id: `journey:${stablePart(ids[index], 'source')}:${stablePart(target, 'target')}`,
      source: ids[index],
      target,
      family: 'journey',
      metadata: { kind: 'next', order: index },
    }),
  )
  const subgraphs = new Map<string, RenderSubgraph>()
  for (const value of asArray(callDb(input.db, 'getSections'))) {
    const section = asString(value)
    const id = `journey:section:${section}`
    subgraphs.set(id, {
      id,
      label: section,
      nodeIds: tasks.flatMap((task, index) =>
        asString(task.section) === section ? [ids[index]] : [],
      ),
      collapsed: false,
      direction: 'LR',
    })
  }
  return {
    nodes,
    edges,
    subgraphs,
    directives: input.directives,
    direction: 'LR',
    diagramType: input.diagramType,
  }
}
