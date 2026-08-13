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

interface GanttBuildInput {
  db: MermaidDb
  diagramType: DiagramType
  directives: Directive[]
}

function isoValue(value: unknown): string {
  if (value instanceof Date) return value.toISOString()
  return asString(value)
}

export function buildGanttGraph(input: GanttBuildInput): RenderGraph {
  const tasks = asArray(callDb(input.db, 'getTasks')).map(asRecord)
  const nodes = new Map(
    tasks.map((task, index) => {
      const id = asString(task.id, `gantt:task:${index}`)
      const classes = asArray(task.classes).map((value) => asString(value)).filter(Boolean)
      return [
        id,
        makeNode(
          id,
          asString(task.task, id).trim(),
          'gantt',
          {
            kind: 'task',
            section: asString(task.section),
            order: Number(task.order ?? index),
            startTime: isoValue(task.startTime),
            endTime: isoValue(task.endTime),
            classes,
          },
          'rectangle',
        ),
      ]
    }),
  )
  const edges = tasks.flatMap((task, index) => {
    const source = asString(task.prevTaskId)
    const target = asString(task.id, `gantt:task:${index}`)
    if (!source || !nodes.has(source)) return []
    return [
      makeEdge({
        id: `gantt:${stablePart(source, 'source')}:${stablePart(target, 'target')}`,
        source,
        target,
        label: 'precedes',
        family: 'gantt',
        metadata: { kind: 'dependency' },
      }),
    ]
  })
  const subgraphs = new Map<string, RenderSubgraph>()
  for (const value of asArray(callDb(input.db, 'getSections'))) {
    const section = asString(value)
    const id = `gantt:section:${section}`
    subgraphs.set(id, {
      id,
      label: section,
      nodeIds: tasks
        .filter((task) => asString(task.section) === section)
        .map((task, index) => asString(task.id, `gantt:task:${index}`)),
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
