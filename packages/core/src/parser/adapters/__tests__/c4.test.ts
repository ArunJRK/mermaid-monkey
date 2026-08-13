import { describe, it, expect } from 'vitest'
import { buildGraph } from '../../graph-builder'

describe('c4 diagrams (buildC4Graph)', () => {
  it('parses C4 elements, boundaries, and relationships into a semantic graph', async () => {
    const source = `C4Context
    title System Context diagram
    Person(user, "User", "A user")
    Person_Ext(partner, "Partner")
    System_Boundary(platform, "Platform") {
      System(app, "Application", "Does things")
      SystemDb(db, "Database")
    }
    System_Ext(other, "Other System")
    Rel(user, app, "Uses", "HTTPS")
    Rel(app, db, "Reads/writes")
    Rel(partner, other, "Integrates")`

    const result = await buildGraph(source)

    expect(result.success, JSON.stringify(result.errors)).toBe(true)
    expect(result.graph!.diagramType).toBe('c4')
    expect(result.graph!.direction).toBe('LR')
    expect([...result.graph!.nodes.keys()]).toEqual(['user', 'partner', 'app', 'db', 'other'])

    expect(result.graph!.nodes.get('user')).toMatchObject({
      label: 'User',
      shape: 'rounded',
      metadata: {
        diagramFamily: 'c4',
        c4: { kind: 'element', c4Type: 'person', description: 'A user', parentBoundary: 'global' },
      },
    })
    expect(result.graph!.nodes.get('db')).toMatchObject({
      label: 'Database',
      shape: 'cylinder',
      metadata: {
        c4: { c4Type: 'system_db', parentBoundary: 'platform' },
      },
    })
    expect(result.graph!.nodes.get('other')).toMatchObject({
      label: 'Other System',
      shape: 'rectangle',
      metadata: { c4: { c4Type: 'external_system', parentBoundary: 'global' } },
    })

    // Boundaries become subgraphs, but the implicit "global" boundary is not exposed as one.
    expect(result.graph!.subgraphs.size).toBe(1)
    expect(result.graph!.subgraphs.get('platform')).toMatchObject({
      id: 'platform',
      label: 'Platform',
      nodeIds: ['app', 'db'],
      direction: 'TB',
    })
    expect(result.graph!.subgraphs.has('global')).toBe(false)

    expect(result.graph!.edges).toHaveLength(3)
    // Rel with a technology argument joins label and technology with " · ".
    expect(result.graph!.edges[0]).toMatchObject({
      id: 'c4:user:app:0',
      source: 'user',
      target: 'app',
      label: 'Uses · HTTPS',
      metadata: { c4: { technology: 'HTTPS', order: 0 } },
    })
    // Rel without a technology argument uses only the relationship label.
    expect(result.graph!.edges[1]).toMatchObject({
      id: 'c4:app:db:1',
      source: 'app',
      target: 'db',
      label: 'Reads/writes',
      metadata: { c4: { technology: '', order: 1 } },
    })
  })

  it('degrades gracefully for a C4 diagram with no elements or relationships', async () => {
    const source = `C4Context
    title Empty`

    const result = await buildGraph(source)

    expect(result.success).toBe(true)
    expect(result.graph!.diagramType).toBe('c4')
    expect(result.graph!.nodes.size).toBe(0)
    expect(result.graph!.edges).toHaveLength(0)
    expect(result.graph!.subgraphs.size).toBe(0)
  })

  it('reports a readable parse error instead of throwing for malformed C4 syntax', async () => {
    const source = `C4Context
    Person(user "Missing comma")`

    const result = await buildGraph(source)

    expect(result.success).toBe(false)
    expect(result.graph).toBeUndefined()
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].code).toBe('PARSE_FAILED')
    expect(result.errors[0].message.length).toBeGreaterThan(0)
  })
})
