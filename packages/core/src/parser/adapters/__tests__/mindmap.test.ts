import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('mindmap diagrams (buildMindmapGraph)', () => {
  it('parses a nested hierarchy into a semantic graph with depth and parent metadata', async () => {
    const source = `mindmap
  root((mindmap))
    Origins
      Long history
    Research
      On effectiveness
    Tools
      Pen and paper
      Mermaid`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('mindmap')
    expect([...result.graph!.nodes.keys()]).toEqual([
      'root',
      'Origins',
      'Long history',
      'Research',
      'On effectiveness',
      'Tools',
      'Pen and paper',
      'Mermaid',
    ])

    // The root drawn with (( )) is a circle node type with no parent.
    expect(result.graph!.nodes.get('root')).toMatchObject({
      label: 'mindmap',
      shape: 'circle',
      metadata: { diagramFamily: 'mindmap', mindmap: { kind: 'topic', depth: 0 } },
    })
    expect(
      (result.graph!.nodes.get('root')!.metadata as { mindmap: { parentId?: string } }).mindmap
        .parentId,
    ).toBeUndefined()

    // Plain-text topics default to rounded nodes and carry depth + parent metadata.
    expect(result.graph!.nodes.get('Origins')).toMatchObject({
      shape: 'rounded',
      metadata: { mindmap: { depth: 1, parentId: 'root' } },
    })
    expect(result.graph!.nodes.get('Long history')).toMatchObject({
      metadata: { mindmap: { depth: 2, parentId: 'Origins' } },
    })

    // Every non-root node has a branch edge from its parent.
    expect(result.graph!.edges).toHaveLength(7)
    expect(result.graph!.edges[0]).toMatchObject({
      id: 'mindmap:root:Origins',
      source: 'root',
      target: 'Origins',
      metadata: { diagramFamily: 'mindmap', mindmap: { kind: 'branch', depth: 1 } },
    })
  })

  it('disambiguates sibling topics that share the same label', async () => {
    const source = `mindmap
  root
    Child
    Child`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect([...result.graph!.nodes.keys()]).toEqual(['root', 'Child', 'Child:2'])
    expect(result.graph!.nodes.get('Child:2')).toMatchObject({ label: 'Child' })
    expect(result.graph!.edges).toHaveLength(2)
  })

  it('degrades gracefully for a single root topic with no children', async () => {
    const source = `mindmap
  root`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect([...result.graph!.nodes.keys()]).toEqual(['root'])
    expect(result.graph!.edges).toHaveLength(0)
  })

  it('reports a readable parse error instead of throwing for a mindmap with no root', async () => {
    const source = `mindmap`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
  })
})
