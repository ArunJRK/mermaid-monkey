import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('gantt diagrams (buildGanttGraph)', () => {
  it('parses sections, tasks, and "after" dependencies into a semantic graph', async () => {
    const source = `gantt
    title Delivery
    dateFormat YYYY-MM-DD
    section Build
    API :api, 2026-07-24, 2d
    UI :ui, after api, 1d
    section Ship
    Deploy :deploy, after ui, 0d`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('gantt')
    expect(result.graph!.direction).toBe('LR')
    expect([...result.graph!.nodes.keys()]).toEqual(['api', 'ui', 'deploy'])

    const api = result.graph!.nodes.get('api')!
    expect(api).toMatchObject({
      label: 'API',
      shape: 'rectangle',
      metadata: { diagramFamily: 'gantt', gantt: { kind: 'task', section: 'Build', order: 0 } },
    })
    // Mermaid resolves task dates through the local timezone, so only assert
    // the shape (an ISO string) rather than pin an absolute instant.
    const apiMetadata = api.metadata as { gantt: { startTime: string } }
    expect(apiMetadata.gantt.startTime).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)

    // "after <id>" dependencies become precedes edges chained across sections.
    expect(result.graph!.edges).toEqual([
      expect.objectContaining({
        id: 'gantt:api:ui',
        source: 'api',
        target: 'ui',
        label: 'precedes',
        metadata: { diagramFamily: 'gantt', gantt: { kind: 'dependency' } },
      }),
      expect.objectContaining({
        id: 'gantt:ui:deploy',
        source: 'ui',
        target: 'deploy',
        label: 'precedes',
      }),
    ])

    // Sections become subgraphs grouping their tasks.
    expect(result.graph!.subgraphs.get('gantt:section:Build')).toMatchObject({
      label: 'Build',
      nodeIds: ['api', 'ui'],
    })
    expect(result.graph!.subgraphs.get('gantt:section:Ship')).toMatchObject({
      label: 'Ship',
      nodeIds: ['deploy'],
    })
  })

  it('degrades gracefully for a task with no predecessor and a section with no tasks', async () => {
    const source = `gantt
    title Solo
    dateFormat YYYY-MM-DD
    section Only
    Task :task1, 2026-01-01, 1d`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect([...result.graph!.nodes.keys()]).toEqual(['task1'])
    expect(result.graph!.nodes.get('task1')).toMatchObject({ label: 'Task' })
    // No "after" reference means no dependency edge is produced.
    expect(result.graph!.edges).toHaveLength(0)
  })

  it('degrades gracefully for a gantt diagram declared with no tasks at all', async () => {
    const source = `gantt
    title No tasks
    dateFormat YYYY-MM-DD`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.nodes.size).toBe(0)
    expect(result.graph!.edges).toHaveLength(0)
    expect(result.graph!.subgraphs.size).toBe(0)
  })

  it('reports a readable parse error instead of throwing for malformed gantt syntax', async () => {
    const source = `gantt
    not a real gantt line ###`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
